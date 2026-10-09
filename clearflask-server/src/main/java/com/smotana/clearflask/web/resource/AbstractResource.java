// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.annotations.VisibleForTesting;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Path;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
@SuppressWarnings("RestResourceMethodInspection")
public abstract class AbstractResource {

    @VisibleForTesting
    @Context
    HttpServletRequest request;
    @VisibleForTesting
    @Context
    HttpServletResponse response;
    @VisibleForTesting
    @Context
    SecurityContext securityContext;
    @Inject
    protected Sanitizer sanitizer;

    protected Optional<ExtendedPrincipal> getExtendedPrincipal() {
        if (securityContext.getUserPrincipal() == null) {
            return Optional.empty();
        }
        if (!(securityContext.getUserPrincipal() instanceof ExtendedPrincipal)) {
            log.warn("Request with no ExtendedPrincipal");
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR);
        }
        return Optional.of((ExtendedPrincipal) securityContext.getUserPrincipal());
    }

    /**
     * Guards endpoints that take a {@code userId} path parameter but are meant to act on the caller's own user.
     * Role checks only establish that <i>some</i> user of the project is logged in; without this, any user could
     * read or modify any other user in the same project by swapping the id in the URL.
     */
    protected void assertUserIsSelf(String userId) {
        String sessionUserId = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .orElseThrow(() -> new ApiException(Response.Status.UNAUTHORIZED, "Not logged in"));
        if (!sessionUserId.equals(userId)) {
            log.warn("User {} attempted to act on user {}", sessionUserId, userId);
            throw new ApiException(Response.Status.FORBIDDEN, "Cannot act on behalf of another user");
        }
    }
}
