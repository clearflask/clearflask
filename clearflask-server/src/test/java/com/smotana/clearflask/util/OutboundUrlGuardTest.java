// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.inject.Guice;
import com.smotana.clearflask.web.ApiException;
import org.junit.Test;
import org.mockito.Mockito;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class OutboundUrlGuardTest {

    private OutboundUrlGuard create(boolean allowPrivate, boolean allowHttp) {
        OutboundUrlGuard.Config config = Mockito.mock(OutboundUrlGuard.Config.class);
        Mockito.when(config.allowPrivateAddresses()).thenReturn(allowPrivate);
        Mockito.when(config.allowPlainHttp()).thenReturn(allowHttp);
        Mockito.when(config.connectTimeout()).thenReturn(Duration.ofSeconds(5));
        Mockito.when(config.socketTimeout()).thenReturn(Duration.ofSeconds(5));
        Mockito.when(config.maxResponseBytes()).thenReturn(1024L);
        return Guice.createInjector(binder -> binder.bind(OutboundUrlGuard.Config.class).toInstance(config))
                .getInstance(OutboundUrlGuard.class);
    }

    private void assertRejected(OutboundUrlGuard guard, String url) {
        ApiException ex = assertThrows(url, ApiException.class, () -> guard.validate(url, "URL"));
        assertEquals(url, 400, ex.getStatus().getStatusCode());
    }

    @Test
    public void acceptsPublicHttps() {
        OutboundUrlGuard guard = create(false, false);
        assertNotNull(guard.validate("https://accounts.google.com/o/oauth2/token", "URL"));
        assertNotNull(guard.validate("https://8.8.8.8/profile", "URL"));
        assertNotNull(guard.validate("https://[2606:4700:4700::1111]/x", "URL"));
        assertNotNull(guard.validate("  https://example.com/path?x=1  ", "URL"));
    }

    @Test
    public void rejectsNonHttpsAndMalformed() {
        OutboundUrlGuard guard = create(false, false);
        assertRejected(guard, "http://example.com/");
        assertRejected(guard, "ftp://example.com/");
        assertRejected(guard, "file:///etc/passwd");
        assertRejected(guard, "example.com/no-scheme");
        assertRejected(guard, "https://user:pass@example.com/");
        assertRejected(guard, "https:///nohost");
        assertRejected(guard, "");
        assertRejected(guard, null);
        assertRejected(guard, "not a url at all");
    }

    @Test
    public void rejectsLocalAndPrivateLiterals() {
        OutboundUrlGuard guard = create(false, false);
        assertRejected(guard, "https://localhost/");
        assertRejected(guard, "https://foo.localhost/");
        assertRejected(guard, "https://elasticsearch/");            // bare internal hostname
        assertRejected(guard, "https://killbill.internal/");
        assertRejected(guard, "https://127.0.0.1:9200/");
        assertRejected(guard, "https://127.1/");
        assertRejected(guard, "https://2130706433/");                // 127.0.0.1 as decimal
        assertRejected(guard, "https://0.0.0.0/");
        assertRejected(guard, "https://10.0.0.5/");
        assertRejected(guard, "https://172.16.0.1/");
        assertRejected(guard, "https://172.31.255.254/");
        assertRejected(guard, "https://192.168.1.1/");
        assertRejected(guard, "https://169.254.169.254/latest/meta-data/"); // cloud metadata
        assertRejected(guard, "https://100.64.0.1/");                // carrier NAT
        assertRejected(guard, "https://[::1]/");
        assertRejected(guard, "https://[::]/");
        assertRejected(guard, "https://[::ffff:127.0.0.1]/");
        assertRejected(guard, "https://[::ffff:10.0.0.1]/");
        assertRejected(guard, "https://[fe80::1]/");
        assertRejected(guard, "https://[fd00::1]/");
        assertRejected(guard, "https://[64:ff9b::7f00:1]/");         // NAT64 of 127.0.0.1
    }

    @Test
    public void optInAllowsPrivateAndHttp() {
        OutboundUrlGuard guard = create(true, true);
        assertNotNull(guard.validate("http://localhost:8080/oauth/token", "URL"));
        assertNotNull(guard.validate("https://10.0.0.5/", "URL"));
        assertNotNull(guard.validate("http://keycloak/realms/x", "URL"));
        // Still no credentials in URLs
        assertRejected(guard, "https://user:pass@10.0.0.5/");
    }

    @Test
    public void dnsResolverRefusesNonPublicAddresses() throws Exception {
        OutboundUrlGuard guard = create(false, false);
        // Literal addresses resolve without DNS, so the resolver can be exercised offline
        assertThrows(UnknownHostException.class, () -> guard.policyEnforcingDnsResolver().resolve("127.0.0.1"));
        assertThrows(UnknownHostException.class, () -> guard.policyEnforcingDnsResolver().resolve("169.254.169.254"));
        assertEquals(1, guard.policyEnforcingDnsResolver().resolve("8.8.8.8").length);

        OutboundUrlGuard permissive = create(true, false);
        assertEquals(1, permissive.policyEnforcingDnsResolver().resolve("127.0.0.1").length);
    }

    @Test
    public void publicAddressClassification() throws Exception {
        assertTrue(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("8.8.8.8")));
        assertTrue(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("1.1.1.1")));
        assertTrue(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("2606:4700:4700::1111")));
        assertTrue(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("2002:808:808::")));      // 6to4 of 8.8.8.8

        assertFalse(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("192.0.2.1")));          // documentation
        assertFalse(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("198.18.0.1")));         // benchmarking
        assertFalse(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("224.0.0.1")));          // multicast
        assertFalse(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("255.255.255.255")));
        assertFalse(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("2001:db8::1")));        // documentation
        assertFalse(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("2002:7f00:1::")));      // 6to4 of 127.0.0.1
        assertFalse(OutboundUrlGuard.isPublicAddress(InetAddress.getByName("ff02::1")));            // multicast
    }

    @Test
    public void literalParsing() {
        assertNotNull(OutboundUrlGuard.parseLiteralAddress("127.0.0.1"));
        assertNotNull(OutboundUrlGuard.parseLiteralAddress("2130706433"));
        assertNotNull(OutboundUrlGuard.parseLiteralAddress("::1"));
        assertNull(OutboundUrlGuard.parseLiteralAddress("example.com"));
        assertNull(OutboundUrlGuard.parseLiteralAddress("cafe"));
        // Hex/octal shorthand is not an IP literal to Java, it goes through DNS where the resolver policy applies
        assertNull(OutboundUrlGuard.parseLiteralAddress("0x7f000001"));
        assertNull(OutboundUrlGuard.parseLiteralAddress("accounts.google.com"));
    }
}
