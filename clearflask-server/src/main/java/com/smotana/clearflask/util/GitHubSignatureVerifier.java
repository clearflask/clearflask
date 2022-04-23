// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Strings;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.ws.rs.BadRequestException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;

@Slf4j
public class GitHubSignatureVerifier {

    private static final String HMAC_SHA256_ALGORITHM = "HmacSHA256";
    private static final char[] HEX = {'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'};

    /**
     * From: https://github.com/guigarage/github-hooks/blob/master/src/main/java/com/guigarage/github/hooks/SignatureCrypto.java
     *
     * Modified to use SHA256
     */
    public static void verifySignature(String payload, String signature, String secret, String eventGuid) {
        try {
            if (Strings.isNullOrEmpty(payload)
                    || Strings.isNullOrEmpty(secret)
                    || Strings.isNullOrEmpty(signature)
                    || !signature.startsWith("sha256=")) {
                if (LogUtil.rateLimitAllowLog("github-signature-verifier-wrong-input")) {
                    log.warn("Invalid signature input, signature {} guid {}", signature, eventGuid);
                }
            }
            Mac mac = Mac.getInstance(HMAC_SHA256_ALGORITHM);
            SecretKeySpec signingKey = new SecretKeySpec(secret.getBytes(), HMAC_SHA256_ALGORITHM);
            mac.init(signingKey);
            byte[] rawHmac = mac.doFinal(payload.getBytes());
            String expected = signature.substring(7); // strip "sha256="
            final int amount = rawHmac.length;
            char[] raw = new char[2 * amount];
            int j = 0;
            for (byte b : rawHmac) {
                raw[j++] = HEX[(0xF0 & b) >>> 4];
                raw[j++] = HEX[(0x0F & b)];
            }
            String actual = new String(raw);

            if (!expected.equals(actual)) {
                if (LogUtil.rateLimitAllowLog("github-signature-verifier-mismatch")) {
                    log.warn("GitHub signature failed, expected {} actual {} signature {} guid {}",
                            expected, actual, signature, eventGuid);
                }
                throw new BadRequestException("Signature failed");
            }
        } catch (NoSuchAlgorithmException | InvalidKeyException | IllegalStateException ex) {
            if (LogUtil.rateLimitAllowLog("github-signature-verifier-failure")) {
                log.warn("Failed to compute signature", ex);
            }
        }
    }


}
