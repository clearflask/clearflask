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
import java.time.Duration;
import java.time.Instant;

/**
 * Verifies Slack request signatures to ensure requests are from Slack.
 * <p>
 * Slack uses HMAC-SHA256 with a signing secret to sign requests.
 * The signature format is: v0=HMAC-SHA256(v0:{timestamp}:{request_body})
 *
 * @see <a href="https://api.slack.com/authentication/verifying-requests-from-slack">Slack Documentation</a>
 */
@Slf4j
public class SlackSignatureVerifier {

    private static final String HMAC_SHA256_ALGORITHM = "HmacSHA256";
    private static final String VERSION = "v0";
    private static final char[] HEX = {'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'};

    /**
     * Maximum age of a request before it's considered stale (5 minutes).
     * Prevents replay attacks.
     */
    private static final Duration MAX_REQUEST_AGE = Duration.ofMinutes(5);

    /**
     * Verify the Slack request signature.
     *
     * @param requestBody    The raw request body
     * @param timestamp      The X-Slack-Request-Timestamp header value
     * @param signature      The X-Slack-Signature header value
     * @param signingSecret  The Slack signing secret from app configuration
     * @throws BadRequestException if signature verification fails
     */
    public static void verifySignature(String requestBody, String timestamp, String signature, String signingSecret) {
        try {
            // Validate inputs
            if (Strings.isNullOrEmpty(requestBody)
                    || Strings.isNullOrEmpty(signingSecret)
                    || Strings.isNullOrEmpty(signature)
                    || Strings.isNullOrEmpty(timestamp)) {
                if (LogUtil.rateLimitAllowLog("slack-signature-verifier-missing-input")) {
                    log.warn("Missing signature input: signature={} timestamp={}",
                            signature != null ? signature.substring(0, Math.min(10, signature.length())) + "..." : "null",
                            timestamp);
                }
                throw new BadRequestException("Missing signature input");
            }

            // Check signature format
            if (!signature.startsWith(VERSION + "=")) {
                if (LogUtil.rateLimitAllowLog("slack-signature-verifier-wrong-format")) {
                    log.warn("Invalid signature format: {}", signature.substring(0, Math.min(10, signature.length())) + "...");
                }
                throw new BadRequestException("Invalid signature format");
            }

            // Verify timestamp is recent to prevent replay attacks
            long requestTimestamp;
            try {
                requestTimestamp = Long.parseLong(timestamp);
            } catch (NumberFormatException e) {
                if (LogUtil.rateLimitAllowLog("slack-signature-verifier-invalid-timestamp")) {
                    log.warn("Invalid timestamp format: {}", timestamp);
                }
                throw new BadRequestException("Invalid timestamp");
            }

            Instant requestTime = Instant.ofEpochSecond(requestTimestamp);
            Instant now = Instant.now();
            if (Duration.between(requestTime, now).abs().compareTo(MAX_REQUEST_AGE) > 0) {
                if (LogUtil.rateLimitAllowLog("slack-signature-verifier-stale-request")) {
                    log.warn("Request timestamp too old: {} (now: {})", requestTime, now);
                }
                throw new BadRequestException("Request timestamp is stale");
            }

            // Compute expected signature
            String baseString = VERSION + ":" + timestamp + ":" + requestBody;
            Mac mac = Mac.getInstance(HMAC_SHA256_ALGORITHM);
            SecretKeySpec signingKey = new SecretKeySpec(signingSecret.getBytes(), HMAC_SHA256_ALGORITHM);
            mac.init(signingKey);
            byte[] rawHmac = mac.doFinal(baseString.getBytes());

            // Convert to hex
            String expected = signature.substring(3); // strip "v0="
            char[] raw = new char[2 * rawHmac.length];
            int j = 0;
            for (byte b : rawHmac) {
                raw[j++] = HEX[(0xF0 & b) >>> 4];
                raw[j++] = HEX[(0x0F & b)];
            }
            String actual = new String(raw);

            // Constant-time comparison to prevent timing attacks
            if (!constantTimeEquals(expected, actual)) {
                if (LogUtil.rateLimitAllowLog("slack-signature-verifier-mismatch")) {
                    log.warn("Slack signature mismatch");
                }
                throw new BadRequestException("Signature verification failed");
            }

        } catch (NoSuchAlgorithmException | InvalidKeyException | IllegalStateException ex) {
            if (LogUtil.rateLimitAllowLog("slack-signature-verifier-failure")) {
                log.warn("Failed to compute signature", ex);
            }
            throw new BadRequestException("Signature verification error");
        }
    }

    /**
     * Constant-time string comparison to prevent timing attacks.
     */
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        if (a.length() != b.length()) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < a.length(); i++) {
            result |= a.charAt(i) ^ b.charAt(i);
        }
        return result == 0;
    }
}
