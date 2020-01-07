package com.smotana.clearflask.web.security;

import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.web.resource.UserResource;
import com.smotana.clearflask.web.security.AuthCookieUtil.AccountAuthCookie;
import com.smotana.clearflask.web.security.AuthCookieUtil.UserAuthCookie;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.Priority;
import javax.inject.Inject;
import javax.ws.rs.Priorities;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
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
    private AccountStore accountStore;
    @Inject
    private UserStore userStore;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        requestContext.setSecurityContext(authenticate(requestContext));
    }

    private ExtendedSecurityContext authenticate(ContainerRequestContext requestContext) throws IOException {
        Optional<AccountStore.Session> accountSession = authenticateAccount(requestContext);
        Optional<UserStore.UserSession> userSession = authenticateUser(requestContext);

        if (!accountSession.isPresent() && !userSession.isPresent()) {
            return ExtendedSecurityContext.notAuthenticated(requestContext);
        }

        log.trace("Setting authenticated security context, account id {} user id {}",
                accountSession.map(AccountStore.Session::getAccountId),
                userSession.map(UserStore.UserSession::getUserId));
        return ExtendedSecurityContext.authenticated(
                accountSession,
                userSession,
                role -> hasRole(role, accountSession, userSession, requestContext),
                requestContext);
    }

    private Optional<AccountStore.Session> authenticateAccount(ContainerRequestContext requestContext) {
        Cookie cookie = requestContext.getCookies().get(AccountResource.ACCOUNT_AUTH_COOKIE_NAME);
        if (cookie == null) {
            return Optional.empty();
        }

        // TODO check for HttpOnly, isSecure, etc...

        Optional<AccountAuthCookie> authCookieOpt = AuthCookieUtil.decodeAccount(cookie.getValue());
        if (!authCookieOpt.isPresent()) {
            log.info("AuthCookie for account session was not parsed correctly");
            return Optional.empty();
        }
        AccountAuthCookie authCookie = authCookieOpt.get();

        Optional<AccountStore.Session> sessionOpt = accountStore.getSession(authCookie.getAccountId(), authCookie.getSessionId());
        if (!sessionOpt.isPresent()) {
            log.trace("Cookie session not found for account {}", authCookie.getAccountId());
            return Optional.empty();
        }

        return sessionOpt;
    }

    private Optional<UserStore.UserSession> authenticateUser(ContainerRequestContext requestContext) {
        Cookie cookie = requestContext.getCookies().get(UserResource.USER_AUTH_COOKIE_NAME);
        if (cookie == null) {
            return Optional.empty();
        }

        // TODO check for HttpOnly, isSecure, etc...

        Optional<UserAuthCookie> authCookieOpt = AuthCookieUtil.decodeUser(cookie.getValue());
        if (!authCookieOpt.isPresent()) {
            log.info("AuthCookie for user session was not parsed correctly");
            return Optional.empty();
        }
        UserAuthCookie authCookie = authCookieOpt.get();

        Optional<UserStore.UserSession> sessionOpt = userStore.getSession(authCookie.getProjectId(), authCookie.getUserId(), authCookie.getSessionId());
        if (!sessionOpt.isPresent()) {
            log.trace("Cookie session not found for project {} user {}", authCookie.getProjectId(), authCookie.getUserId());
            return Optional.empty();
        }

        return sessionOpt;
    }

    private boolean hasRole(String role, Optional<AccountStore.Session> accountSession, Optional<UserStore.UserSession> userSession, ContainerRequestContext requestContext) {
        boolean hasRole = hasRoleInternal(role, accountSession, userSession, requestContext);
        if (hasRole) {
            log.trace("User does have role {}", role);
        } else {
            log.trace("User doesn't have role {}", role);
        }
        return hasRole;
    }

    private boolean hasRoleInternal(String role, Optional<AccountStore.Session> accountSession, Optional<UserStore.UserSession> userSession, ContainerRequestContext requestContext) {
        log.trace("Checking if user has role {}", role);
        Optional<AccountStore.Account> accountOpt;
        switch (role) {
            case Role.ADMINISTRATOR:
                return accountSession.isPresent();
            case Role.USER:
                return userSession.isPresent();
            case Role.PROJECT_OWNER:
                if (!accountSession.isPresent()) {
                    return false;
                }

                List<String> projectIdParams = requestContext.getUriInfo().getPathParameters().get("project");
                if (projectIdParams == null || projectIdParams.size() != 1) {
                    return false;
                }
                String projectId = projectIdParams.get(0);

                accountOpt = accountStore.getAccount(accountSession.get().getAccountId());
                if (!accountOpt.isPresent()) {
                    return false;
                }

                return accountOpt.get().getProjectIds().stream().anyMatch(projectId::equals);
            default:
            case Role.PROJECT_USER:
            case Role.IDEA_OWNER:
            case Role.COMMENT_OWNER:
            case Role.PROJECT_OWNER_PLAN_BASIC:
//                accountOpt = accountStore.getAccount(authCookie.getAccountId());
//                if (!accountOpt.isPresent()) {
//                    return false;
//                }
//                break;
            case Role.PROJECT_OWNER_PLAN_ANALYTIC:
            case Role.PROJECT_OWNER_PLAN_ENTERPRISE:
                // TODO
                return false;
        }
    }
}
