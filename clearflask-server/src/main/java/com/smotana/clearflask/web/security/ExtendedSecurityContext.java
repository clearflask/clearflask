// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.security;

import com.google.common.annotations.VisibleForTesting;
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

        /** Present if request is authenticated */
        @NonNull
        Optional<String> authenticatedAccountIdOpt;
        /** Present if request is super authenticated */
        @NonNull
        Optional<String> authenticatedSuperAccountIdOpt;
        /** Present if request is user authenticated */
        @NonNull
        Optional<UserSession> authenticatedUserIdOpt;

        /** Only present if session is used (not by API) */
        @NonNull
        Optional<AccountSession> accountSessionOpt;
        /** Only present if session is used (not by API) */
        @NonNull
        Optional<AccountSession> superAccountSessionOpt;
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
            String remoteIp,
            Optional<String> authenticatedAccountIdOpt,
            Optional<String> authenticatedSuperAccountIdOpt,
            Optional<UserSession> authenticatedUserSessionOpt,
            Optional<AccountSession> accountSessionOpt,
            Optional<AccountSession> superAccountSessionOpt,
            Predicate<String> userHasRolePredicate,
            ContainerRequestContext requestContext) {
        return new ExtendedSecurityContext(
                new ExtendedPrincipal(
                        authenticatedAccountIdOpt
                                .or(() -> authenticatedUserSessionOpt.map(UserSession::getUserId))
                                .orElse(remoteIp),
                        remoteIp,
                        authenticatedAccountIdOpt,
                        authenticatedSuperAccountIdOpt,
                        authenticatedUserSessionOpt,
                        accountSessionOpt,
                        superAccountSessionOpt),
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
