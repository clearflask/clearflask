// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.SecretKey;
import java.util.Arrays;
import java.util.Base64;

/**
 * Refuses to start in production if any secret-bearing config is still set to the
 * placeholder value committed to {@code config-local.cfg}. Those placeholders are
 * intended for local development only — booting production with them lets anyone
 * with a copy of the repo forge auth tokens, decrypt cursors, or impersonate the
 * Connect service.
 */
@Slf4j
@Singleton
public class SecretsGuard {

    private static final String SSO_SECRET_KEY_PLACEHOLDER =
            "7c383beb-b3c2-4893-86ab-917d44202b8d";
    private static final String CONNECT_TOKEN_PLACEHOLDER =
            "7cb1e1c26f5d4705a213529257d081c6";
    private static final byte[] TOKEN_SIGNER_PRIV_KEY_PLACEHOLDER = Base64.getDecoder()
            .decode("o7rSPeu5447tWP0mEhqQCaxppkkWOC/n/sOu+uChxP4gEJ0lEHSwCNZRRkBcGxGgdXPcpiwRwG+yRr+XRzoSPg==");

    @Inject
    public SecretsGuard(
            Environment env,
            ClearFlaskSso.Config ssoConfig,
            AuthenticationFilter.Config authConfig,
            DynamoElasticUserStore.Config userStoreConfig) {
        if (!env.isProduction()) {
            return;
        }

        if (SSO_SECRET_KEY_PLACEHOLDER.equals(ssoConfig.secretKey())) {
            fail("ClearFlaskSso.secretKey is set to the published placeholder from config-local.cfg");
        }
        if (CONNECT_TOKEN_PLACEHOLDER.equals(authConfig.connectToken())) {
            fail("AuthenticationFilter.connectToken is set to the published placeholder from config-local.cfg");
        }
        SecretKey signerKey = userStoreConfig.tokenSignerPrivKey();
        if (signerKey != null && Arrays.equals(signerKey.getEncoded(), TOKEN_SIGNER_PRIV_KEY_PLACEHOLDER)) {
            fail("DynamoElasticUserStore.tokenSignerPrivKey is set to the published placeholder from config-local.cfg");
        }
        log.info("SecretsGuard: production secrets validated");
    }

    private static void fail(String detail) {
        throw new IllegalStateException("Refusing to start in production with default secret: " + detail
                + ". Generate fresh values and override the relevant config keys before deploying.");
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(SecretsGuard.class).asEagerSingleton();
            }
        };
    }
}
