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

    /** Published in config-local.cfg and config-local-template.cfg */
    private static final String SSO_SECRET_KEY_PLACEHOLDER =
            "7c383beb-b3c2-4893-86ab-917d44202b8d";
    /** Published in config-selfhost.cfg and config-platform.cfg */
    private static final String SSO_SECRET_KEY_SELFHOST_TEMPLATE =
            "439E5B12-F4D6-4BEF-9890-2CEEEFA67A8D";
    private static final String CONNECT_TOKEN_PLACEHOLDER =
            "7cb1e1c26f5d4705a213529257d081c6";
    /** Published in config-local.cfg and config-local-template.cfg */
    private static final byte[] TOKEN_SIGNER_PRIV_KEY_PLACEHOLDER = Base64.getDecoder()
            .decode("o7rSPeu5447tWP0mEhqQCaxppkkWOC/n/sOu+uChxP4gEJ0lEHSwCNZRRkBcGxGgdXPcpiwRwG+yRr+XRzoSPg==");
    /** Published in config-selfhost.cfg and config-platform.cfg */
    private static final byte[] TOKEN_SIGNER_PRIV_KEY_SELFHOST_TEMPLATE = Base64.getDecoder()
            .decode("vKsQVLtZ0iU1hcqZNvCi/orKMLXvp6OQ2Cim6APxqAnheE9WblrSO6nOp/Zw7a4VW9jDP4A/FEWas4BKj4Y1DhwNy9AeS4oVOHgKpa4xVkVtUsF8nMlmXxG+3ukkl18/tr8H4GXPMBxO7BgSXDEBe3zet/AkMSyNq2FbAMOWzeeeWW1lEWDJ/3jv2laVFG5EoKnSzsZnYbPcntM9RnlFo0d8TouUapqxIc4dWQ==");

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
        if (SSO_SECRET_KEY_SELFHOST_TEMPLATE.equals(ssoConfig.secretKey())) {
            fail("ClearFlaskSso.secretKey is set to the published template value from config-selfhost.cfg; anyone can forge SSO tokens with it. Generate a new value, e.g. uuidgen");
        }
        if (CONNECT_TOKEN_PLACEHOLDER.equals(authConfig.connectToken())) {
            if (env == Environment.PRODUCTION_SELF_HOST) {
                // The plain docker-compose self-host install ships Connect and the server with the same published
                // token and no way to generate a shared one on first boot. The server port is not published, so
                // the token only guards the compose-internal network; warn loudly instead of refusing to start.
                log.warn("SECURITY: AuthenticationFilter.connectToken is the published placeholder. Set"
                        + " CLEARFLASK_CONNECT_TOKEN to the same random value on both the clearflask-server and"
                        + " clearflask-connect containers, and never publish the server port.");
            } else {
                fail("AuthenticationFilter.connectToken is set to the published placeholder from config-local.cfg");
            }
        }
        SecretKey signerKey = userStoreConfig.tokenSignerPrivKey();
        if (signerKey != null && Arrays.equals(signerKey.getEncoded(), TOKEN_SIGNER_PRIV_KEY_PLACEHOLDER)) {
            fail("DynamoElasticUserStore.tokenSignerPrivKey is set to the published placeholder from config-local.cfg");
        }
        if (signerKey != null && Arrays.equals(signerKey.getEncoded(), TOKEN_SIGNER_PRIV_KEY_SELFHOST_TEMPLATE)) {
            fail("DynamoElasticUserStore.tokenSignerPrivKey is set to the published template value from config-selfhost.cfg; anyone can forge sign-in links with it. Generate a new value, e.g. openssl rand -base64 172 | tr -d '\\n'");
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
