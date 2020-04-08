package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.util.RealCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Path;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
public abstract class AbstractResource {

    @Context
    protected HttpServletRequest request;
    @Context
    protected HttpServletResponse response;
    @Context
    protected SecurityContext securityContext;

    protected Optional<ExtendedPrincipal> getExtendedPrincipal() {
        if (securityContext.getUserPrincipal() == null) {
            return Optional.empty();
        }
        if (!(securityContext.getUserPrincipal() instanceof ExtendedPrincipal)) {
            log.error("Request with no ExtendedPrincipal");
            throw new WebApplicationException(Response.status(Response.Status.INTERNAL_SERVER_ERROR).build());
        }
        return Optional.of((ExtendedPrincipal) securityContext.getUserPrincipal());
    }

    protected void setAuthCookie(@NonNull String cookieName, @NonNull String sessionId, long ttlInEpochSec) {
        log.trace("Setting {} auth cookie for session id {} ttl {}",
                cookieName, sessionId, ttlInEpochSec);
        RealCookie.builder()
                .name(cookieName)
                .value(sessionId)
                .path("/")
                .secure(securityContext.isSecure())
                .httpOnly(true)
                .ttlInEpochSec(ttlInEpochSec)
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

    protected void unsetAuthCookie(@NonNull String cookieName) {
        log.trace("Removing account auth cookie");
        RealCookie.builder()
                .name(cookieName)
                .value("")
                .path("/")
                .secure(securityContext.isSecure())
                .httpOnly(true)
                .ttlInEpochSec(0L)
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

}
