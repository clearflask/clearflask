// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.common.collect.ImmutableList;
import com.google.inject.Guice;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.stream.Collectors;

import static com.smotana.clearflask.web.resource.AccountResource.ACCOUNT_AUTH_COOKIE_NAME;
import static com.smotana.clearflask.web.resource.AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME;
import static com.smotana.clearflask.web.resource.UserResource.USER_AUTH_COOKIE_NAME_PREFIX;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class AuthCookieImplTest {

    private static final String SERVER_NAME = "clearflask.com";

    private AuthCookieImpl create(boolean secure) {
        AuthCookieImpl.Config config = Mockito.mock(AuthCookieImpl.Config.class);
        Mockito.when(config.authCookieSecure()).thenReturn(secure);
        return Guice.createInjector(binder -> binder.bind(AuthCookieImpl.Config.class).toInstance(config))
                .getInstance(AuthCookieImpl.class);
    }

    private HttpServletRequest request() {
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getServerName()).thenReturn(SERVER_NAME);
        return request;
    }

    private List<String> setCookieHeaders(HttpServletResponse response) {
        ArgumentCaptor<String> name = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> value = ArgumentCaptor.forClass(String.class);
        Mockito.verify(response, Mockito.atLeastOnce()).addHeader(name.capture(), value.capture());
        assertTrue(name.getAllValues().stream().allMatch("Set-Cookie"::equals));
        return ImmutableList.copyOf(value.getAllValues());
    }

    /** The cookie that actually carries the session, as opposed to the legacy clean-up cookie. */
    private String liveCookie(List<String> headers, String sessionId) {
        List<String> live = headers.stream()
                .filter(h -> h.contains("=" + sessionId + ";"))
                .collect(Collectors.toList());
        assertEquals("Expected exactly one live cookie in " + headers, 1, live.size());
        return live.get(0);
    }

    @Test
    public void accountCookieIsHostOnlyLaxAndPrefixedWhenSecure() {
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        create(true).setAuthCookie(request(), response, ACCOUNT_AUTH_COOKIE_NAME, "sess123", 4102444800L);

        String cookie = liveCookie(setCookieHeaders(response), "sess123");
        assertTrue(cookie, cookie.startsWith("__Host-" + ACCOUNT_AUTH_COOKIE_NAME + "=sess123;"));
        assertFalse("Account cookie must not be domain-wide: " + cookie, cookie.contains("Domain="));
        assertTrue(cookie, cookie.contains("; Path=/"));
        assertTrue(cookie, cookie.contains("; Secure"));
        assertTrue(cookie, cookie.contains("; HttpOnly"));
        assertTrue(cookie, cookie.contains("; SameSite=Lax"));
    }

    @Test
    public void superAdminCookieIsHostOnlyLaxAndPrefixedWhenSecure() {
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        create(true).setAuthCookie(request(), response, SUPER_ADMIN_AUTH_COOKIE_NAME, "sess456", 4102444800L);

        String cookie = liveCookie(setCookieHeaders(response), "sess456");
        assertTrue(cookie, cookie.startsWith("__Host-" + SUPER_ADMIN_AUTH_COOKIE_NAME + "=sess456;"));
        assertFalse(cookie, cookie.contains("Domain="));
        assertTrue(cookie, cookie.contains("; SameSite=Lax"));
    }

    @Test
    public void userCookieIsHostOnlyAndStaysEmbeddable() {
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        String cookieName = USER_AUTH_COOKIE_NAME_PREFIX + "proj1";
        create(true).setAuthCookie(request(), response, cookieName, "sess789", 4102444800L);

        String cookie = liveCookie(setCookieHeaders(response), "sess789");
        // User cookie names are stable: renaming them would log out anonymous users for good
        assertTrue(cookie, cookie.startsWith(cookieName + "=sess789;"));
        assertFalse("User cookie must not be domain-wide: " + cookie, cookie.contains("Domain="));
        assertTrue(cookie, cookie.contains("; Secure"));
        assertTrue(cookie, cookie.contains("; HttpOnly"));
        // Portals are embedded in iframes on customer sites, so cross-site must keep working
        assertTrue(cookie, cookie.contains("; SameSite=None"));
    }

    @Test
    public void insecureDeploymentUsesPlainNamesAndStrict() {
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        create(false).setAuthCookie(request(), response, ACCOUNT_AUTH_COOKIE_NAME, "sessabc", 4102444800L);

        String cookie = liveCookie(setCookieHeaders(response), "sessabc");
        // Browsers reject __Host- cookies without Secure, so plain HTTP deployments keep the old name
        assertTrue(cookie, cookie.startsWith(ACCOUNT_AUTH_COOKIE_NAME + "=sessabc;"));
        assertFalse(cookie, cookie.contains("Domain="));
        assertFalse(cookie, cookie.contains("; Secure"));
        assertTrue(cookie, cookie.contains("; SameSite=Strict"));
    }

    @Test
    public void legacyDomainWideCookieIsExpiredOnSet() {
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        create(true).setAuthCookie(request(), response, ACCOUNT_AUTH_COOKIE_NAME, "sess123", 4102444800L);

        List<String> legacy = setCookieHeaders(response).stream()
                .filter(h -> h.startsWith(ACCOUNT_AUTH_COOKIE_NAME + "=;"))
                .collect(Collectors.toList());
        assertEquals(1, legacy.size());
        assertTrue(legacy.get(0), legacy.get(0).contains("; Domain=" + SERVER_NAME));
        assertTrue(legacy.get(0), legacy.get(0).contains("; Expires=Thu, 01 Jan 1970"));
    }

    @Test
    public void unsetExpiresBothHostOnlyAndLegacyCookies() {
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        create(true).unsetAuthCookie(request(), response, ACCOUNT_AUTH_COOKIE_NAME);

        List<String> headers = setCookieHeaders(response);
        assertEquals(2, headers.size());
        assertTrue(headers.toString(), headers.stream().anyMatch(h -> h.startsWith("__Host-" + ACCOUNT_AUTH_COOKIE_NAME + "=;")
                && !h.contains("Domain=")
                && h.contains("; Expires=Thu, 01 Jan 1970")));
        assertTrue(headers.toString(), headers.stream().anyMatch(h -> h.startsWith(ACCOUNT_AUTH_COOKIE_NAME + "=;")
                && h.contains("; Domain=" + SERVER_NAME)));
    }

    @Test
    public void wireNameOnlyPrefixesAccountLevelCookiesWhenSecure() {
        AuthCookieImpl secure = create(true);
        assertEquals("__Host-" + ACCOUNT_AUTH_COOKIE_NAME, secure.wireName(ACCOUNT_AUTH_COOKIE_NAME));
        assertEquals("__Host-" + SUPER_ADMIN_AUTH_COOKIE_NAME, secure.wireName(SUPER_ADMIN_AUTH_COOKIE_NAME));
        assertEquals(USER_AUTH_COOKIE_NAME_PREFIX + "p", secure.wireName(USER_AUTH_COOKIE_NAME_PREFIX + "p"));

        AuthCookieImpl insecure = create(false);
        assertEquals(ACCOUNT_AUTH_COOKIE_NAME, insecure.wireName(ACCOUNT_AUTH_COOKIE_NAME));
        assertEquals(SUPER_ADMIN_AUTH_COOKIE_NAME, insecure.wireName(SUPER_ADMIN_AUTH_COOKIE_NAME));
    }
}
