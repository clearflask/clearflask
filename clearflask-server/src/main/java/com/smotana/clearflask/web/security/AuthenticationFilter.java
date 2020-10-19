package com.smotana.clearflask.web.security;

import com.google.common.base.Strings;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.ProjectStore.Project;
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
    public static final String EXTERNAL_API_AUTH_HEADER_NAME_ACCOUNT_ID = "x-cf-account";
    public static final String EXTERNAL_API_AUTH_HEADER_NAME_TOKEN_ID = "x-cf-secret";

    @Context
    private HttpServletRequest request;
    @Context
    protected HttpServletResponse response;
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
        Optional<AccountSession> superAdminSessionOpt = authenticateSuperAdmin(requestContext);
        Optional<AccountSession> accountSessionOpt = authenticateAccount(requestContext)
                .or(() -> superAdminSessionOpt);
        Optional<UserSession> userSessionOpt = authenticateUser(accountSessionOpt, requestContext);
        return ExtendedSecurityContext.create(
                IpUtil.getRemoteIp(request, env),
                accountSessionOpt,
                superAdminSessionOpt,
                userSessionOpt,
                role -> hasRole(role, accountSessionOpt, userSessionOpt, superAdminSessionOpt, requestContext),
                requestContext);
    }

    private Optional<AccountSession> authenticateAccount(ContainerRequestContext requestContext) {
        Cookie cookie = requestContext.getCookies().get(AccountResource.ACCOUNT_AUTH_COOKIE_NAME);
        if (cookie == null) {
            return Optional.empty();
        }

        // TODO check for HttpOnly, isSecure, etc...
        // TODO sanity check cookie.getValue()

        return accountStore.getSession(cookie.getValue());
    }

    private Optional<AccountSession> authenticateSuperAdmin(ContainerRequestContext requestContext) {
        Cookie cookie = requestContext.getCookies().get(AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME);
        if (cookie == null) {
            return Optional.empty();
        }

        // TODO check for HttpOnly, isSecure, etc...
        // TODO sanity check cookie.getValue()

        Optional<AccountSession> superAdminSession = accountStore.getSession(cookie.getValue());
        if (!superAdminSession.isPresent()
                || !superAdminPredicate.isEmailSuperAdmin(superAdminSession.get().getEmail())) {
            return Optional.empty();
        }

        return superAdminSession;
    }

    private Optional<UserSession> authenticateUser(Optional<AccountSession> accountSessionOpt, ContainerRequestContext requestContext) {
        Cookie cookie = requestContext.getCookies().get(UserResource.USER_AUTH_COOKIE_NAME);
        if (cookie == null) {
            return Optional.empty();
        }

        // TODO check for HttpOnly, isSecure, etc...
        // TODO sanity check cookie.getValue()

        return userStore.getSession(cookie.getValue());
    }

    private boolean hasRole(String role, Optional<AccountSession> accountSession, Optional<UserSession> userSession, Optional<AccountSession> superAdminSessionOpt, ContainerRequestContext requestContext) {
        boolean hasRole = hasRoleInternal(role, accountSession, userSession, superAdminSessionOpt, requestContext);
        if (hasRole) {
            log.debug("User does have role {}", role);
        } else {
            log.debug("User doesn't have role {}", role);
        }
        return hasRole;
    }

    private boolean hasRoleInternal(String role, Optional<AccountSession> accountSession, Optional<UserSession> userSession, Optional<AccountSession> superAdminSessionOpt, ContainerRequestContext requestContext) {
        Optional<String> pathParamProjectIdOpt = getPathParameter(requestContext, "projectId");
        Optional<String> pathParamUserIdOpt = getPathParameter(requestContext, "userId");
        Optional<String> headerAccountId = getHeaderParameter(requestContext, EXTERNAL_API_AUTH_HEADER_NAME_ACCOUNT_ID);
        Optional<String> headerAccountToken = getHeaderParameter(requestContext, EXTERNAL_API_AUTH_HEADER_NAME_TOKEN_ID);

        log.trace("hasRole role {} accountId {} userSession {} projectIdParam {} userIdParam {}",
                role, accountSession.map(AccountSession::getAccountId), userSession.map(UserSession::getUserId), pathParamProjectIdOpt, pathParamUserIdOpt);

        if (pathParamProjectIdOpt.isPresent() && userSession.isPresent()
                && !userSession.get().getProjectId().equals(pathParamProjectIdOpt.get())) {
            log.warn("Potential attack attempt, projectId {} in path param mismatches user {} session projectId {} for method {}",
                    pathParamProjectIdOpt.get(), userSession.get().getUserId(), userSession.get().getProjectId(), requestContext.getMethod());
            return false;
        }

        if (pathParamUserIdOpt.isPresent() && userSession.isPresent()
                && !userSession.get().getUserId().equals(pathParamUserIdOpt.get())) {
            log.warn("Potential attack attempt, userId {} in path param mismatches user session {} for method {}",
                    pathParamUserIdOpt.get(), userSession.get().getUserId(), requestContext.getMethod());
            return false;
        }

        Optional<AccountStore.Account> accountOpt;
        Optional<String> pathParamIdeaIdOpt;
        Optional<String> pathParamCommentIdOpt;
        switch (role) {
            case Role.SUPER_ADMIN:
                return superAdminSessionOpt.isPresent();
            case Role.ADMINISTRATOR_ACTIVE:
                if (headerAccountId.isPresent() && headerAccountToken.isPresent()) {
                    accountOpt = accountStore.getAccountByAccountId(headerAccountId.get());
                    if (!accountOpt.isPresent()) {
                        log.trace("Role {} missing account", role);
                        return false;
                    }

                    if (!headerAccountToken.get().equals(accountOpt.get().getApiKey())) {
                        log.trace("Role {} api key mismatch", role);
                        return false;
                    }
                } else {
                    if (!accountSession.isPresent()) {
                        log.trace("Role {} missing account session", role);
                        return false;
                    }
                    accountOpt = accountStore.getAccountByAccountId(accountSession.get().getAccountId());
                    if (!accountOpt.isPresent()) {
                        log.trace("Role {} missing account", role);
                        return false;
                    }
                }
                if (!Billing.SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(accountOpt.get().getStatus())) {
                    log.trace("Role {} inactive subscription", role);
                    return false;
                }
                return true;
            case Role.ADMINISTRATOR:
                if (headerAccountId.isPresent() && headerAccountToken.isPresent()) {
                    accountOpt = accountStore.getAccountByAccountId(headerAccountId.get());
                    if (!accountOpt.isPresent()) {
                        log.trace("Role {} missing account", role);
                        return false;
                    }
                    if (!headerAccountToken.get().equals(accountOpt.get().getApiKey())) {
                        log.trace("Role {} api key mismatch", role);
                        return false;
                    }
                } else {
                    if (!accountSession.isPresent()) {
                        log.trace("Role {} missing account session", role);
                        return false;
                    }
                }
                return true;
            case Role.USER:
                return userSession.isPresent();
            case Role.PROJECT_OWNER_ACTIVE:
            case Role.PROJECT_OWNER:
                if (!pathParamProjectIdOpt.isPresent()) {
                    log.trace("Role {} missing project id", role);
                    return false;
                }
                if (headerAccountId.isPresent() && headerAccountToken.isPresent()) {
                    accountOpt = accountStore.getAccountByAccountId(headerAccountId.get());
                    if (!accountOpt.isPresent()) {
                        log.trace("Role {} missing account", role);
                        return false;
                    }
                    if (!headerAccountToken.get().equals(accountOpt.get().getApiKey())) {
                        log.trace("Role {} api key mismatch", role);
                        return false;
                    }
                } else {
                    if (!accountSession.isPresent()) {
                        log.trace("Role {} missing account session", role);
                        return false;
                    }
                    accountOpt = accountStore.getAccountByAccountId(accountSession.get().getAccountId());
                    if (!accountOpt.isPresent()) {
                        log.trace("Role {} missing account", role);
                        return false;
                    }
                }
                if (role == Role.PROJECT_OWNER
                        || !Billing.SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(accountOpt.get().getStatus())) {
                    log.trace("Role {} inactive subscription", role);
                    return false;
                }
                return accountOpt.get().getProjectIds().stream().anyMatch(pathParamProjectIdOpt.get()::equals);
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
                return userSession.isPresent() && pathParamProjectIdOpt.isPresent()
                        && userSession.get().getProjectId().equals(pathParamProjectIdOpt.get())
                        && userSession.get().getIsMod() == Boolean.TRUE;
            case Role.PROJECT_MODERATOR_ACTIVE:
                accountOpt = projectStore.getProject(pathParamProjectIdOpt.get(), true)
                        .map(Project::getAccountId)
                        .flatMap(accountStore::getAccountByAccountId);
                if (!accountOpt.isPresent()) {
                    log.trace("Role {} missing account from projectId {}", role, pathParamProjectIdOpt.get());
                    return false;
                }
                if (!Billing.SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(accountOpt.get().getStatus())) {
                    log.trace("Role {} with inactive account status {}", role, accountOpt.get().getStatus());
                    return false;
                }
                return userSession.isPresent() && pathParamProjectIdOpt.isPresent()
                        && userSession.get().getProjectId().equals(pathParamProjectIdOpt.get())
                        && userSession.get().getIsMod() == Boolean.TRUE;
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
}
