// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.util.RealCookie;
import com.smotana.clearflask.util.RealCookie.SameSite;
import com.smotana.clearflask.web.resource.AccountResource;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Issues session cookies.
 * <p>
 * Security properties, all of which matter because customers can run arbitrary HTML/JS on their project subdomains
 * ({@code <slug>.clearflask.com}) while the dashboard lives on the parent domain:
 * <ul>
 *     <li>Cookies are host-only (no {@code Domain} attribute). A cookie set with {@code Domain=clearflask.com} is
 *     sent to every {@code *.clearflask.com} subdomain, which handed the dashboard session to any project's custom
 *     JS via same-origin {@code /api} calls.</li>
 *     <li>Account-level cookies use the {@code __Host-} prefix on secure deployments so a subdomain cannot plant a
 *     same-named cookie (session fixation / login CSRF / lockout) that would shadow the real one.</li>
 *     <li>Account-level cookies are {@code SameSite=Lax}: the dashboard is never embedded cross-site, so there is no
 *     reason to send them on cross-site requests. User cookies stay {@code SameSite=None} because project portals
 *     are legitimately embedded in iframes on customers' websites.</li>
 * </ul>
 */
@Slf4j
@Singleton
public class AuthCookieImpl implements AuthCookie {

    private static final String HOST_PREFIX = "__Host-";
    private static final ImmutableSet<String> ACCOUNT_LEVEL_COOKIE_NAMES = ImmutableSet.of(
            AccountResource.ACCOUNT_AUTH_COOKIE_NAME,
            AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME);

    public interface Config {
        @DefaultValue("true")
        boolean authCookieSecure();
    }

    @Inject
    private Config config;

    @Override
    public String wireName(String cookieName) {
        if (config.authCookieSecure() && ACCOUNT_LEVEL_COOKIE_NAMES.contains(cookieName)) {
            return HOST_PREFIX + cookieName;
        }
        return cookieName;
    }

    @Override
    public void setAuthCookie(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull String cookieName, @NonNull String sessionId, long ttlInEpochSec) {
        log.trace("Setting {} auth cookie for session id {} ttl {}",
                cookieName, sessionId, ttlInEpochSec);
        RealCookie.builder()
                .name(wireName(cookieName))
                .value(sessionId)
                .path("/")
                .secure(config.authCookieSecure())
                .httpOnly(true)
                .ttlInEpochSec(ttlInEpochSec)
                .sameSite(sameSiteFor(cookieName))
                .build()
                .addToResponse(response);
        expireLegacyDomainCookie(request, response, cookieName);
    }

    @Override
    public void unsetAuthCookie(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull String cookieName) {
        log.trace("Removing auth cookie for cookie name {}", cookieName);
        RealCookie.builder()
                .name(wireName(cookieName))
                .value("")
                .path("/")
                .secure(config.authCookieSecure())
                .httpOnly(true)
                .ttlInEpochSec(0L)
                .sameSite(sameSiteFor(cookieName))
                .build()
                .addToResponse(response);
        expireLegacyDomainCookie(request, response, cookieName);
    }

    private SameSite sameSiteFor(String cookieName) {
        if (!config.authCookieSecure()) {
            // SameSite=None requires Secure, fall back to the strictest mode
            return SameSite.STRICT;
        }
        return ACCOUNT_LEVEL_COOKIE_NAMES.contains(cookieName)
                ? SameSite.LAX
                : SameSite.NONE;
    }

    /**
     * Earlier releases set every auth cookie with an explicit {@code Domain} attribute. Browsers treat that as a
     * different cookie than the host-only cookie set above, so clear it explicitly or the two would coexist (and the
     * domain-wide one would keep leaking to subdomains until it expires).
     * <p>
     * TODO Remove a few releases after this shipped.
     */
    private void expireLegacyDomainCookie(HttpServletRequest request, HttpServletResponse response, String cookieName) {
        RealCookie.builder()
                .name(cookieName)
                .value("")
                .path("/")
                .domain(request.getServerName())
                .secure(config.authCookieSecure())
                .httpOnly(true)
                .ttlInEpochSec(0L)
                .sameSite(config.authCookieSecure() ? SameSite.NONE : SameSite.STRICT)
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
