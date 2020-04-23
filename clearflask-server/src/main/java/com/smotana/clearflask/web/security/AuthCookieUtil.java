package com.smotana.clearflask.web.security;

import com.smotana.clearflask.util.RealCookie;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.servlet.http.HttpServletResponse;

@Slf4j
@Singleton
public class AuthCookieUtil {

    public void setAuthCookie(@NonNull HttpServletResponse response, @NonNull String cookieName, @NonNull String sessionId, long ttlInEpochSec) {
        log.trace("Setting {} auth cookie for session id {} ttl {}",
                cookieName, sessionId, ttlInEpochSec);
        RealCookie.builder()
                .name(cookieName)
                .value(sessionId)
                .path("/")
                .secure(true)
                .httpOnly(true)
                .ttlInEpochSec(ttlInEpochSec)
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

    public void unsetAuthCookie(@NonNull HttpServletResponse response, @NonNull String cookieName) {
        log.trace("Removing account auth cookie");
        RealCookie.builder()
                .name(cookieName)
                .value("")
                .path("/")
                .secure(true)
                .httpOnly(true)
                .ttlInEpochSec(0L)
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

}
