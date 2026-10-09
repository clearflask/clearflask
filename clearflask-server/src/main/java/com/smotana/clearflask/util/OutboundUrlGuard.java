// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Strings;
import com.google.common.net.InetAddresses;
import com.google.common.io.ByteStreams;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.HttpEntity;
import org.apache.http.client.config.CookieSpecs;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.conn.DnsResolver;
import org.apache.http.impl.client.HttpClientBuilder;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.regex.Pattern;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;

/**
 * Guards server-side HTTP requests whose destination is chosen by a customer or user: OAuth provider endpoints from
 * project config, outbound webhook listeners, self-hosted GitLab instance URLs.
 * <p>
 * Without it, a project admin can point the server at the cloud metadata service, ElasticSearch, DynamoDB, KillBill or
 * anything else on the internal network and, in the OAuth case, read the response back through the JsonPath mapping
 * into the created user's name/email (SSRF).
 * <p>
 * Two layers:
 * <ul>
 *     <li>{@link #validate} is a cheap syntactic/literal-IP check for the moment a URL is saved so the admin gets
 *     immediate feedback.</li>
 *     <li>{@link #newClientBuilder} returns an HTTP client that re-checks every resolved address at connection time
 *     (which also defeats DNS rebinding), refuses to follow redirects (which would otherwise bypass the check), and
 *     bounds connect/read time.</li>
 * </ul>
 */
@Slf4j
@Singleton
public class OutboundUrlGuard {

    public interface Config {
        /**
         * Self-hosters whose OAuth provider or webhook receivers live on a private network can opt in. Never enable on
         * a multi-tenant deployment.
         */
        @DefaultValue("false")
        boolean allowPrivateAddresses();

        /** Plain http is only reasonable for local development. */
        @DefaultValue("false")
        boolean allowPlainHttp();

        @DefaultValue("PT10S")
        Duration connectTimeout();

        @DefaultValue("PT15S")
        Duration socketTimeout();

        /** Upper bound on any response body read from a customer-chosen URL. */
        @DefaultValue("1048576")
        long maxResponseBytes();
    }

    @Inject
    private Config config;

    /**
     * Validates that a customer-supplied URL is an acceptable destination for a server-side request.
     *
     * @param what Human readable name of the field for the error message, e.g. "Token URL"
     * @throws ApiException with BAD_REQUEST if the URL is not acceptable
     */
    public URI validate(String url, String what) {
        if (Strings.isNullOrEmpty(url)) {
            throw new ApiException(BAD_REQUEST, what + " is required");
        }
        URI uri;
        try {
            uri = new URI(url.trim());
        } catch (URISyntaxException ex) {
            throw new ApiException(BAD_REQUEST, what + " is not a valid URL");
        }
        if (!uri.isAbsolute() || Strings.isNullOrEmpty(uri.getHost())) {
            throw new ApiException(BAD_REQUEST, what + " must be an absolute URL with a host");
        }
        String scheme = uri.getScheme().toLowerCase();
        if (!"https".equals(scheme) && !(config.allowPlainHttp() && "http".equals(scheme))) {
            throw new ApiException(BAD_REQUEST, what + " must use https");
        }
        if (uri.getRawUserInfo() != null) {
            throw new ApiException(BAD_REQUEST, what + " must not contain credentials");
        }
        String host = stripBrackets(uri.getHost());
        if (!config.allowPrivateAddresses()) {
            if (isLocalHostname(host)) {
                throw new ApiException(BAD_REQUEST, what + " must not point to a local or private address");
            }
            // Literal IPs are checked right away; hostnames are checked at connection time by the DNS resolver
            InetAddress literal = parseLiteralAddress(host);
            if (literal != null && !isPublicAddress(literal)) {
                throw new ApiException(BAD_REQUEST, what + " must not point to a local or private address");
            }
        }
        return uri;
    }

