// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableMap;
import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.spec.ECNamedCurveParameterSpec;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Security;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;

/**
 * Post-processes the self-host config file on startup:
 *
 * 1. On first boot (freshly auto-created config), replaces the publicly-known secrets shipped in
 * the config-selfhost.cfg template with freshly generated ones. Every install would otherwise
 * share the same JWT signing key, SSO key, cursor encryption key and VAPID keypair.
 *
 * 2. On every boot, applies {@code CLEARFLASK_*} environment variable overrides into the config
 * file so platforms that configure via environment (Railway, PikaPods, Elestio, plain docker)
 * work without hand-editing Java properties files. Environment always wins over the file.
 *
 * The connect token is only overridden via {@code CLEARFLASK_CONNECT_TOKEN} since Connect must be
 * given the same value; generating one unilaterally would break Connect-Server communication.
 */
@Slf4j
public class SelfHostConfigBootstrap {

    /** Secrets shipped in config-selfhost.cfg; values must match the template exactly. */
    @VisibleForTesting
    static final ImmutableMap<String, String> TEMPLATE_SECRETS = ImmutableMap.of(
            "com.smotana.clearflask.core.push.provider.BrowserPushServiceImpl$Config.publicKey",
            "BI_27q_GDMSYPCoLc5rPUyBMQ3CMUCmjfblbqVoDNcl2CRCAUmtCSgU2-g8SdaJlCqTFBi0Z1eU4maehFNX595M=",
            "com.smotana.clearflask.core.push.provider.BrowserPushServiceImpl$Config.privateKey",
            "AKBBxKqCjroXt2ohL8yHSEpREoRzmtBb6Zk0g4zEDp4H",
            "com.smotana.clearflask.util.DefaultServerSecret$Config.sharedKey:cursor",
            "9mtwDVKROYrPUMNGVgezQg==",
            "com.smotana.clearflask.store.impl.DynamoElasticUserStore$Config.tokenSignerPrivKey",
            "vKsQVLtZ0iU1hcqZNvCi/orKMLXvp6OQ2Cim6APxqAnheE9WblrSO6nOp/Zw7a4VW9jDP4A/FEWas4BKj4Y1DhwNy9AeS4oVOHgKpa4xVkVtUsF8nMlmXxG+3ukkl18/tr8H4GXPMBxO7BgSXDEBe3zet/AkMSyNq2FbAMOWzeeeWW1lEWDJ/3jv2laVFG5EoKnSzsZnYbPcntM9RnlFo0d8TouUapqxIc4dWQ==",
            "com.smotana.clearflask.security.ClearFlaskSso$Config.secretKey",
            "439E5B12-F4D6-4BEF-9890-2CEEEFA67A8D");

    private static final String KEY_VAPID_PUBLIC = "com.smotana.clearflask.core.push.provider.BrowserPushServiceImpl$Config.publicKey";
    private static final String KEY_VAPID_PRIVATE = "com.smotana.clearflask.core.push.provider.BrowserPushServiceImpl$Config.privateKey";
    private static final String KEY_CURSOR_SHARED_KEY = "com.smotana.clearflask.util.DefaultServerSecret$Config.sharedKey:cursor";
    private static final String KEY_TOKEN_SIGNER = "com.smotana.clearflask.store.impl.DynamoElasticUserStore$Config.tokenSignerPrivKey";
    private static final String KEY_SSO_SECRET = "com.smotana.clearflask.security.ClearFlaskSso$Config.secretKey";
    private static final String KEY_SUPER_ADMIN_REGEX = "com.smotana.clearflask.web.security.SuperAdminPredicate$Config.superAdminEmailRegex";
    private static final String KEY_SMTP_HOST = "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.smtpHost";
    private static final String KEY_EMAIL_USE_SERVICE = "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.useService";

