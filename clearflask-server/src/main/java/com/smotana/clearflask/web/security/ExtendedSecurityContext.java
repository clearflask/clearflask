package com.smotana.clearflask.web.security;

import com.smotana.clearflask.store.AccountStore.Session;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.function.Predicate;

@Value
@Slf4j
public class ExtendedSecurityContext implements SecurityContext {

    @Value
    public static class ExtendedPrincipal implements Principal {
        @NonNull
        private final String name;
        @NonNull
        private final Session session;
    }

    private final Principal userPrincipal;
    @NonNull
    private final Predicate<String> userHasRolePredicate;
    @NonNull
    private final ContainerRequestContext requestContext;
    private final String authenticationScheme = "COOKIE_TOKEN_AUTH";

    private ExtendedSecurityContext(Principal userPrincipal, @NonNull Predicate<String> userHasRolePredicate, @NonNull ContainerRequestContext requestContext) {
        this.userPrincipal = userPrincipal;
        this.userHasRolePredicate = userHasRolePredicate;
        this.requestContext = requestContext;
    }

    public static ExtendedSecurityContext authenticated(@NonNull Session session, @NonNull Predicate<String> userHasRolePredicate, @NonNull ContainerRequestContext requestContext) {
        return new ExtendedSecurityContext(
                new ExtendedPrincipal(session.getAccountId(), session),
                userHasRolePredicate,
                requestContext);
    }

    public static ExtendedSecurityContext notAuthenticated(@NonNull ContainerRequestContext requestContext) {
        return new ExtendedSecurityContext(
                null,
                role -> false,
                requestContext);
    }

    @Override
    public boolean isSecure() {
        return requestContext
                .getUriInfo()
                .getAbsolutePath()
                .toString()
                .toLowerCase()
                .startsWith("https");
    }

    @Override
    public boolean isUserInRole(String role) {
        return this.userHasRolePredicate.test(role);
    }
}
