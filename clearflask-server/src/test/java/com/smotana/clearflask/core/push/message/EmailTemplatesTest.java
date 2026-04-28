// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class EmailTemplatesTest {

    private final EmailTemplates emailTemplates = newEmailTemplates();

    private static EmailTemplates newEmailTemplates() {
        try {
            return new EmailTemplates();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    public void escapeHtml_passesThroughBenignText() {
        assertEquals("hello world", emailTemplates.escapeHtml("hello world"));
        assertEquals("Matús", emailTemplates.escapeHtml("Matús"));
    }

    @Test
    public void escapeHtml_emptyAndNull() {
        assertEquals("", emailTemplates.escapeHtml(null));
        assertEquals("", emailTemplates.escapeHtml(""));
    }

    @Test
    public void escapeHtml_neutralizesScriptTag() {
        assertEquals("&lt;script&gt;alert(1)&lt;&#x2F;script&gt;",
                emailTemplates.escapeHtml("<script>alert(1)</script>"));
    }

    @Test
    public void escapeHtml_escapesAllSpecialChars() {
        // & must be escaped first; otherwise &lt; would become &amp;lt;.
        assertEquals("&amp;&lt;&gt;&quot;&#x27;&#x2F;",
                emailTemplates.escapeHtml("&<>\"'/"));
    }

    @Test
    public void escapeHtml_breaksOutOfAttributeContext() {
        // a payload that closes a quoted attribute and adds an event handler
        // must come out with the quote escaped.
        String payload = "x\" onerror=\"alert(1)";
        String escaped = emailTemplates.escapeHtml(payload);
        assertEquals("x&quot; onerror=&quot;alert(1)", escaped);
    }

    @Test
    public void escapeHtml_breaksOutOfElementContext() {
        // a payload that closes a span and starts an img tag
        String payload = "</span><img src=x onerror=alert(1)>";
        String escaped = emailTemplates.escapeHtml(payload);
        // No raw <, >, /, ", or ' should remain.
        assertEquals(false, escaped.contains("<"));
        assertEquals(false, escaped.contains(">"));
        assertEquals(false, escaped.contains("\""));
        assertEquals(false, escaped.contains("'"));
        // Unescaped slash is also escaped (defense-in-depth for </script context).
        assertEquals(false, escaped.contains("/"));
    }
}
