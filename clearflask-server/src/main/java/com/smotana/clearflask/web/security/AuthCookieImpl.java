// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.util.RealCookie;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.servlet.http.HttpServletResponse;

@Slf4j
@Singleton
public class AuthCookieImpl implements AuthCookie {

    public interface Config {
        @DefaultValue("true")
        boolean authCookieSecure();
    }

    @Inject
    private Config config;

    @Override
    public void setAuthCookie(@NonNull HttpServletResponse response, @NonNull String cookieName, @NonNull String sessionId, long ttlInEpochSec) {
        log.trace("Setting {} auth cookie for session id {} ttl {}",
                cookieName, sessionId, ttlInEpochSec);
        RealCookie.builder()
                .name(cookieName)
                .value(sessionId)
                .path("/")
                .secure(config.authCookieSecure())
                .httpOnly(true)
                .ttlInEpochSec(ttlInEpochSec)
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

    @Override
    public void unsetAuthCookie(@NonNull HttpServletResponse response, @NonNull String cookieName) {
        log.trace("Removing account auth cookie");
        RealCookie.builder()
                .name(cookieName)
                .value("")
                .path("/")
                .secure(config.authCookieSecure())
                .httpOnly(true)
                .ttlInEpochSec(0L)
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AuthCookie.class).to(AuthCookieImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
