package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.UserAdminApi;
import com.smotana.clearflask.api.UserApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.TokenVerifyStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.SearchUsersResponse;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class UserResource extends AbstractResource implements UserApi, UserAdminApi {

    public interface Config {
        @DefaultValue("P300D")
        Duration sessionExpiry();

        @DefaultValue("P150D")
        Duration sessionRenewIfExpiringIn();

        @DefaultValue(value = "10", innerType = Integer.class)
        Optional<Integer> searchPageSize();

        @DefaultValue("P7D")
        Duration sendOnEmailChangedEmailIfLastChangeGreaterThan();
    }

    public static final String USER_AUTH_COOKIE_NAME = "cf_usr_auth";

    @Inject
    private Config config;
    @Inject
    private UserStore userStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private TokenVerifyStore tokenVerifyStore;
    @Inject
    private PasswordUtil passwordUtil;
    @Inject
    private NotificationService notificationService;
    @Inject
    private AuthCookie authCookie;
    @Inject
    private Billing billing;

    @PermitAll
    @Limit(requiredPermits = 100, challengeAfter = 3)
    @Override
    public void forgotPassword(String projectId, ForgotPassword forgotPassword) {
        Optional<Project> projectOpt = projectStore.getProject(projectId, true);
        if (!projectOpt.isPresent()) return;

        Optional<UserModel> userOpt = userStore.getUserByIdentifier(projectId, UserStore.IdentifierType.EMAIL, forgotPassword.getEmail());
        if (!userOpt.isPresent()) {
            return;
        }

        if (userOpt.get().getSsoGuid() != null) {
            log.info("Forgot password for sso user {}", userOpt.get().getEmail());
            return;
        }

        notificationService.onForgotPassword(
                projectOpt.get().getVersionedConfigAdmin().getConfig(),
                userOpt.get());
    }

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public UserBindResponse userBind(String projectId) {
        Optional<UserSession> userSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getUserSessionOpt);
        if (!userSessionOpt.isPresent()) {
            return new UserBindResponse(null);
        }
        UserSession userSession = userSessionOpt.get();

        // Token refresh
        if (userSession.getTtlInEpochSec() < Instant.now().plus(config.sessionRenewIfExpiringIn()).getEpochSecond()) {
            userSession = userStore.refreshSession(
                    userSession,
                    Instant.now().plus(config.sessionExpiry()).getEpochSecond());

            authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME, userSession.getSessionId(), userSession.getTtlInEpochSec());
        }

        // Fetch account
        Optional<UserModel> userOpt = userStore.getUser(projectId, userSession.getUserId());
        if (!userOpt.isPresent()) {
            log.info("User bind on valid session to non-existent user, revoking all sessions for userId {}",
                    userSession.getUserId());
            userStore.revokeSessions(projectId, userSession.getUserId(), Optional.empty());
            authCookie.unsetAuthCookie(response, USER_AUTH_COOKIE_NAME);
            return new UserBindResponse(null);
        }

        return new UserBindResponse(userOpt
                .map(UserStore.UserModel::toUserMeWithBalance)
                .orElse(null));
    }

    @PermitAll
    @Limit(requiredPermits = 100)
    @Override
    public UserCreateResponse userCreate(String projectId, UserCreate userCreate) {
        Optional<Project> project = projectStore.getProject(projectId, true);
        Optional<EmailSignup> emailSignupOpt = project
                .map(Project::getVersionedConfigAdmin)
                .map(VersionedConfigAdmin::getConfig)
                .map(ConfigAdmin::getUsers)
                .map(Users::getOnboarding)
                .map(Onboarding::getNotificationMethods)
                .map(NotificationMethods::getEmail);

        boolean emailVerificationRequired = false;

        if (EmailSignup.VerificationEnum.REQUIRED.equals(emailSignupOpt
                .map(EmailSignup::getVerification).orElse(null))) {
            emailVerificationRequired = true;
        }
        Optional<List<String>> allowedDomainsOpt = emailSignupOpt.map(EmailSignup::getAllowedDomains);
        if (allowedDomainsOpt.isPresent() && !Strings.isNullOrEmpty(userCreate.getEmail())) {
            String domain = userCreate.getEmail().substring(userCreate.getEmail().indexOf("@") + 1);
            if (!allowedDomainsOpt.get().contains(domain)) {
                throw new ErrorWithMessageException(
                        Response.Status.BAD_REQUEST,
                        "Allowed domains are " + allowedDomainsOpt.get().stream().collect(Collectors.joining(", ")));
            }
            emailVerificationRequired = true;
        }

        boolean emailVerified = false;
        if (emailVerificationRequired && !Strings.isNullOrEmpty(userCreate.getEmail())) {
            if (Strings.isNullOrEmpty(userCreate.getEmailVerification())) {
                TokenVerifyStore.Token token = tokenVerifyStore.createToken(userCreate.getEmail());
                notificationService.onEmailVerify(
                        project.get().getVersionedConfigAdmin().getConfig(),
                        userCreate.getEmail(),
                        token.getToken());
                return new UserCreateResponse(true, null);
            } else {
                emailVerified = tokenVerifyStore.useToken(userCreate.getEmailVerification(), userCreate.getEmail());
                if (!emailVerified) {
                    throw new ErrorWithMessageException(
                            Response.Status.BAD_REQUEST,
                            "Invalid code");
                }
            }
        }

        // Now we're ready to create the user
        String userId = userStore.genUserId();
        Optional<String> passwordHashed = Optional.empty();
        if (!Strings.isNullOrEmpty(userCreate.getPassword())) {
            passwordHashed = Optional.of(passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userCreate.getPassword(), userId));
        }
        UserModel user = new UserModel(
                projectId,
                userId,
                null,
                null,
                userCreate.getName(),
                userCreate.getEmail(),
                emailVerified ? true : null,
                null,
                passwordHashed.orElse(null),
                null,
                userCreate.getEmail() != null,
                0L,
                userCreate.getIosPushToken(),
                userCreate.getAndroidPushToken(),
                userCreate.getBrowserPushToken(),
                Instant.now(),
                null,
                null,
                null);
        userStore.createUser(user);

        UserSession session = userStore.createSession(
                user,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME, session.getSessionId(), session.getTtlInEpochSec());

        return new UserCreateResponse(null, user.toUserMeWithBalance());
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userCreateAdmin(String projectId, UserCreateAdmin userCreateAdmin) {
        String userId = userStore.genUserId();
        Optional<String> passwordHashed = Optional.empty();
        if (!Strings.isNullOrEmpty(userCreateAdmin.getPassword())) {
            if (userCreateAdmin.getSsoGuid() != null) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Cannot specify both password and ssoGuid");
            }
            passwordHashed = Optional.of(passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userCreateAdmin.getPassword(), userId));
        }
        UserModel user = new UserModel(
                projectId,
                userId,
                userCreateAdmin.getSsoGuid(),
                userCreateAdmin.getIsMod() == Boolean.TRUE ? true : null,
                userCreateAdmin.getName(),
                userCreateAdmin.getEmail(),
                null,
                null,
                passwordHashed.orElse(null),
                null,
                userCreateAdmin.getEmail() != null,
                userCreateAdmin.getBalance() == null ? 0 : userCreateAdmin.getBalance(),
                userCreateAdmin.getIosPushToken(),
                userCreateAdmin.getAndroidPushToken(),
                userCreateAdmin.getBrowserPushToken(),
                Instant.now(),
                null,
                null,
                null);
        userStore.createUser(user);
        if (user.getIsMod() == Boolean.TRUE) {
            ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
            notificationService.onAdminInvite(configAdmin, user);
        }
        return user.toUserAdmin();
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1)
    @Override
    public void userDelete(String projectId, String userId) {
        userStore.deleteUsers(projectId, ImmutableList.of(userId));
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 10)
    @Override
    public User userGet(String projectId, String userId) {
        return userStore.getUser(projectId, userId)
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"))
                .toUser();
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void userDeleteAdmin(String projectId, String userId) {
        userStore.deleteUsers(projectId, ImmutableList.of(userId));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void userDeleteBulkAdmin(String projectId, UserSearchAdmin userSearchAdmin) {
        UserStore.SearchUsersResponse searchResponse = null;
        do {
            searchResponse = userStore.searchUsers(
                    projectId,
                    userSearchAdmin,
                    true,
                    searchResponse == null ? Optional.empty() : searchResponse.getCursorOpt(),
                    Optional.empty());
            userStore.deleteUsers(projectId, searchResponse.getUserIds());
        } while (!searchResponse.getCursorOpt().isPresent());
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public UserMeWithBalance userLogin(String projectId, UserLogin userLogin) {
        Optional<UserModel> userOpt = userStore.getUserByIdentifier(projectId, UserStore.IdentifierType.EMAIL, userLogin.getEmail());
        if (!userOpt.isPresent()) {
            log.info("User login with non-existent email {}", userLogin.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        UserModel user = userOpt.get();

        if (user.getSsoGuid() != null) {
            log.info("Account login for sso user {}", user.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }

        String passwordSupplied = passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userLogin.getPassword(), user.getUserId());
        if (Strings.isNullOrEmpty(user.getPassword())) {
            // Password-less user
        } else if (!user.getPassword().equals(passwordSupplied)) {
            log.info("Account login incorrect password for email {}", user.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        log.debug("Successful user login for email {}", userLogin.getEmail());

        UserSession session = userStore.createSession(
                user,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME, session.getSessionId(), session.getTtlInEpochSec());

        return user.toUserMeWithBalance();
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public UserMeWithBalance userLoginAdmin(String projectId, String userId) {
        Optional<UserModel> userOpt = userStore.getUser(projectId, userId);
        if (!userOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "User does not exist");
        }
        UserModel user = userOpt.get();
        log.debug("Successful user login by admin for userId {}", userId);

        UserSession session = userStore.createSession(
                user,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME, session.getSessionId(), session.getTtlInEpochSec());

        return user.toUserMeWithBalance();
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public void userLogout(String projectId) {
        Optional<ExtendedPrincipal> extendedPrincipal = getExtendedPrincipal();
        if (!extendedPrincipal.isPresent() || !extendedPrincipal.get().getUserSessionOpt().isPresent()) {
            log.trace("Cannot logout user, already not logged in");
            return;
        }
        UserSession session = extendedPrincipal.get().getUserSessionOpt().get();

        log.debug("Logout session for user {}", session.getUserId());
        userStore.revokeSession(session);

        authCookie.unsetAuthCookie(response, USER_AUTH_COOKIE_NAME);
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1, challengeAfter = 20)
    @Override
    public UserMe userUpdate(String projectId, String userId, UserUpdate userUpdate) {
        // TODO Sanity check userUpdate also pass cannot be set by sso user
        if (userUpdate.getEmail() != null) {
            UserModel user = userStore.getUser(projectId, userId).get();
            if (!Strings.isNullOrEmpty(user.getEmail())
                    && (user.getEmailLastUpdated() == null || user.getEmailLastUpdated().plus(config.sendOnEmailChangedEmailIfLastChangeGreaterThan()).isBefore(Instant.now()))) {
                ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
                notificationService.onEmailChanged(configAdmin, user, user.getEmail());
            }
        }
        UserModel user = userStore.updateUser(projectId, userId, userUpdate).getUser();
        return user.toUserMe();
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userUpdateAdmin(String projectId, String userId, UserUpdateAdmin userUpdateAdmin) {
        // TODO Sanity check userUpdateAdmin
        if (userUpdateAdmin.getTransactionCreate() != null) {
            TransactionModel transaction = voteStore.balanceAdjustTransaction(
                    projectId,
                    userId,
                    userUpdateAdmin.getTransactionCreate().getAmount(),
                    Optional.ofNullable(Strings.emptyToNull(userUpdateAdmin.getTransactionCreate().getSummary())).orElse("Admin adjustment"),
                    Optional.empty());
            userStore.updateUserBalance(projectId, userId, userUpdateAdmin.getTransactionCreate().getAmount(), Optional.empty());
            ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
            UserModel user = userStore.getUser(projectId, userId).get();
            notificationService.onCreditChanged(configAdmin, user, transaction);
        }
        return userStore.updateUser(projectId, userId, userUpdateAdmin).getUser().toUserAdmin();
    }

    @RolesAllowed({Role.PROJECT_OWNER, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userGetAdmin(String projectId, String userId) {
        return userStore.getUser(projectId, userId)
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"))
                .toUserAdmin();
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 10)
    @Override
    public UserSearchResponse userSearchAdmin(String projectId, UserSearchAdmin userSearchAdmin, String cursor) {
        SearchUsersResponse searchUsersResponse = userStore.searchUsers(
                projectId,
                userSearchAdmin,
                false,
                Optional.ofNullable(Strings.emptyToNull(cursor)),
                config.searchPageSize());

        final ImmutableMap<String, UserModel> usersById;
        if (searchUsersResponse.getUserIds().isEmpty()) {
            usersById = ImmutableMap.of();
        } else {
            usersById = userStore.getUsers(projectId, searchUsersResponse.getUserIds());
        }

        return new UserSearchResponse(
                searchUsersResponse.getCursorOpt().orElse(null),
                searchUsersResponse.getUserIds().stream()
                        .map(usersById::get)
                        .filter(Objects::nonNull)
                        .map(UserModel::toUserAdmin)
                        .collect(ImmutableList.toImmutableList()));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(UserResource.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
