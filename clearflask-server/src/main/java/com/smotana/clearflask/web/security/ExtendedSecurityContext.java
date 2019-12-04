package com.smotana.clearflask.web.security;

import com.smotana.clearflask.store.AccountStore;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.Optional;
import java.util.function.Predicate;

@Value
@Slf4j
public class ExtendedSecurityContext implements SecurityContext {
    @NonNull
    private final Principal userPrincipal;
    @NonNull
    private final Predicate<String> userHasRolePredicate;
    @NonNull
    private final boolean isSecure;
    private final String authenticationScheme = "COOKIE_TOKEN_AUTH";
    @NonNull
    private final Optional<AccountStore.Session> session;

    @Override
    public boolean isUserInRole(String role) {
        return this.userHasRolePredicate.test(role);
    }
}
