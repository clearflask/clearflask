// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class WebhookTokenUtilTest {

    @Test
    public void tokensAreDeterministicAndScoped() {
        String a = WebhookTokenUtil.derive("secret", "gitlab", "proj-a", "42");
        assertEquals(a, WebhookTokenUtil.derive("secret", "gitlab", "proj-a", "42"));
        assertEquals(64, a.length());
        assertTrue(a.matches("^[0-9a-f]{64}$"));

        // Any change to scope, integration or secret yields a different token
        assertNotEquals(a, WebhookTokenUtil.derive("secret", "gitlab", "proj-b", "42"));
        assertNotEquals(a, WebhookTokenUtil.derive("secret", "gitlab", "proj-a", "43"));
        assertNotEquals(a, WebhookTokenUtil.derive("secret", "jira", "proj-a", "42"));
        assertNotEquals(a, WebhookTokenUtil.derive("other", "gitlab", "proj-a", "42"));
        // Part boundaries matter: ("ab","c") must differ from ("a","bc")
        assertNotEquals(WebhookTokenUtil.derive("s", "x", "ab", "c"), WebhookTokenUtil.derive("s", "x", "a", "bc"));
    }

    @Test
    public void tokenNeverEqualsSecret() {
        assertNotEquals("secret", WebhookTokenUtil.derive("secret", "gitlab", "p", "1"));
    }

    @Test
    public void requiresSecret() {
        assertThrows(IllegalStateException.class, () -> WebhookTokenUtil.derive("", "gitlab", "p"));
        assertThrows(IllegalStateException.class, () -> WebhookTokenUtil.derive(null, "gitlab", "p"));
    }

    @Test
    public void matchesIsNullSafeAndExact() {
        String token = WebhookTokenUtil.derive("secret", "gitlab", "p", "1");
        assertTrue(WebhookTokenUtil.matches(token, token));
        assertFalse(WebhookTokenUtil.matches(token, token + "0"));
        assertFalse(WebhookTokenUtil.matches(token, token.substring(1)));
        assertFalse(WebhookTokenUtil.matches(token, ""));
        assertFalse(WebhookTokenUtil.matches(token, null));
        assertFalse(WebhookTokenUtil.matches("", ""));
        assertFalse(WebhookTokenUtil.matches(null, null));
    }
}
