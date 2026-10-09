// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import org.junit.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.ws.rs.BadRequestException;
import java.nio.charset.StandardCharsets;

import static org.junit.Assert.assertThrows;

public class GitHubSignatureVerifierTest {

    private static final String SECRET = "shhh-its-a-secret";
    private static final String PAYLOAD = "{\"action\":\"opened\"}";

    private static String sign(String secret, String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "sha256=" + WebhookTokenUtil.toHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    public void acceptsValidSignature() throws Exception {
        GitHubSignatureVerifier.verifySignature(PAYLOAD, sign(SECRET, PAYLOAD), SECRET, "guid");
        // Hex case is not significant
        GitHubSignatureVerifier.verifySignature(PAYLOAD, sign(SECRET, PAYLOAD).toUpperCase().replace("SHA256=", "sha256="), SECRET, "guid");
    }

    @Test
    public void rejectsWrongSecretOrPayload() throws Exception {
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD, sign("other", PAYLOAD), SECRET, "guid"));
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD + " ", sign(SECRET, PAYLOAD), SECRET, "guid"));
    }

    @Test
    public void failsClosedOnMissingOrMalformedInput() throws Exception {
        String valid = sign(SECRET, PAYLOAD);
        // Previously these only logged and fell through; every one must reject
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD, null, SECRET, "guid"));
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD, "", SECRET, "guid"));
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD, valid.substring(7), SECRET, "guid"));
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD, "sha1=abc", SECRET, "guid"));
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD, "sha256=", SECRET, "guid"));
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature("", valid, SECRET, "guid"));
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(null, valid, SECRET, "guid"));
    }

    @Test
    public void failsClosedWithoutConfiguredSecret() throws Exception {
        String valid = sign(SECRET, PAYLOAD);
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD, valid, null, "guid"));
        assertThrows(BadRequestException.class, () -> GitHubSignatureVerifier.verifySignature(PAYLOAD, valid, "", "guid"));
    }
}
