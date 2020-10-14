package com.smotana.clearflask.web.security;

import com.google.common.annotations.VisibleForTesting;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.UserStore.UserSession;
import lombok.NonNull;
import lombok.Value;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.Optional;
import java.util.function.Predicate;

@NonFinal
@Value
@Slf4j
public class ExtendedSecurityContext implements SecurityContext {

    @Value
    public static class ExtendedPrincipal implements Principal {
        @NonNull
        private final String name;
        @NonNull
        private final String remoteIp;
        @NonNull
        private final Optional<AccountSession> accountSessionOpt;
        @NonNull
        private final Optional<AccountSession> superAdminSessionOpt;
        @NonNull
        private final Optional<UserSession> userSessionOpt;
    }

    private final ExtendedPrincipal userPrincipal;
    @NonNull
    private final Predicate<String> userHasRolePredicate;
    @NonNull
    private final ContainerRequestContext requestContext;
    private final String authenticationScheme = "COOKIE_TOKEN_AUTH";

    @VisibleForTesting
    protected ExtendedSecurityContext(ExtendedPrincipal userPrincipal, @NonNull Predicate<String> userHasRolePredicate, @NonNull ContainerRequestContext requestContext) {
        this.userPrincipal = userPrincipal;
        this.userHasRolePredicate = userHasRolePredicate;
        this.requestContext = requestContext;
    }

    public static ExtendedSecurityContext create(@NonNull String remoteIp, @NonNull Optional<AccountSession> accountSession, @NonNull Optional<AccountSession> superAdminSession, @NonNull Optional<UserSession> userSession, @NonNull Predicate<String> userHasRolePredicate, @NonNull ContainerRequestContext requestContext) {
        String name;
        if (accountSession.isPresent()) {
            name = accountSession.get().getAccountId();
        } else if (userSession.isPresent()) {
            name = userSession.get().getUserId();
        } else {
            name = remoteIp;
        }
        return new ExtendedSecurityContext(
                new ExtendedPrincipal(name, remoteIp, accountSession, superAdminSession, userSession),
                userHasRolePredicate,
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
