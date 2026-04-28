// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import org.junit.Test;
import org.mockito.Mockito;

import javax.crypto.SecretKey;
import java.util.Base64;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;

public class SecretsGuardTest {

    private static final String SSO_PLACEHOLDER = "7c383beb-b3c2-4893-86ab-917d44202b8d";
    private static final String CONNECT_TOKEN_PLACEHOLDER = "7cb1e1c26f5d4705a213529257d081c6";
    private static final byte[] TOKEN_SIGNER_PLACEHOLDER_BYTES = Base64.getDecoder()
            .decode("o7rSPeu5447tWP0mEhqQCaxppkkWOC/n/sOu+uChxP4gEJ0lEHSwCNZRRkBcGxGgdXPcpiwRwG+yRr+XRzoSPg==");

    private ClearFlaskSso.Config sso(String secret) {
        ClearFlaskSso.Config c = Mockito.mock(ClearFlaskSso.Config.class);
        Mockito.when(c.secretKey()).thenReturn(secret);
        return c;
    }

    private AuthenticationFilter.Config auth(String token) {
        AuthenticationFilter.Config c = Mockito.mock(AuthenticationFilter.Config.class);
        Mockito.when(c.connectToken()).thenReturn(token);
        return c;
    }

    private DynamoElasticUserStore.Config userStore(byte[] keyBytes) {
        DynamoElasticUserStore.Config c = Mockito.mock(DynamoElasticUserStore.Config.class);
        SecretKey key = Mockito.mock(SecretKey.class);
        Mockito.when(key.getEncoded()).thenReturn(keyBytes);
        Mockito.when(c.tokenSignerPrivKey()).thenReturn(key);
        return c;
    }

    @Test
    public void allowsRealSecretsInProduction() {
        SecretsGuard guard = new SecretsGuard(
                Environment.PRODUCTION_AWS,
                sso("a-real-sso-secret"),
                auth("a-real-connect-token"),
                userStore(new byte[]{1, 2, 3, 4, 5}));
        assertNotNull(guard);
    }

    @Test
    public void allowsAnyValuesInTestEnvironment() {
        // Placeholders are fine outside of production — local dev relies on them.
        SecretsGuard guard = new SecretsGuard(
                Environment.TEST,
                sso(SSO_PLACEHOLDER),
                auth(CONNECT_TOKEN_PLACEHOLDER),
                userStore(TOKEN_SIGNER_PLACEHOLDER_BYTES));
        assertNotNull(guard);
    }

    @Test
    public void rejectsPlaceholderSsoSecretInProduction() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> new SecretsGuard(
                Environment.PRODUCTION_AWS,
                sso(SSO_PLACEHOLDER),
                auth("real"),
                userStore(new byte[]{9, 9, 9})));
        assertContains(ex.getMessage(), "ClearFlaskSso.secretKey");
    }

    @Test
    public void rejectsPlaceholderConnectTokenInProduction() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> new SecretsGuard(
                Environment.PRODUCTION_AWS,
                sso("real"),
                auth(CONNECT_TOKEN_PLACEHOLDER),
                userStore(new byte[]{9, 9, 9})));
        assertContains(ex.getMessage(), "AuthenticationFilter.connectToken");
    }

    @Test
    public void rejectsPlaceholderTokenSignerPrivKeyInProduction() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> new SecretsGuard(
                Environment.PRODUCTION_AWS,
                sso("real"),
                auth("real"),
                userStore(TOKEN_SIGNER_PLACEHOLDER_BYTES)));
        assertContains(ex.getMessage(), "tokenSignerPrivKey");
    }

    @Test
    public void rejectsPlaceholderInProductionSelfHost() {
        assertThrows(IllegalStateException.class, () -> new SecretsGuard(
                Environment.PRODUCTION_SELF_HOST,
                sso(SSO_PLACEHOLDER),
                auth("real"),
                userStore(new byte[]{9, 9, 9})));
    }

    private static void assertContains(String haystack, String needle) {
        if (haystack == null || !haystack.contains(needle)) {
            throw new AssertionError("Expected message to contain '" + needle + "' but was: " + haystack);
        }
    }
}