    /** Environment variables applied verbatim to a single config property. */
    private static final ImmutableMap<String, String> ENV_TO_PROPERTY = ImmutableMap.<String, String>builder()
            .put("CLEARFLASK_DOMAIN", "com.smotana.clearflask.web.Application$Config.domain")
            .put("CLEARFLASK_SIGNUP_ENABLED", "com.smotana.clearflask.web.resource.AccountResource$Config.signupEnabled")
            .put("CLEARFLASK_AUTH_COOKIE_SECURE", "com.smotana.clearflask.web.security.AuthCookieImpl$Config.authCookieSecure")
            .put("CLEARFLASK_CONNECT_TOKEN", "com.smotana.clearflask.web.security.AuthenticationFilter$Config.connectToken")
            .put("CLEARFLASK_TELEMETRY_ENABLED", "com.smotana.clearflask.web.Application$Config.enableTelemetry")
            .put("CLEARFLASK_SMTP_HOST", KEY_SMTP_HOST)
            .put("CLEARFLASK_SMTP_PORT", "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.smtpPort")
            .put("CLEARFLASK_SMTP_USER", "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.smtpUser")
            .put("CLEARFLASK_SMTP_PASSWORD", "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.smtpPassword")
            .put("CLEARFLASK_SMTP_STRATEGY", "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.smtpStrategy")
            .put("CLEARFLASK_EMAIL_DISPLAY_NAME", "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.emailDisplayName")
            .put("CLEARFLASK_EMAIL_FROM_LOCAL_PART", "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.fromEmailLocalPart")
            .put("CLEARFLASK_EMAIL_FROM_DOMAIN", "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.fromEmailDomainOverride")
            .put("CLEARFLASK_MYSQL_HOST", "com.smotana.clearflask.store.mysql.DefaultMysqlProvider$Config.host")
            .put("CLEARFLASK_MYSQL_USER", "com.smotana.clearflask.store.mysql.DefaultMysqlProvider$Config.user")
            .put("CLEARFLASK_MYSQL_PASSWORD", "com.smotana.clearflask.store.mysql.DefaultMysqlProvider$Config.pass")
            .put("CLEARFLASK_DYNAMO_ENDPOINT", "com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider$Config.serviceEndpoint")
            .put("CLEARFLASK_ES_ENDPOINT", "com.smotana.clearflask.store.elastic.DefaultElasticSearchProvider$Config.serviceEndpoint")
            .put("CLEARFLASK_S3_ENDPOINT", "com.smotana.clearflask.store.s3.DefaultS3ClientProvider$Config.serviceEndpoint")
            .build();

    /** Super admin email is wrapped into an anchored regex rather than applied verbatim. */
    private static final String ENV_SUPER_ADMIN_EMAIL = "CLEARFLASK_SUPER_ADMIN_EMAIL";
    /** Newline-separated raw {@code full.property.key=value} lines for anything not curated above. */
    private static final String ENV_EXTRA_PROPS = "CLEARFLASK_EXTRA_PROPS";

    public static void run(String configFilePath, ServiceInjector.Environment env, boolean configJustCreated) {
        run(configFilePath, env, configJustCreated, System::getenv, new SecureRandom());
    }

    @VisibleForTesting
    static void run(String configFilePath, ServiceInjector.Environment env, boolean configJustCreated,
                    Function<String, String> getenv, SecureRandom random) {
        if (env != ServiceInjector.Environment.PRODUCTION_SELF_HOST) {
            return;
        }
        File file = new File(configFilePath);
        if (!file.exists()) {
            return; // Auto-creation disabled and user manages the file themselves
        }
        try {
            List<String> lines = new ArrayList<>(Files.readAllLines(file.toPath(), StandardCharsets.UTF_8));
            boolean changed = false;

            if (configJustCreated) {
                changed |= generateFreshSecrets(lines, random);
            } else {
                warnIfTemplateSecretsPresent(lines);
            }

            changed |= applyEnvOverrides(lines, getenv);

            if (changed) {
                Files.write(file.toPath(), String.join("\n", lines).concat("\n").getBytes(StandardCharsets.UTF_8));
                log.info("Updated self-host config file at {}", configFilePath);
            }
        } catch (IOException ex) {
            log.warn("Failed to post-process self-host config file at {}, continuing anyway", configFilePath, ex);
        }
    }

    /** Replaces template-shipped secrets with freshly generated ones. Returns whether lines changed. */
    private static boolean generateFreshSecrets(List<String> lines, SecureRandom random) {
        boolean changed = false;
        String[] vapidKeyPair = generateVapidKeyPair(random);
        changed |= setProperty(lines, KEY_VAPID_PUBLIC, vapidKeyPair[0]);
        changed |= setProperty(lines, KEY_VAPID_PRIVATE, vapidKeyPair[1]);
        changed |= setProperty(lines, KEY_CURSOR_SHARED_KEY, randomBase64(random, 32));
        changed |= setProperty(lines, KEY_TOKEN_SIGNER, randomBase64(random, 172));
        changed |= setProperty(lines, KEY_SSO_SECRET, randomUuid(random));
        if (changed) {
            log.info("Generated fresh install-specific secrets (VAPID keypair, cursor key, token signer, SSO key)");
        }
        return changed;
    }

    /** Existing installs keep their secrets; auto-rotating would break push subscriptions, SSO and sign-in links. */
    private static void warnIfTemplateSecretsPresent(List<String> lines) {
        List<String> affected = new ArrayList<>();
        for (Map.Entry<String, String> entry : TEMPLATE_SECRETS.entrySet()) {
            Optional<String> valueOpt = getProperty(lines, entry.getKey());
            if (valueOpt.isPresent() && valueOpt.get().equals(entry.getValue())) {
                affected.add(entry.getKey());
            }
        }
        if (!affected.isEmpty()) {
            log.warn("SECURITY: This install is using {} publicly-known default secret(s) shipped in older"
                            + " versions of config-selfhost.cfg. Anyone can forge tokens signed with them."
                            + " Generate fresh values for: {}."
                            + " See the Self Hosting section of the README for generation commands.",
                    affected.size(), String.join(", ", affected));
        }
    }

