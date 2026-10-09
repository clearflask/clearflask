// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Strings;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Derives per-integration webhook tokens from a single server-side secret.
 * <p>
 * Inbound webhooks from GitLab and Jira used to be authenticated with one global secret that was also handed to every
 * customer-controlled GitLab instance when registering the hook (or with nothing at all, for Jira). Anyone who learned
 * it could forge events for every tenant. A token derived from the project and the external resource id is only good
 * for that one link, and the server secret itself never leaves the server.
 */
public final class WebhookTokenUtil {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private WebhookTokenUtil() {
    }

    /**
     * @param secret     Server-side secret, must not be empty
     * @param integration Name of the integration, e.g. "gitlab", keeps tokens apart between integrations
     * @param parts      Identifiers that scope the token, e.g. projectId and the external project id
     * @return lowercase hex HMAC-SHA256 token
     */
    public static String derive(String secret, String integration, String... parts) {
        if (Strings.isNullOrEmpty(secret)) {
            throw new IllegalStateException("Webhook secret for " + integration + " is not configured");
        }
        StringBuilder message = new StringBuilder(integration);
        for (String part : parts) {
            message.append('\u001f').append(Strings.nullToEmpty(part));
        }
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            return toHex(mac.doFinal(message.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("Cannot compute webhook token", ex);
        }
    }

    /** Constant-time comparison of a presented token against the expected one; null-safe. */
    public static boolean matches(String expected, String presented) {
        if (Strings.isNullOrEmpty(expected) || Strings.isNullOrEmpty(presented)) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                presented.getBytes(StandardCharsets.UTF_8));
    }

    public static String toHex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        int j = 0;
        for (byte b : bytes) {
            out[j++] = HEX[(0xF0 & b) >>> 4];
            out[j++] = HEX[0x0F & b];
        }
        return new String(out);
    }
}
