// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.security;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.util.IpUtil;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.web.resource.UserResource;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.Priority;
import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Priorities;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Cookie;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Slf4j
@Provider
@Priority(Priorities.AUTHENTICATION)
public class AuthenticationFilter implements ContainerRequestFilter {
    public static final String EXTERNAL_API_AUTH_HEADER_NAME_TOKEN = "x-cf-token";
    public static final String EXTERNAL_API_AUTH_HEADER_NAME_CONNECT_TOKEN = "x-cf-connect-token";

    public interface Config {
        @NoDefaultValue
        String connectToken();
    }

    @Context
    private HttpServletRequest request;
    @Context
    protected HttpServletResponse response;
    @Inject
    private Config config;
    @Inject
    private Environment env;
    @Inject
    private SuperAdminPredicate superAdminPredicate;
    @Inject
    private AccountStore accountStore;
    @Inject
    private UserStore userStore;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private CommentStore commentStore;
    @Inject
    private ProjectStore projectStore;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        try {
            requestContext.setSecurityContext(authenticate(requestContext));
        } catch (Exception ex) {
            log.warn("Uncaught exception in Auth Filter", ex);
            throw ex;
        }
    }

    private ExtendedSecurityContext authenticate(ContainerRequestContext requestContext) throws IOException {
        Optional<Account> accountByApiKey = getAccountByApiKey(requestContext);

        Optional<AccountSession> accountSessionOpt = getAccountSessionForCookieName(requestContext, AccountResource.ACCOUNT_AUTH_COOKIE_NAME);
        Optional<AccountSession> superAccountSessionOpt = getAccountSessionForCookieName(requestContext, AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME);

        Optional<Account> accountOpt = accountByApiKey.or(() -> accountSessionOpt
                .map(AccountSession::getAccountId)
                .flatMap(accountStore::getAccountByAccountId));
        Optional<Account> superAccountOpt = accountByApiKey
                .filter(account -> superAdminPredicate.isEmailSuperAdmin(account.getEmail()))
                .or(() -> superAccountSessionOpt
                        .map(AccountSession::getAccountId)
                        .flatMap(accountStore::getAccountByAccountId)
                        .filter(account -> superAdminPredicate.isEmailSuperAdmin(account.getEmail())));

        Optional<UserSession> userSessionOpt = getPathParameter(requestContext, "projectId")
                .or(() -> getPathParameter(requestContext, "slug")
                        .flatMap(slug -> projectStore.getProjectBySlug(slug, true)
                                .map(Project::getProjectId)))
                .flatMap(projectId -> authenticateUser(projectId, requestContext));

        return ExtendedSecurityContext.create(
                IpUtil.getRemoteIp(request, env),
                accountSessionOpt,
                superAccountSessionOpt,
                accountOpt,
                superAccountOpt,
                userSessionOpt,
                role -> hasRole(role, accountOpt, userSessionOpt, superAccountOpt, requestContext),
                requestContext);
    }

    private Optional<AccountSession> getAccountSessionForCookieName(ContainerRequestContext requestContext, String cookieName) {
        // TODO check for HttpOnly, isSecure, etc...
        // TODO sanity check cookie.getValue()
        return Optional.ofNullable(requestContext.getCookies().get(cookieName))
                .map(Cookie::getValue)
                .flatMap(accountStore::getSession);
    }

    private Optional<Account> getAccountByApiKey(ContainerRequestContext requestContext) {
        return getHeaderParameter(requestContext, EXTERNAL_API_AUTH_HEADER_NAME_TOKEN)
                .flatMap(accountStore::getAccountByApiKey);
    }

    private Optional<UserSession> authenticateUser(String projectId, ContainerRequestContext requestContext) {
        return authenticateUserCookie(
                userStore,
                requestContext.getCookies().get(UserResource.USER_AUTH_COOKIE_NAME_PREFIX + projectId));
    }

    /** TODO Kind of a hack, authenticate* methods should be refactored out to a separate singleton class */
    public static Optional<UserSession> authenticateUserCookie(UserStore userStore, Cookie cookie) {
        if (cookie == null) {
            return Optional.empty();
        }

        // TODO check for HttpOnly, isSecure, etc...
        // TODO sanity check cookie.getValue()

        return userStore.getSession(cookie.getValue());
    }

    private boolean hasRole(String role, Optional<Account> accountOpt, Optional<UserSession> userSession, Optional<Account> superAccountOpt, ContainerRequestContext requestContext) {
        boolean hasRole = hasRoleInternal(role, accountOpt, userSession, superAccountOpt, requestContext);
        if (hasRole) {
            log.debug("User does have role {}", role);
        } else {
            log.debug("User doesn't have role {}", role);
        }
        return hasRole;
    }

    private boolean hasRoleInternal(String role, Optional<Account> accountOpt, Optional<UserSession> userSession, Optional<Account> superAccountOpt, ContainerRequestContext requestContext) {
        Optional<String> pathParamProjectIdOpt = getPathParameter(requestContext, "projectId");

        log.trace("hasRole role {} accountId {} userSession {} projectIdParam {} isSuperAdmin {}",
                role, accountOpt.map(Account::getAccountId), userSession.map(UserSession::getUserId), pathParamProjectIdOpt, superAccountOpt.isPresent());

        if (pathParamProjectIdOpt.isPresent() && userSession.isPresent()
                && !userSession.get().getProjectId().equals(pathParamProjectIdOpt.get())) {
            log.warn("Potential attack attempt, projectId {} in path param mismatches user {} session projectId {} for method {}",
                    pathParamProjectIdOpt.get(), userSession.get().getUserId(), userSession.get().getProjectId(), requestContext.getMethod());
            return false;
        }

        Optional<String> pathParamIdeaIdOpt;
        Optional<String> pathParamCommentIdOpt;
        switch (role) {
            case Role.SUPER_ADMIN:
                return superAccountOpt.isPresent();
            case Role.CONNECT:
                Optional<String> headerConnectToken = getHeaderParameter(requestContext, EXTERNAL_API_AUTH_HEADER_NAME_CONNECT_TOKEN);
                return headerConnectToken.isPresent()
                        && config.connectToken().equals(headerConnectToken.get());
            case Role.ADMINISTRATOR_ACTIVE:
                if (!accountOpt.isPresent()) {
                    log.trace("Role {} missing account", role);
                    return false;
                }
                if (!Billing.SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(accountOpt.get().getStatus())) {
                    log.trace("Role {} inactive subscription", role);
                    return false;
                }
                return true;
            case Role.ADMINISTRATOR:
                if (!accountOpt.isPresent()) {
                    log.trace("Role {} missing account", role);
                    return false;
                }
                return true;
            case Role.PROJECT_OWNER_ACTIVE:
            case Role.PROJECT_OWNER:
                if (!pathParamProjectIdOpt.isPresent()) {
                    log.trace("Role {} missing project id", role);
                    return false;
                }
                if (!accountOpt.isPresent()) {
                    log.trace("Role {} missing account", role);
                    return false;
                }
                if (accountOpt.get().getProjectIds().stream().noneMatch(pathParamProjectIdOpt.get()::equals)) {
                    log.trace("Role {} doesn't own project", role);
                    return false;
                }
                if (Role.PROJECT_OWNER.equals(role)) {
                    return true;
                }
                // From here on just checking the _ACTIVE portion
                if (!Billing.SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(accountOpt.get().getStatus())) {
                    log.trace("Role {} inactive subscription", role);
                    return false;
                }
                return true;
            case Role.PROJECT_ANON:
                if (!pathParamProjectIdOpt.isPresent()) {
                    log.warn("Possible misconfiguration, role {} requested, but no projectId path param found in {}",
                            role, requestContext.getUriInfo().getRequestUri());
                    return false;
                }
                if (userSession.isPresent() && userSession.get().getProjectId().equals(pathParamProjectIdOpt.get())) {
                    return true;
                }
                Optional<Project> projectOpt = projectStore.getProject(pathParamProjectIdOpt.get(), true);
                if (!projectOpt.isPresent()) {
                    log.trace("Role {} missing project", role);
                    return false;
                }
                Onboarding.VisibilityEnum visibility = projectOpt.get()
                        .getVersionedConfigAdmin()
                        .getConfig()
                        .getUsers()
                        .getOnboarding()
                        .getVisibility();
                return Onboarding.VisibilityEnum.PUBLIC.equals(visibility);
            case Role.PROJECT_MODERATOR:
            case Role.PROJECT_MODERATOR_ACTIVE:
                if (!userSession.isPresent()) {
                    log.trace("Role {} with no user", role);
                    return false;
                }
                if (!pathParamProjectIdOpt.isPresent()) {
                    log.trace("Role {} with no path param", role);
                    return false;
                }
                if (!userSession.get().getProjectId().equals(pathParamProjectIdOpt.get())) {
                    log.trace("Role {} with user {} project {} not matching project {}",
                            role, userSession.get().getUserId(), userSession.get().getProjectId(), pathParamProjectIdOpt.get());
                    return false;
                }
                if (userSession.get().getIsMod() != Boolean.TRUE) {
                    log.trace("Role {} with user {} not being a mod", role, userSession.get().getUserId());
                    return false;
                }
                if (Role.PROJECT_MODERATOR.equals(role)) {
                    return true;
                }
                // From here on just checking the _ACTIVE portion
                Optional<Account> projectAccountOpt = accountOpt
                        .filter(account -> account.getProjectIds().contains(pathParamProjectIdOpt.get()))
                        .or(() -> projectStore.getProject(pathParamProjectIdOpt.get(), true)
                                .map(Project::getAccountId)
                                .flatMap(accountStore::getAccountByAccountId));
                if (!projectAccountOpt.isPresent()) {
                    log.trace("Role {} missing account from projectId {}", role, pathParamProjectIdOpt.get());
                    return false;
                }
                if (!Billing.SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(projectAccountOpt.get().getStatus())) {
                    log.trace("Role {} with inactive account status {}", role, projectAccountOpt.get().getStatus());
                    return false;
                }
                return true;
            case Role.PROJECT_USER:
                return userSession.isPresent() && pathParamProjectIdOpt.isPresent()
                        && userSession.get().getProjectId().equals(pathParamProjectIdOpt.get());
            case Role.IDEA_OWNER:
                pathParamIdeaIdOpt = getPathParameter(requestContext, "ideaId");
                if (!userSession.isPresent() || !pathParamIdeaIdOpt.isPresent()) {
                    log.trace("Role {} missing path param idea id", role);
                    return false;
                }
                Optional<IdeaStore.IdeaModel> idea = ideaStore.getIdea(userSession.get().getProjectId(), pathParamIdeaIdOpt.get());
                return idea.isPresent() && idea.get().getAuthorUserId().equals(userSession.get().getUserId());
            case Role.COMMENT_OWNER:
                pathParamIdeaIdOpt = getPathParameter(requestContext, "ideaId");
                pathParamCommentIdOpt = getPathParameter(requestContext, "commentId");
                if (!userSession.isPresent()) {
                    log.trace("Role {} missing user session", role);
                    return false;
                }
                if (!pathParamIdeaIdOpt.isPresent()) {
                    log.trace("Role {} missing path param idea id", role);
                    return false;
                }
                if (!pathParamCommentIdOpt.isPresent()) {
                    log.trace("Role {} missing path param comment id", role);
                    return false;
                }
                Optional<CommentStore.CommentModel> comment = commentStore.getComment(userSession.get().getProjectId(), pathParamIdeaIdOpt.get(), pathParamCommentIdOpt.get());
                return comment.isPresent() && comment.get().getAuthorUserId().equals(userSession.get().getUserId());
            default:
                log.warn("Unknown role {}", role);
                return false;
        }
    }

    private Optional<String> getPathParameter(ContainerRequestContext requestContext, String name) {
        List<String> params = requestContext.getUriInfo().getPathParameters().get(name);
        if (params == null || params.size() != 1) {
            return Optional.empty();
        }
        return Optional.ofNullable(Strings.emptyToNull(params.get(0)));
    }

    private Optional<String> getHeaderParameter(ContainerRequestContext requestContext, String name) {
        return Optional.ofNullable(Strings.emptyToNull(requestContext.getHeaderString(name)));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AuthenticationFilter.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
