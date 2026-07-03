// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableMap;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Utils;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.util.Map;
import java.util.function.Function;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

@Slf4j
public class SelfHostConfigBootstrapTest {

    @Rule
    public TemporaryFolder folder = new TemporaryFolder();

    private File configFile;

    @Before
    public void setup() throws Exception {
        configFile = folder.newFile("config-selfhost.cfg");
        try (InputStream template = Thread.currentThread().getContextClassLoader()
                .getResourceAsStream("config-selfhost.cfg")) {
            Files.copy(template, configFile.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
    }

    @Test(timeout = 30_000L)
    public void testFreshInstallGeneratesSecrets() throws Exception {
        run(true, ImmutableMap.of());

        String content = read();
        for (Map.Entry<String, String> templateSecret : SelfHostConfigBootstrap.TEMPLATE_SECRETS.entrySet()) {
            assertFalse("Template secret still present: " + templateSecret.getKey(),
                    content.contains(templateSecret.getValue()));
            assertTrue("Secret key missing entirely: " + templateSecret.getKey(),
                    content.contains(templateSecret.getKey() + "="));
        }

        // Generated VAPID keys must load and match, same way BrowserPushServiceImpl loads them
        PublicKey publicKey = Utils.loadPublicKey(getProperty(content,
                "com.smotana.clearflask.core.push.provider.BrowserPushServiceImpl$Config.publicKey"));
        PrivateKey privateKey = Utils.loadPrivateKey(getProperty(content, getPrivateKeyName()));
        assertTrue("Generated VAPID keypair does not verify", Utils.verifyKeyPair(privateKey, publicKey));
    }

    @Test(timeout = 30_000L)
    public void testExistingInstallSecretsUntouched() throws Exception {
        String before = read();
        run(false, ImmutableMap.of());
        assertEquals(before, read());
    }

    @Test(timeout = 30_000L)
    public void testEnvOverrides() throws Exception {
        run(false, ImmutableMap.<String, String>builder()
                .put("CLEARFLASK_DOMAIN", "feedback.example.com")
                .put("CLEARFLASK_SUPER_ADMIN_EMAIL", "boss@example.com")
                .put("CLEARFLASK_SMTP_HOST", "smtp.example.com")
                .put("CLEARFLASK_SMTP_USER", "mailer")
                .put("CLEARFLASK_CONNECT_TOKEN", "supersecret123")
                .put("CLEARFLASK_EXTRA_PROPS", ""
                        + "com.smotana.clearflask.web.Application$Config.createIndexesOnStartup=false\n"
                        + "# comment ignored\n"
                        + "some.new.Key$Config.value=hello")
                .build());

        String content = read();
        assertEquals("feedback.example.com", getProperty(content,
                "com.smotana.clearflask.web.Application$Config.domain"));
        assertEquals("^\\Qboss@example.com\\E$", getProperty(content,
                "com.smotana.clearflask.web.security.SuperAdminPredicate$Config.superAdminEmailRegex"));
        assertEquals("smtp.example.com", getProperty(content,
                "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.smtpHost"));
        // SMTP host implies switching useService from ses to smtp
        assertEquals("smtp", getProperty(content,
                "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.useService"));
        assertEquals("mailer", getProperty(content,
                "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.smtpUser"));
        assertEquals("supersecret123", getProperty(content,
                "com.smotana.clearflask.web.security.AuthenticationFilter$Config.connectToken"));
        assertEquals("false", getProperty(content,
                "com.smotana.clearflask.web.Application$Config.createIndexesOnStartup"));
        assertEquals("hello", getProperty(content, "some.new.Key$Config.value"));

        // No duplicate keys introduced
        assertEquals(1, countOccurrences(content,
                "com.smotana.clearflask.web.Application$Config.domain="));
        assertEquals(1, countOccurrences(content,
                "com.smotana.clearflask.core.push.provider.EmailServiceImpl$Config.useService="));
    }

    @Test(timeout = 30_000L)
    public void testIdempotent() throws Exception {
        ImmutableMap<String, String> env = ImmutableMap.of(
                "CLEARFLASK_DOMAIN", "feedback.example.com");
        run(true, env);
        String afterFirst = read();
        run(false, env);
        assertEquals(afterFirst, read());
    }

    @Test(timeout = 30_000L)
    public void testNonSelfHostNoOp() throws Exception {
        String before = read();
        SelfHostConfigBootstrap.run(configFile.getPath(), Environment.DEVELOPMENT_LOCAL, true,
                envOf(ImmutableMap.of("CLEARFLASK_DOMAIN", "feedback.example.com")), new SecureRandom());
        assertEquals(before, read());
    }

    private void run(boolean justCreated, ImmutableMap<String, String> env) {
        SelfHostConfigBootstrap.run(configFile.getPath(), Environment.PRODUCTION_SELF_HOST, justCreated,
                envOf(env), new SecureRandom());
    }

    private Function<String, String> envOf(ImmutableMap<String, String> env) {
        return env::get;
    }

    private String read() throws IOException {
        return new String(Files.readAllBytes(configFile.toPath()), StandardCharsets.UTF_8);
    }

    private String getPrivateKeyName() {
        return "com.smotana.clearflask.core.push.provider.BrowserPushServiceImpl$Config.privateKey";
    }

    private String getProperty(String content, String key) {
        for (String line : content.split("\n")) {
            if (line.startsWith(key + "=")) {
                return line.substring(key.length() + 1);
            }
        }
        return null;
    }

    private int countOccurrences(String content, String prefix) {
        int count = 0;
        for (String line : content.split("\n")) {
            if (line.startsWith(prefix)) {
                count++;
            }
        }
        return count;
    }
}
