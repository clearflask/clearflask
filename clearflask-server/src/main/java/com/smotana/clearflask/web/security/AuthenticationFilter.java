package com.smotana.clearflask.web.security;

import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.web.security.AuthCookieUtil.AuthCookieValue;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.Priority;
import javax.inject.Inject;
import javax.ws.rs.Priorities;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.Cookie;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.Optional;

@Slf4j
@Provider
@Priority(Priorities.AUTHENTICATION)
public class AuthenticationFilter implements ContainerRequestFilter {

    @Inject
    private AccountStore accountStore;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        requestContext.setSecurityContext(authenticate(requestContext));
    }

    private ExtendedSecurityContext authenticate(ContainerRequestContext requestContext) throws IOException {

        Cookie cookie = requestContext.getCookies().get(AccountResource.ACCOUNT_AUTH_COOKIE_NAME);

        if (cookie == null) {
            log.trace("AuthCookie not present on request");
            return ExtendedSecurityContext.notAuthenticated(requestContext);
        }

        // TODO check for HttpOnly, isSecure, etc...

        Optional<AuthCookieValue> authCookieOpt = AuthCookieUtil.decode(cookie.getValue());
        if (!authCookieOpt.isPresent()) {
            log.trace("AuthCookie was not parsed correctly");
            return ExtendedSecurityContext.notAuthenticated(requestContext);
        }
        AuthCookieValue authCookieValue = authCookieOpt.get();

        switch (authCookieValue.getType()) {
            case ACCOUNT:
                Optional<AccountStore.Session> sessionOpt = accountStore.getSession(authCookieValue.getAccountId(), authCookieValue.getSessionId());
                if (!sessionOpt.isPresent()) {
                    log.trace("Session not found for cookie type {} account {}", authCookieValue.getType(), authCookieValue.getAccountId());
                    return ExtendedSecurityContext.notAuthenticated(requestContext);
                }
                Principal principal = () -> sessionOpt.get().getAccountId();
                log.trace("Setting security context, cookie type {} account {}", authCookieValue.getType(), authCookieValue.getAccountId());
                return ExtendedSecurityContext.authenticated(
                        sessionOpt.get(),
                        role -> userHasRole(role, authCookieValue, requestContext),
                        requestContext);
            case USER:
                // TODO implement
            default:
        }

        return ExtendedSecurityContext.notAuthenticated(requestContext);
    }

    private boolean userHasRole(String role, AuthCookieValue authCookieValue, ContainerRequestContext requestContext) {
        log.trace("Checking if user has role {}", role);
        Optional<AccountStore.Account> accountOpt;
        switch (role) {
            case Role.ADMINISTRATOR:
                if (authCookieValue.getType() == AuthCookieUtil.Type.ACCOUNT) {
                    log.trace("User does have role {}", role);
                    return true;
                } else {
                    log.trace("User doesn't have role {}", role);
                    return false;
                }
            case Role.USER:
                if (authCookieValue.getType() == AuthCookieUtil.Type.USER) {
                    log.trace("User does have role {}", role);
                    return true;
                } else {
                    log.trace("User doesn't have role {}", role);
                    return false;
                }
            case Role.PROJECT_OWNER:
                List<String> projectIdParams = requestContext.getUriInfo().getPathParameters().get("project");
                if (projectIdParams == null || projectIdParams.size() != 1) {
                    return false;
                }
                String projectId = projectIdParams.get(0);

                accountOpt = accountStore.getAccount(authCookieValue.getAccountId());
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
