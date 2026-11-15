// SPDX-FileCopyrightText: 2026 Matus Faro <matus@matus.io>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.util.IpUtil;
import org.glassfish.grizzly.servlet.HttpServletRequestImpl;
import org.glassfish.grizzly.servlet.HttpServletResponseImpl;
import org.junit.Test;

import static org.junit.Assert.*;

public class BlackboxRequestTest {
    @Test
    public void requestSupportsRegistrationCaptchaAttributes() throws Exception {
        HttpServletRequestImpl request = AbstractBlackboxIT.createRequest(HttpServletResponseImpl.create());
        String attribute = "com.smotana.clearflask.web.security.RegistrationCaptcha.verified";
        assertNull(request.getAttribute(attribute));
        request.setAttribute(attribute, Boolean.TRUE);
        assertEquals(Boolean.TRUE, request.getAttribute(attribute));
        assertEquals("/", request.getRequestURI());
        assertEquals("127.0.0.1", IpUtil.getRemoteIp(request, Environment.TEST));
    }
}