    /** Applies CLEARFLASK_* environment variables onto config lines. Returns whether lines changed. */
    private static boolean applyEnvOverrides(List<String> lines, Function<String, String> getenv) {
        Map<String, String> overrides = new LinkedHashMap<>();
        ENV_TO_PROPERTY.forEach((envVar, property) -> {
            String value = getenv.apply(envVar);
            if (value != null && !value.isEmpty()) {
                overrides.put(property, value);
            }
        });

        // SMTP host implies switching the email service from the SES default to SMTP
        if (overrides.containsKey(KEY_SMTP_HOST)) {
            overrides.putIfAbsent(KEY_EMAIL_USE_SERVICE, "smtp");
        }

        String superAdminEmail = getenv.apply(ENV_SUPER_ADMIN_EMAIL);
        if (superAdminEmail != null && !superAdminEmail.isEmpty()) {
            overrides.put(KEY_SUPER_ADMIN_REGEX, "^" + Pattern.quote(superAdminEmail) + "$");
        }

        String extraProps = getenv.apply(ENV_EXTRA_PROPS);
        if (extraProps != null && !extraProps.isEmpty()) {
            for (String extraLine : extraProps.split("\n")) {
                extraLine = extraLine.trim();
                if (extraLine.isEmpty() || extraLine.startsWith("#")) {
                    continue;
                }
                int separatorIndex = extraLine.indexOf('=');
                if (separatorIndex <= 0) {
                    log.warn("Ignoring malformed {} line: {}", ENV_EXTRA_PROPS, extraLine);
                    continue;
                }
                overrides.put(extraLine.substring(0, separatorIndex), extraLine.substring(separatorIndex + 1));
            }
        }

        if (overrides.isEmpty()) {
            return false;
        }
        boolean changed = false;
        for (Map.Entry<String, String> override : overrides.entrySet()) {
            changed |= setProperty(lines, override.getKey(), override.getValue());
        }
        if (changed) {
            log.info("Applied environment variable configuration overrides: {}", String.join(", ", overrides.keySet()));
        }
        return changed;
    }

    /**
     * Sets a property in kik-config file lines, replacing the active line in place or appending.
     * Keys may contain ':' (named configs) so lines are split at the first '=' only.
     */
    private static boolean setProperty(List<String> lines, String key, String value) {
        String newLine = key + "=" + value;
        for (int i = 0; i < lines.size(); i++) {
            if (lines.get(i).startsWith(key + "=")) {
                if (lines.get(i).equals(newLine)) {
                    return false;
                }
                lines.set(i, newLine);
                return true;
            }
        }
        lines.add(newLine);
        return true;
    }

    private static Optional<String> getProperty(List<String> lines, String key) {
        return lines.stream()
                .filter(line -> line.startsWith(key + "="))
                .findFirst()
                .map(line -> line.substring(key.length() + 1));
    }

    private static String randomBase64(SecureRandom random, int numBytes) {
        byte[] bytes = new byte[numBytes];
        random.nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    /** UUID from the supplied SecureRandom, uppercase to match the uuidgen-style template value. */
    private static String randomUuid(SecureRandom random) {
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        bytes[6] = (byte) ((bytes[6] & 0x0f) | 0x40);
        bytes[8] = (byte) ((bytes[8] & 0x3f) | 0x80);
        long msb = 0L, lsb = 0L;
        for (int i = 0; i < 8; i++) {
            msb = (msb << 8) | (bytes[i] & 0xff);
        }
        for (int i = 8; i < 16; i++) {
            lsb = (lsb << 8) | (bytes[i] & 0xff);
        }
        return new UUID(msb, lsb).toString().toUpperCase();
    }

    /**
     * Generates a VAPID keypair for Web Push in the same encoding the web-push library expects:
     * base64url of the uncompressed P-256 public point and of the private scalar.
     */
    private static String[] generateVapidKeyPair(SecureRandom random) {
        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            ECNamedCurveParameterSpec spec = ECNamedCurveTable.getParameterSpec("prime256v1");
            KeyPairGenerator generator = KeyPairGenerator.getInstance("ECDH", BouncyCastleProvider.PROVIDER_NAME);
            generator.initialize(spec, random);
            KeyPair keyPair = generator.generateKeyPair();
            String publicKey = Base64.getUrlEncoder().encodeToString(
                    ((ECPublicKey) keyPair.getPublic()).getQ().getEncoded(false));
            String privateKey = Base64.getUrlEncoder().encodeToString(
                    ((ECPrivateKey) keyPair.getPrivate()).getD().toByteArray());
            return new String[]{publicKey, privateKey};
        } catch (Exception ex) {
            throw new RuntimeException("Failed to generate VAPID keypair", ex);
        }
    }
}