    /**
     * Like {@link #validate} but additionally resolves the hostname now and checks every address. For clients that
     * cannot use {@link #newClientBuilder} (third party SDKs with their own HTTP stack).
     */
    public URI validateAndResolve(String url, String what) {
        URI uri = validate(url, what);
        if (!config.allowPrivateAddresses()) {
            try {
                for (InetAddress address : InetAddress.getAllByName(stripBrackets(uri.getHost()))) {
                    if (!isPublicAddress(address)) {
                        throw new ApiException(BAD_REQUEST, what + " must not point to a local or private address");
                    }
                }
            } catch (UnknownHostException ex) {
                throw new ApiException(BAD_REQUEST, what + " host cannot be resolved");
            }
        }
        return uri;
    }

    /**
     * HTTP client for requests to customer-chosen URLs: enforces the address policy on every DNS resolution, does not
     * follow redirects and has timeouts.
     */
    public HttpClientBuilder newClientBuilder() {
        return HttpClientBuilder.create()
                .disableRedirectHandling()
                .setDnsResolver(policyEnforcingDnsResolver())
                .setDefaultRequestConfig(RequestConfig.custom()
                        // Lenient cookie parsing, some providers send malformed expiry attributes
                        .setCookieSpec(CookieSpecs.STANDARD)
                        .setConnectTimeout((int) config.connectTimeout().toMillis())
                        .setConnectionRequestTimeout((int) config.connectTimeout().toMillis())
                        .setSocketTimeout((int) config.socketTimeout().toMillis())
                        .build());
    }

    /** Reads a response body as UTF-8, refusing to read more than the configured maximum. */
    public String readBodyBounded(HttpEntity entity) throws IOException {
        if (entity == null) {
            return "";
        }
        long max = config.maxResponseBytes();
        try (InputStream in = entity.getContent()) {
            byte[] bytes = ByteStreams.toByteArray(ByteStreams.limit(in, max + 1));
            if (bytes.length > max) {
                throw new IOException("Response exceeds maximum allowed size of " + max + " bytes");
            }
            return new String(bytes, StandardCharsets.UTF_8);
        }
    }

    @VisibleForTesting
    DnsResolver policyEnforcingDnsResolver() {
        return host -> {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            if (!config.allowPrivateAddresses()) {
                for (InetAddress address : addresses) {
                    if (!isPublicAddress(address)) {
                        log.info("Refusing outbound connection to {} resolving to non-public address {}", host, address.getHostAddress());
                        throw new UnknownHostException("Refusing to connect to non-public address for host " + host);
                    }
                }
            }
            return addresses;
        };
    }

    private static boolean isLocalHostname(String host) {
        String h = host.toLowerCase();
        return "localhost".equals(h)
                || h.endsWith(".localhost")
                || h.endsWith(".local")
                || h.endsWith(".internal")
                || (!h.contains(".") && !h.contains(":") && parseLiteralAddress(h) == null); // bare hostnames only resolve on the internal network
    }

    private static String stripBrackets(String host) {
        if (host.startsWith("[") && host.endsWith("]")) {
            return host.substring(1, host.length() - 1);
        }
        return host;
    }

    private static final Pattern NUMERIC_IPV4_SHORTHAND = Pattern.compile("^[0-9]+(\\.[0-9]+){0,3}$");

    /** Returns the address if the host is an IP literal (in any of the forms Java accepts), otherwise null. */
    @VisibleForTesting
    static InetAddress parseLiteralAddress(String host) {
        if (Strings.isNullOrEmpty(host)) {
            return null;
        }
        boolean isLiteral = InetAddresses.isInetAddress(host)
                // Java also accepts decimal IPv4 shorthand such as 2130706433 or 127.1 which attackers use to slip
                // past string based checks; these never hit DNS. (Java does not parse hex/octal forms, those are
                // treated as hostnames and resolved via DNS, where the resolver check applies.)
                || NUMERIC_IPV4_SHORTHAND.matcher(host).matches();
        if (!isLiteral) {
            return null;
        }
        try {
            return InetAddress.getByName(host);
        } catch (UnknownHostException ex) {
            return null;
        }
    }

