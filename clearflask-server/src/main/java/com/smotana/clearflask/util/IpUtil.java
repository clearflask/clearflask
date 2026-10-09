// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Strings;
import com.google.common.net.InetAddresses;
import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.InternalServerErrorException;
import java.util.Optional;

/**
 * Resolves the client IP that rate limiting, challenges and anti-spam key on.
 * <p>
 * {@code X-Forwarded-For} is attacker-controlled up to the point where a proxy we trust appends to it. Every
 * trusted proxy in front of the server appends exactly one entry, so the client address is the Nth entry from the
 * right where N is the number of trusted proxies. Taking anything further left (or the first entry) lets a client
 * pick its own "IP" and sidestep every per-IP control.
 */
@Slf4j
public class IpUtil {

    /** Number of proxies that append to X-Forwarded-For; overrides the per-environment default. */
    public static final String ENV_TRUSTED_PROXY_COUNT = "CLEARFLASK_TRUSTED_PROXY_COUNT";

    private IpUtil() {
    }

    public static String getRemoteIp(HttpServletRequest request, ServiceInjector.Environment env) {
        return getRemoteIp(request, env, System.getenv(ENV_TRUSTED_PROXY_COUNT));
    }

    @VisibleForTesting
    static String getRemoteIp(HttpServletRequest request, ServiceInjector.Environment env, String trustedProxyCountOverride) {
        String remoteIp;
        switch (env) {
            case PRODUCTION_AWS:
            case PRODUCTION_SELF_HOST:
            case PRODUCTION_PLATFORM:
                remoteIp = fromForwardedFor(
                        request.getHeader("x-forwarded-for"),
                        trustedProxyCount(env, trustedProxyCountOverride))
                        .orElseGet(request::getRemoteAddr);
                break;
            case TEST:
            case DEVELOPMENT_LOCAL:
                remoteIp = request.getRemoteAddr();
                break;
            default:
                throw new InternalServerErrorException("Unknown environment: " + env);
        }
        if (log.isTraceEnabled()) {
            log.trace("Got remote IP {} from remoteAddr {} and x-forwarded-for {}",
                    remoteIp, request.getRemoteAddr(), request.getHeader("x-forwarded-for"));
        }
        if (!InetAddresses.isInetAddress(remoteIp)) {
            throw new InternalServerErrorException("Not a valid remote IP: " + remoteIp);
        }
        return remoteIp;
    }

    /**
     * In every production environment Connect is the only proxy that appends an entry (http-proxy {@code xfwd});
     * the cloud host has no load balancer or CDN in front of it. Anything a client sent sits further left and is
     * ignored. Installs with a load balancer in front of Connect set {@link #ENV_TRUSTED_PROXY_COUNT}.
     */
    @VisibleForTesting
    static int trustedProxyCount(ServiceInjector.Environment env, String override) {
        if (!Strings.isNullOrEmpty(override)) {
            try {
                int count = Integer.parseInt(override.trim());
                if (count >= 1) {
                    return count;
                }
                log.warn("{} must be at least 1, got {}", ENV_TRUSTED_PROXY_COUNT, override);
            } catch (NumberFormatException ex) {
                log.warn("{} is not a number: {}", ENV_TRUSTED_PROXY_COUNT, override);
            }
        }
        return 1;
    }

    /**
     * @return the client entry of the header, or empty if the header is missing or too short to contain one (e.g. a
     * request that bypassed the proxies entirely), in which case the socket address is the best answer
     */
    @VisibleForTesting
    static Optional<String> fromForwardedFor(String xForwardedFor, int trustedProxyCount) {
        if (Strings.isNullOrEmpty(xForwardedFor)) {
            return Optional.empty();
        }
        String[] ips = xForwardedFor.split(",");
        if (ips.length < trustedProxyCount) {
            // Fewer entries than proxies: a trusted proxy did not see this request, so none of the header is trustworthy
            return Optional.empty();
        }
        String candidate = ips[ips.length - trustedProxyCount].trim();
        return Strings.isNullOrEmpty(candidate) ? Optional.empty() : Optional.of(candidate);
    }
}
