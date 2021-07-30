package com.smotana.clearflask.web.security;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.smotana.clearflask.api.model.NotificationMethodsOauth;
import com.smotana.clearflask.api.model.UserBindOauthToken;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.web.resource.UserResource;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.net.MalformedURLException;
import java.net.URL;
import java.time.Instant;
import java.util.Optional;

import static com.smotana.clearflask.web.resource.UserResource.USER_AUTH_COOKIE_NAME_PREFIX;

@Slf4j
@Singleton
public class UserBindUtil {

    @Inject
    private UserResource.Config configUserResource;
    @Inject
    private UserStore userStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private AuthCookie authCookie;

    public Optional<UserModel> userBind(
            HttpServletRequest request,
            HttpServletResponse response,
            String projectId,
            Optional<ExtendedSecurityContext.ExtendedPrincipal> extendedPrincipalOpt,
            Optional<String> ssoTokenOpt,
            Optional<String> authTokenOpt,
            Optional<UserBindOauthToken> oauthTokenOpt,
            Optional<String> browserPushTokenOpt) {

        Optional<UserSession> userSessionOpt = extendedPrincipalOpt.flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt);
        Optional<UserModel> userOpt = userSessionOpt
                .flatMap(userSession -> userStore.getUser(userSession.getProjectId(), userSession.getUserId()));
        boolean createSession = false;

        // Revoke sessions if user doesn't exist
        if (!userOpt.isPresent() && userSessionOpt.isPresent()) {
            log.debug("User bind on valid session to non-existent user, revoking all sessions for userId {}", userSessionOpt.get().getUserId());
            userStore.revokeSessions(projectId, userSessionOpt.get().getUserId(), Optional.empty());
            authCookie.unsetAuthCookie(response, USER_AUTH_COOKIE_NAME_PREFIX + projectId);
            userSessionOpt = Optional.empty();
        }

        // Token refresh
        if (userOpt.isPresent() && userSessionOpt.get().getTtlInEpochSec() < Instant.now().plus(configUserResource.sessionRenewIfExpiringIn()).getEpochSecond()) {
            userSessionOpt = Optional.of(userStore.refreshSession(
                    userSessionOpt.get(),
                    Instant.now().plus(configUserResource.sessionExpiry()).getEpochSecond()));
            authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME_PREFIX + projectId, userSessionOpt.get().getSessionId(), userSessionOpt.get().getTtlInEpochSec());
        }

        // Auto login using auth token
        if (!userOpt.isPresent() && authTokenOpt.isPresent()) {
            userOpt = userStore.verifyToken(authTokenOpt.get());
            if (userOpt.isPresent()) {
                createSession = true;
            }
        }

        // Auto login using sso token
        if (!userOpt.isPresent() && ssoTokenOpt.isPresent()) {
            Project project = projectStore.getProject(projectId, true).get();
            userOpt = userStore.ssoCreateOrGet(projectId, project.getVersionedConfigAdmin().getConfig().getSsoSecretKey(), ssoTokenOpt.get());
            if (userOpt.isPresent()) {
                createSession = true;
            }
        }

        // Auto login using oauth token
        if (!userOpt.isPresent() && oauthTokenOpt.isPresent()) {
            Project project = projectStore.getProject(projectId, true).get();
            Optional<NotificationMethodsOauth> oauthMethodOpt = project.getVersionedConfigAdmin().getConfig().getUsers().getOnboarding().getNotificationMethods().getOauth().stream()
                    .filter(nmo -> oauthTokenOpt.get().getId().equals(nmo.getOauthId()))
                    .findAny();
            Optional<String> clientSecretOpt = oauthMethodOpt.flatMap(oauthMethod -> {
                if (project.getVersionedConfigAdmin().getConfig().getOauthClientSecrets() == null) {
                    return Optional.empty();
                }
                return Optional.ofNullable(Strings.emptyToNull(project.getVersionedConfigAdmin().getConfig().getOauthClientSecrets().get(oauthMethod.getOauthId())));
            });
            Optional<String> refererHostOpt = Optional.ofNullable(request.getHeader("referer"))
                    .flatMap(referer -> {
                        try {
                            return Optional.ofNullable(new URL(referer).getHost());
                        } catch (MalformedURLException exception) {
                            // Nothing to do
                        }
                        return Optional.empty();
                    });
            String redirectHostname;
            if (refererHostOpt.isPresent() && refererHostOpt.get().startsWith(project.getHostnameFromSubdomain())) {
                redirectHostname = project.getHostnameFromSubdomain();
            } else if (refererHostOpt.isPresent() && project.getHostnameFromDomain().isPresent() && refererHostOpt.get().startsWith(project.getHostnameFromDomain().get())) {
                redirectHostname = project.getHostnameFromDomain().get();
            } else {
                redirectHostname = project.getHostname();
            }
            if (clientSecretOpt.isPresent()) {
                userOpt = userStore.oauthCreateOrGet(
                        project.getProjectId(),
                        oauthMethodOpt.get(),
                        clientSecretOpt.get(),
                        "https://" + redirectHostname + "/oauth",
                        oauthTokenOpt.get().getCode());
                createSession = true;
            } else {
                log.trace("OAuth failed, token {} with oauth provider present {} client secret present {}",
                        oauthTokenOpt.get(), oauthMethodOpt.isPresent(), clientSecretOpt.isPresent());
            }
        }

        // Auto login using browser push token (if email nor password is set)
        if (!userOpt.isPresent() && browserPushTokenOpt.isPresent()) {
            userOpt = userStore.getUserByIdentifier(
                    projectId,
                    UserStore.IdentifierType.BROWSER_PUSH,
                    browserPushTokenOpt.get());
            if (userOpt.isPresent()) {
                if (!Strings.isNullOrEmpty(userOpt.get().getPassword()) || !Strings.isNullOrEmpty(userOpt.get().getEmail())) {
                    userOpt = Optional.empty();
                } else {
                    createSession = true;
                }
            }
        }

        // Auto login to auto-generated user tied to account holder
        if (!userOpt.isPresent()) {
            Optional<AccountStore.Account> accountOpt = extendedPrincipalOpt
                    .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAccountSessionOpt)
                    .flatMap(accountSession -> accountStore.getAccountByAccountId(accountSession.getAccountId()));
            if (accountOpt.isPresent()) {
                userOpt = Optional.of(userStore.accountCreateOrGet(projectId, accountOpt.get()));
                createSession = true;
            }
        }

        if (createSession && userOpt.isPresent()) {
            UserSession session = userStore.createSession(
                    userOpt.get(),
                    Instant.now().plus(configUserResource.sessionExpiry()).getEpochSecond());
            authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME_PREFIX + projectId, session.getSessionId(), session.getTtlInEpochSec());
        }

        return userOpt;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(UserBindUtil.class).asEagerSingleton();
            }
        };
    }
}