    /**
     * Whether an address is routable on the public internet. Everything else (loopback, RFC1918, link-local incl.
     * cloud metadata 169.254.169.254, CGNAT, IPv6 ULA, multicast, reserved) is refused.
     */
    public static boolean isPublicAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return false;
        }
        byte[] b = address.getAddress();
        if (address instanceof Inet4Address || b.length == 4) {
            return isPublicIpv4(b);
        }
        if (address instanceof Inet6Address && b.length == 16) {
            // IPv4-mapped ::ffff:a.b.c.d
            if (isZero(b, 0, 10) && (b[10] & 0xFF) == 0xFF && (b[11] & 0xFF) == 0xFF) {
                return isPublicIpv4(Arrays.copyOfRange(b, 12, 16));
            }
            // IPv4-compatible ::a.b.c.d (deprecated)
            if (isZero(b, 0, 12)) {
                return isPublicIpv4(Arrays.copyOfRange(b, 12, 16));
            }
            // 64:ff9b::/96 NAT64, embeds an IPv4 address
            if ((b[0] & 0xFF) == 0x00 && (b[1] & 0xFF) == 0x64 && (b[2] & 0xFF) == 0xFF && (b[3] & 0xFF) == 0x9B && isZero(b, 4, 12)) {
                return isPublicIpv4(Arrays.copyOfRange(b, 12, 16));
            }
            // 2002::/16 6to4, embeds an IPv4 address
            if ((b[0] & 0xFF) == 0x20 && (b[1] & 0xFF) == 0x02) {
                return isPublicIpv4(Arrays.copyOfRange(b, 2, 6));
            }
            // fc00::/7 unique local
            if ((b[0] & 0xFE) == 0xFC) {
                return false;
            }
            // 2001:db8::/32 documentation
            if ((b[0] & 0xFF) == 0x20 && (b[1] & 0xFF) == 0x01 && (b[2] & 0xFF) == 0x0D && (b[3] & 0xFF) == 0xB8) {
                return false;
            }
            return true;
        }
        return false;
    }

    private static boolean isPublicIpv4(byte[] b) {
        int b0 = b[0] & 0xFF;
        int b1 = b[1] & 0xFF;
        int b2 = b[2] & 0xFF;
        if (b0 == 0) return false;                                    // 0.0.0.0/8 "this network"
        if (b0 == 10) return false;                                   // 10.0.0.0/8
        if (b0 == 127) return false;                                  // 127.0.0.0/8 loopback
        if (b0 == 100 && (b1 & 0xC0) == 0x40) return false;           // 100.64.0.0/10 carrier NAT
        if (b0 == 169 && b1 == 254) return false;                     // 169.254.0.0/16 link-local, cloud metadata
        if (b0 == 172 && (b1 & 0xF0) == 0x10) return false;           // 172.16.0.0/12
        if (b0 == 192 && b1 == 0 && b2 == 0) return false;            // 192.0.0.0/24 IETF protocol assignments
        if (b0 == 192 && b1 == 0 && b2 == 2) return false;            // 192.0.2.0/24 documentation
        if (b0 == 192 && b1 == 168) return false;                     // 192.168.0.0/16
        if (b0 == 198 && (b1 & 0xFE) == 0x12) return false;           // 198.18.0.0/15 benchmarking
        if (b0 == 198 && b1 == 51 && b2 == 100) return false;         // 198.51.100.0/24 documentation
        if (b0 == 203 && b1 == 0 && b2 == 113) return false;          // 203.0.113.0/24 documentation
        if (b0 >= 224) return false;                                  // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved, broadcast
        return true;
    }

    private static boolean isZero(byte[] b, int fromInclusive, int toExclusive) {
        for (int i = fromInclusive; i < toExclusive; i++) {
            if (b[i] != 0) {
                return false;
            }
        }
        return true;
    }

    private static final Module MODULE = new AbstractModule() {
        @Override
        protected void configure() {
            bind(OutboundUrlGuard.class).asEagerSingleton();
            install(ConfigSystem.configModule(Config.class));
        }
    };

    /**
     * Always returns the same instance so that every consumer module can install it without Guice complaining about
     * duplicate bindings.
     */
    public static Module module() {
        return MODULE;
    }
}
