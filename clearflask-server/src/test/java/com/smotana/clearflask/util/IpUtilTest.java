// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.smotana.clearflask.core.ServiceInjector.Environment;
import org.junit.Test;
import org.mockito.Mockito;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.InternalServerErrorException;
import java.util.Optional;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

public class IpUtilTest {

    private HttpServletRequest request(String remoteAddr, String xff) {
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getRemoteAddr()).thenReturn(remoteAddr);
        Mockito.when(request.getHeader("x-forwarded-for")).thenReturn(xff);
        return request;
    }

    @Test
    public void selfHostTakesTheEntryConnectAppended() {
        // Connect appends the socket address; whatever the client sent sits to the left and is ignored
        assertEquals("203.0.113.9", IpUtil.getRemoteIp(request("10.0.0.2", "203.0.113.9"), Environment.PRODUCTION_SELF_HOST, null));
        assertEquals("203.0.113.9", IpUtil.getRemoteIp(request("10.0.0.2", "1.2.3.4, 203.0.113.9"), Environment.PRODUCTION_SELF_HOST, null));
        assertEquals("203.0.113.9", IpUtil.getRemoteIp(request("10.0.0.2", "1.2.3.4,5.6.7.8 , 203.0.113.9"), Environment.PRODUCTION_PLATFORM, null));
    }

    @Test
    public void cloudTakesSecondToLastForCloudFrontPlusAlb() {
        assertEquals("203.0.113.9", IpUtil.getRemoteIp(request("10.0.0.2", "203.0.113.9, 130.176.0.1"), Environment.PRODUCTION_AWS, null));
        assertEquals("203.0.113.9", IpUtil.getRemoteIp(request("10.0.0.2", "1.2.3.4, 203.0.113.9, 130.176.0.1"), Environment.PRODUCTION_AWS, null));
        // Only one entry means the request did not come through both proxies; fall back to the socket
        assertEquals("10.0.0.2", IpUtil.getRemoteIp(request("10.0.0.2", "1.2.3.4"), Environment.PRODUCTION_AWS, null));
    }

    @Test
    public void missingHeaderUsesSocketAddress() {
        assertEquals("10.0.0.2", IpUtil.getRemoteIp(request("10.0.0.2", null), Environment.PRODUCTION_SELF_HOST, null));
        assertEquals("10.0.0.2", IpUtil.getRemoteIp(request("10.0.0.2", ""), Environment.PRODUCTION_AWS, null));
    }

    @Test
    public void developmentIgnoresHeader() {
        assertEquals("127.0.0.1", IpUtil.getRemoteIp(request("127.0.0.1", "1.2.3.4"), Environment.DEVELOPMENT_LOCAL, null));
        assertEquals("127.0.0.1", IpUtil.getRemoteIp(request("127.0.0.1", "1.2.3.4"), Environment.TEST, null));
    }

    @Test
    public void overrideChangesProxyDepth() {
        // Self-host behind one extra load balancer in front of Connect
        assertEquals("203.0.113.9", IpUtil.getRemoteIp(request("10.0.0.2", "203.0.113.9, 10.0.0.1"), Environment.PRODUCTION_SELF_HOST, "2"));
        assertEquals(2, IpUtil.trustedProxyCount(Environment.PRODUCTION_SELF_HOST, " 2 "));
        // Garbage or non-positive overrides fall back to the environment default
        assertEquals(1, IpUtil.trustedProxyCount(Environment.PRODUCTION_SELF_HOST, "0"));
        assertEquals(1, IpUtil.trustedProxyCount(Environment.PRODUCTION_SELF_HOST, "abc"));
        assertEquals(2, IpUtil.trustedProxyCount(Environment.PRODUCTION_AWS, null));
    }

    @Test
    public void rejectsNonIpValues() {
        assertThrows(InternalServerErrorException.class,
                () -> IpUtil.getRemoteIp(request("10.0.0.2", "evil, not-an-ip"), Environment.PRODUCTION_SELF_HOST, null));
        assertEquals(Optional.empty(), IpUtil.fromForwardedFor("1.2.3.4, ", 1));
    }
}
