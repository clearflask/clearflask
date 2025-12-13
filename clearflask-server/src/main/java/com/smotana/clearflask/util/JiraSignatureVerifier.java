// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Strings;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.ws.rs.BadRequestException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;

/**
 * Verifies Jira webhook signatures.
 * Jira uses HMAC-SHA256 for webhook signature verification.
 */
@Slf4j
public class JiraSignatureVerifier {

    private static final String HMAC_SHA256_ALGORITHM = "HmacSHA256";
    private static final char[] HEX = {'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'};

    /**
     * Verify the HMAC-SHA256 signature of a Jira webhook payload.
     *
     * @param payload    The raw webhook payload body
     * @param signature  The signature from the X-Hub-Secret header
     * @param secret     The shared secret configured for the webhook
     * @param webhookId  The webhook identifier for logging purposes
     */
    public static void verifySignature(String payload, String signature, String secret, String webhookId) {
        try {
            if (Strings.isNullOrEmpty(payload)
                    || Strings.isNullOrEmpty(secret)
                    || Strings.isNullOrEmpty(signature)) {
                if (LogUtil.rateLimitAllowLog("jira-signature-verifier-wrong-input")) {
                    log.warn("Invalid Jira signature input, signature {} webhookId {}", signature, webhookId);
                }
                throw new BadRequestException("Invalid signature");
            }

            Mac mac = Mac.getInstance(HMAC_SHA256_ALGORITHM);
            SecretKeySpec signingKey = new SecretKeySpec(secret.getBytes(), HMAC_SHA256_ALGORITHM);
            mac.init(signingKey);
            byte[] rawHmac = mac.doFinal(payload.getBytes());

            // Convert to hex string
            final int amount = rawHmac.length;
            char[] raw = new char[2 * amount];
            int j = 0;
            for (byte b : rawHmac) {
                raw[j++] = HEX[(0xF0 & b) >>> 4];
                raw[j++] = HEX[(0x0F & b)];
            }
            String actual = new String(raw);

            // Jira may send signature with or without prefix
            String expected = signature;
            if (signature.startsWith("sha256=")) {
                expected = signature.substring(7);
            }

            if (!expected.equalsIgnoreCase(actual)) {
                if (LogUtil.rateLimitAllowLog("jira-signature-verifier-mismatch")) {
                    log.warn("Jira signature failed, expected {} actual {} webhookId {}",
                            expected, actual, webhookId);
                }
                throw new BadRequestException("Signature verification failed");
            }
        } catch (NoSuchAlgorithmException | InvalidKeyException | IllegalStateException ex) {
            if (LogUtil.rateLimitAllowLog("jira-signature-verifier-failure")) {
                log.warn("Failed to compute Jira signature", ex);
            }
            throw new BadRequestException("Signature verification error");
        }
    }
}
