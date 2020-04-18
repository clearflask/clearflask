package com.smotana.clearflask.web.security;

import com.google.common.base.Strings;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.PlanStore;
import com.smotana.clearflask.store.UserStore;
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

    @Inject
    private UserResource.Config configUserResource;
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
    private PlanStore planStore;

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

        log.trace("Setting authenticated security context, email {} user id {}",
                accountSessionOpt.map(AccountSession::getEmail),
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
            if (accountSessionOpt.isPresent()) {
                Optional<String> pathParamProjectIdOpt = getPathParameter(requestContext, "projectId");
                if (pathParamProjectIdOpt.isPresent()) {
                    Optional<AccountStore.Account> accountOpt = accountStore.getAccount(accountSessionOpt.get().getEmail());
                    if (accountOpt.isPresent() && accountOpt.get().getProjectIds().contains(pathParamProjectIdOpt.get())) {
                        UserSession session = userStore.getOrCreateAccountOwnerSession(
                                pathParamProjectIdOpt.get(),
                                accountSessionOpt.get().getTtlInEpochSec());
                        return Optional.of(session);
                    }
                }
            }
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

        log.trace("hasRole role {} accountSession {} userSession {} projectIdParam {} userIdParam {}",
                role, accountSession.map(AccountSession::getEmail), userSession.map(UserSession::getUserId), pathParamProjectIdOpt, pathParamUserIdOpt);

        Optional<AccountStore.Account> accountOpt;
        Optional<String> pathParamIdeaIdOpt;
        Optional<String> pathParamCommentIdOpt;
        switch (role) {
            case Role.ADMINISTRATOR:
                return accountSession.isPresent();
            case Role.USER:
                return userSession.isPresent();
            case Role.PROJECT_OWNER:
                if (!accountSession.isPresent() || !pathParamProjectIdOpt.isPresent()) {
                    return false;
                }
                accountOpt = accountStore.getAccount(accountSession.get().getEmail());
                if (!accountOpt.isPresent()) {
                    return false;
                }
                return accountOpt.get().getProjectIds().stream().anyMatch(pathParamProjectIdOpt.get()::equals);
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
}
