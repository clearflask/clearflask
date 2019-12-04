package com.smotana.clearflask.web.security;

import com.google.inject.Inject;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.web.resource.api.AccountResource;
import com.smotana.clearflask.web.security.AuthCookieUtil.AuthCookie;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.core.Cookie;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.Optional;

@Slf4j
@Provider
public class AuthenticationFilter implements ContainerRequestFilter {

    @Inject
    private AuthCookieUtil authCookieUtil;
    @Inject
    private AccountStore accountStore;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        Cookie cookie = requestContext.getCookies().get(AccountResource.ACCOUNT_AUTH_COOKIE_NAME);

        if (cookie == null) {
            return;
        }

        // TODO check for HttpOnly

        AuthCookie authCookie = authCookieUtil.decode(cookie.getValue());

        boolean isSecure = requestContext
                .getUriInfo()
                .getAbsolutePath()
                .toString()
                .toLowerCase()
                .startsWith("https");
        switch (authCookie.getType()) {
            case ACCOUNT:
                Optional<AccountStore.Session> sessionOpt = accountStore.getSession(authCookie.getAccountId(), authCookie.getSessionId());
                if (!sessionOpt.isPresent()) {
                    throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED).build());
                }
                Principal principal = () -> sessionOpt.get().getSessionId();
                requestContext.setSecurityContext(new ExtendedSecurityContext(
                        principal,
                        role -> userHasRole(requestContext, role),
                        isSecure,
                        sessionOpt));
                break;
            case USER:
                // TODO requestContext.setSecurityContext(...);
                break;
            default:
                throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED).build());
        }
    }

    private boolean userHasRole(ContainerRequestContext requestContext, String role) {

        switch (role) {
            case Role.ADMINISTRATOR:
                break;
            case Role.PROJECT_OWNER:
                List<String> projectParams = requestContext.getUriInfo().getPathParameters().get("project");
                if (projectParams == null || projectParams.size() != 1) {
                    return false;
                }
                String project = projectParams.get(0);
                // TODO
                break;
            case Role.USER:
                break;
            case Role.IDEA_OWNER:
                break;
            case Role.COMMENT_OWNER:
                break;
            default:
                return false;
        }

        return false; // TODO
    }
}
