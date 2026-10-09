// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Strings;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.ws.rs.BadRequestException;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

@Slf4j
public class GitHubSignatureVerifier {

    private static final String HMAC_SHA256_ALGORITHM = "HmacSHA256";
    private static final String SIGNATURE_PREFIX = "sha256=";

    /**
     * Verifies the {@code X-Hub-Signature-256} header of a GitHub webhook. Fails closed: any missing or malformed
     * input, an unconfigured secret, or an internal error rejects the request.
     */
    public static void verifySignature(String payload, String signature, String secret, String eventGuid) {
        if (Strings.isNullOrEmpty(secret)) {
            if (LogUtil.rateLimitAllowLog("github-signature-verifier-no-secret")) {
                log.error("GitHub webhook secret is not configured, rejecting webhook guid {}", eventGuid);
            }
            throw new BadRequestException("Signature failed");
        }
        if (Strings.isNullOrEmpty(payload)
                || Strings.isNullOrEmpty(signature)
                || !signature.startsWith(SIGNATURE_PREFIX)) {
            if (LogUtil.rateLimitAllowLog("github-signature-verifier-wrong-input")) {
                log.warn("Invalid signature input, signature present {} guid {}", !Strings.isNullOrEmpty(signature), eventGuid);
            }
            throw new BadRequestException("Signature failed");
        }

        byte[] actual;
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256_ALGORITHM));
            actual = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException | IllegalStateException ex) {
            log.error("Failed to compute GitHub signature, guid {}", eventGuid, ex);
            throw new BadRequestException("Signature failed");
        }

        String expectedHex = signature.substring(SIGNATURE_PREFIX.length()).toLowerCase(Locale.ROOT);
        String actualHex = WebhookTokenUtil.toHex(actual);
        if (!MessageDigest.isEqual(
                expectedHex.getBytes(StandardCharsets.UTF_8),
                actualHex.getBytes(StandardCharsets.UTF_8))) {
            if (LogUtil.rateLimitAllowLog("github-signature-verifier-mismatch")) {
                // Never log the computed signature: it is a valid signature for this payload
                log.warn("GitHub signature mismatch, guid {}", eventGuid);
            }
            throw new BadRequestException("Signature failed");
        }
    }
}
