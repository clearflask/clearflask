// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.security;

import com.google.common.annotations.VisibleForTesting;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.UserStore.UserSession;
import lombok.Builder;
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
    @Builder(toBuilder = true)
    public static class ExtendedPrincipal implements Principal {
        @NonNull
        String name;
        @NonNull
        String remoteIp;
        @NonNull
        Optional<AccountSession> accountSessionOpt;
        @NonNull
        Optional<AccountSession> superAccountSessionOpt;
        @NonNull
        Optional<Account> accountOpt;
        @NonNull
        Optional<Account> superAccountOpt;
        @NonNull
        Optional<UserSession> userSessionOpt;
    }

    ExtendedPrincipal userPrincipal;
    @NonNull
    Predicate<String> userHasRolePredicate;
    @NonNull
    ContainerRequestContext requestContext;
    String authenticationScheme = "COOKIE_TOKEN_AUTH";

    @VisibleForTesting
    protected ExtendedSecurityContext(ExtendedPrincipal userPrincipal, @NonNull Predicate<String> userHasRolePredicate, @NonNull ContainerRequestContext requestContext) {
        this.userPrincipal = userPrincipal;
        this.userHasRolePredicate = userHasRolePredicate;
        this.requestContext = requestContext;
    }

    public static ExtendedSecurityContext create(
            @NonNull String remoteIp,
            @NonNull Optional<AccountSession> accountSession,
            @NonNull Optional<AccountSession> superAccountSession,
            @NonNull Optional<Account> account,
            @NonNull Optional<Account> superAccount,
            @NonNull Optional<UserSession> userSession,
            @NonNull Predicate<String> userHasRolePredicate,
            @NonNull ContainerRequestContext requestContext) {
        String name;
        if (account.isPresent()) {
            name = account.get().getAccountId();
        } else if (userSession.isPresent()) {
            name = userSession.get().getUserId();
        } else {
            name = remoteIp;
        }
        return new ExtendedSecurityContext(
                new ExtendedPrincipal(
                        name,
                        remoteIp,
                        accountSession,
                        superAccountSession,
                        account,
                        superAccount,
                        userSession),
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
