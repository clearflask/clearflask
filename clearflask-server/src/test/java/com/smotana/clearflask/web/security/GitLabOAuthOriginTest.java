// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.smotana.clearflask.store.GitLabStore.GitLabAuthorization;
import com.smotana.clearflask.store.gitlab.GitLabStoreImpl;
import com.smotana.clearflask.util.OutboundUrlGuard;
import com.smotana.clearflask.web.ApiException;
import org.junit.Test;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class GitLabOAuthOriginTest {
    @Test
    public void callerCannotSendConfiguredSecretToAnotherPublicServer() throws Exception {
        for (String url : new String[]{"https://webhook.site/attacker", "https://gitlab.com.evil.example",
                "https://gitlab.com@evil.example", "http://gitlab.com", "https://gitlab.com:8443",
                "https://gitlab.com/other", "https://gitlab.com?redirect=evil", "https://gitlab.com#evil",
                "https://gitlab.com/%2e%2e/evil"}) {
            Fixture f = new Fixture();
            try {
                f.store.getProjectsForUser("account", "unused-code", url);
                fail("untrusted OAuth provider accepted: " + url);
            } catch (ApiException error) {
                assertEquals(400, error.getStatus().getStatusCode());
            }
            verifyNoInteractions(f.outbound);
            verify(f.config, never()).clientSecret();
        }
    }

    @Test
    public void defaultAndEquivalentOriginsUseOnlyConfiguredRequestBase() throws Exception {
        Fixture f = new Fixture();
        for (String url : new String[]{null, "", "https://gitlab.com/", "https://GITLAB.COM:443"}) {
            assertEquals("https://gitlab.com", f.validate(url));
        }
        verify(f.outbound, times(4)).validateAndResolve("https://gitlab.com", "GitLab OAuth provider");
    }

    @Test
    public void customProviderRequiresAdministratorConfigurationAndExactBasePath() throws Exception {
        Fixture f = new Fixture();
        when(f.config.oauthInstanceUrl()).thenReturn("https://gitlab.example.org/gitlab/");
        assertEquals("https://gitlab.example.org/gitlab", f.validate(null));
        assertEquals("https://gitlab.example.org/gitlab", f.validate("https://gitlab.example.org/gitlab/"));
        try {
            f.store.getProjectsForUser("account", "unused", "https://gitlab.example.org/elsewhere");
            fail("different base path accepted");
        } catch (ApiException error) {
            assertEquals(400, error.getStatus().getStatusCode());
        }
    }

    @Test
    public void storedForeignAuthorizationCannotLeakClientSecretDuringRefresh() throws Exception {
        Fixture f = new Fixture();
        GitLabAuthorization auth = mock(GitLabAuthorization.class);
        when(auth.getGitlabInstanceUrl()).thenReturn("https://webhook.site/old-authorization");
        when(auth.getRefreshToken()).thenReturn("test-only-refresh-token");
        Method method = GitLabStoreImpl.class.getDeclaredMethod("refreshAccessToken", GitLabAuthorization.class);
        method.setAccessible(true);
        try {
            method.invoke(f.store, auth);
            fail("foreign refresh provider accepted");
        } catch (InvocationTargetException error) {
            assertTrue(error.getCause() instanceof ApiException);
            assertEquals(400, ((ApiException) error.getCause()).getStatus().getStatusCode());
        }
        verifyNoInteractions(f.outbound);
        verify(f.config, never()).clientSecret();
        verify(auth, never()).getRefreshToken();
    }

    private static class Fixture {
        final GitLabStoreImpl store = new GitLabStoreImpl();
        final GitLabStoreImpl.Config config = mock(GitLabStoreImpl.Config.class);
        final OutboundUrlGuard outbound = mock(OutboundUrlGuard.class);
        Fixture() throws Exception {
            when(config.enabled()).thenReturn(true);
            when(config.oauthInstanceUrl()).thenReturn("https://gitlab.com");
            inject(store, "config", config);
            inject(store, "outboundUrlGuard", outbound);
        }
        String validate(String url) throws Exception {
            Method method = GitLabStoreImpl.class.getDeclaredMethod("validateGitLabInstanceUrl", String.class);
            method.setAccessible(true);
            return (String) method.invoke(store, url);
        }
    }
    private static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
