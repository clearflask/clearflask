package com.smotana.clearflask.web.security;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.web.resource.UserResource;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.Priority;
import javax.inject.Inject;
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
    private static final String EXTERNAL_API_AUTH_HEADER_NAME_ACCOUNT_ID = "";
    private static final String EXTERNAL_API_AUTH_HEADER_NAME_TOKEN_ID = "";
    private static final ImmutableSet<SubscriptionStatus> SUBSCRIPTION_STATUS_ACTIVE_ENUMS = Sets.immutableEnumSet(
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.ACTIVENORENEWAL,
            SubscriptionStatus.ACTIVEPAYMENTRETRY,
            SubscriptionStatus.ACTIVETRIAL);

    @Context
    protected HttpServletResponse response;
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
        requestContext.setSecurityContext(authenticate(requestContext));
    }

    private ExtendedSecurityContext authenticate(ContainerRequestContext requestContext) throws IOException {
        Optional<AccountSession> accountSessionOpt = authenticateAccount(requestContext);
        Optional<UserSession> userSessionOpt = authenticateUser(accountSessionOpt, requestContext);

        if (!accountSessionOpt.isPresent() && !userSessionOpt.isPresent()) {
            return ExtendedSecurityContext.notAuthenticated(requestContext);
        }

        log.trace("Setting authenticated security context, accountId {} userId {}",
                accountSessionOpt.map(AccountSession::getAccountId),
                userSessionOpt.map(UserSession::getUserId));
        return ExtendedSecurityContext.authenticated(
                accountSessionOpt,
                userSessionOpt,
                role -> hasRole(role, accountSessionOpt, userSessionOpt, requestContext),
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

    private Optional<UserSession> authenticateUser(Optional<AccountSession> accountSessionOpt, ContainerRequestContext requestContext) {
        Cookie cookie = requestContext.getCookies().get(UserResource.USER_AUTH_COOKIE_NAME);
        if (cookie == null) {
            return Optional.empty();
        }

        // TODO check for HttpOnly, isSecure, etc...

        // TODO sanity check cookie.getValue()

        return userStore.getSession(cookie.getValue());
    }

    private boolean hasRole(String role, Optional<AccountSession> accountSession, Optional<UserSession> userSession, ContainerRequestContext requestContext) {
        boolean hasRole = hasRoleInternal(role, accountSession, userSession, requestContext);
        if (hasRole) {
            log.debug("User does have role {}", role);
        } else {
            log.info("User doesn't have role {}", role);
        }
        return hasRole;
    }

    private boolean hasRoleInternal(String role, Optional<AccountSession> accountSession, Optional<UserSession> userSession, ContainerRequestContext requestContext) {
        log.trace("Checking if user has role {}", role);

        Optional<String> pathParamProjectIdOpt = getPathParameter(requestContext, "projectId");
        Optional<String> pathParamUserIdOpt = getPathParameter(requestContext, "userId");
        Optional<String> headerAccountId = getHeaderParameter(requestContext, "x-cf-account");
        Optional<String> headerAccountToken = getHeaderParameter(requestContext, "x-cf-secret");

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

        log.trace("hasRole role {} accountId {} userSession {} projectIdParam {} userIdParam {}",
                role, accountSession.map(AccountSession::getAccountId), userSession.map(UserSession::getUserId), pathParamProjectIdOpt, pathParamUserIdOpt);

        Optional<AccountStore.Account> accountOpt;
        Optional<String> pathParamIdeaIdOpt;
        Optional<String> pathParamCommentIdOpt;
        switch (role) {
            case Role.ADMINISTRATOR_ACTIVE:
                if (headerAccountId.isPresent() && headerAccountToken.isPresent()) {
                    accountOpt = accountStore.getAccountByAccountId(headerAccountId.get());
                    if (!accountOpt.isPresent()) {
                        return false;
                    }

                    if (!headerAccountToken.get().equals(accountOpt.get().getApiKey())) {
                        return false;
                    }
                } else {
                    if (!accountSession.isPresent()) {
                        return false;
                    }
                    accountOpt = accountStore.getAccountByAccountId(accountSession.get().getAccountId());
                    if (!accountOpt.isPresent()) {
                        return false;
                    }
                }
                if (!SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(accountOpt.get().getStatus())) {
                    return false;
                }
                return true;
            case Role.ADMINISTRATOR:
                if (headerAccountId.isPresent() && headerAccountToken.isPresent()) {
                    accountOpt = accountStore.getAccountByAccountId(headerAccountId.get());
                    if (!accountOpt.isPresent()) {
                        return false;
                    }
                    if (!headerAccountToken.get().equals(accountOpt.get().getApiKey())) {
                        return false;
                    }
                } else {
                    if (!accountSession.isPresent()) {
                        return false;
                    }
                }
                return true;
            case Role.USER:
                return userSession.isPresent();
            case Role.PROJECT_OWNER_ACTIVE:
            case Role.PROJECT_OWNER:
                if (!pathParamProjectIdOpt.isPresent()) {
                    return false;
                }
                if (headerAccountId.isPresent() && headerAccountToken.isPresent()) {
                    accountOpt = accountStore.getAccountByAccountId(headerAccountId.get());
                    if (!accountOpt.isPresent()) {
                        return false;
                    }
                    if (!headerAccountToken.get().equals(accountOpt.get().getApiKey())) {
                        return false;
                    }
                } else {
                    if (!accountSession.isPresent()) {
                        return false;
                    }
                    accountOpt = accountStore.getAccountByAccountId(accountSession.get().getAccountId());
                    if (!accountOpt.isPresent()) {
                        return false;
                    }
                }
                if (role == Role.PROJECT_OWNER
                        || !SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(accountOpt.get().getStatus())) {
                    return false;
                }
                return accountOpt.get().getProjectIds().stream().anyMatch(pathParamProjectIdOpt.get()::equals);
            case Role.PROJECT_ANON:
                if (!pathParamProjectIdOpt.isPresent()) {
                    log.warn("Possible misconfiguration, role {} requested, but no projectId path param found in {}",
                            role, requestContext.getUriInfo().getRequestUri());
                    return false;
                }
                Optional<ProjectStore.Project> projectOpt = projectStore.getProject(pathParamProjectIdOpt.get(), true);
                if (!projectOpt.isPresent()) {
                    return false;
                }
                Onboarding.VisibilityEnum visibility = projectOpt.get()
                        .getVersionedConfigAdmin()
                        .getConfig()
                        .getUsers()
                        .getOnboarding()
                        .getVisibility();
                return Onboarding.VisibilityEnum.PUBLIC.equals(visibility);
            case Role.PROJECT_USER:
                return userSession.isPresent() && pathParamProjectIdOpt.isPresent();
            case Role.IDEA_OWNER:
                pathParamIdeaIdOpt = getPathParameter(requestContext, "ideaId");
                if (!userSession.isPresent() || !pathParamIdeaIdOpt.isPresent()) {
                    return false;
                }
                Optional<IdeaStore.IdeaModel> idea = ideaStore.getIdea(userSession.get().getProjectId(), pathParamIdeaIdOpt.get());
                return idea.isPresent() && idea.get().getAuthorUserId().equals(userSession.get().getUserId());
            case Role.COMMENT_OWNER:
                pathParamIdeaIdOpt = getPathParameter(requestContext, "ideaId");
                pathParamCommentIdOpt = getPathParameter(requestContext, "commentId");
                if (!userSession.isPresent() || !pathParamIdeaIdOpt.isPresent() || !pathParamCommentIdOpt.isPresent()) {
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
