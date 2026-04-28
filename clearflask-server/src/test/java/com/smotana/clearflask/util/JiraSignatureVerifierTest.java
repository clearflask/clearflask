// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import org.junit.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.ws.rs.BadRequestException;
import java.nio.charset.StandardCharsets;

import static org.junit.Assert.assertThrows;

public class JiraSignatureVerifierTest {

    private static final String SECRET = "shhh-its-a-secret";
    private static final String PAYLOAD = "{\"webhookEvent\":\"jira:issue_created\"}";

    private static String hmacSha256Hex(String secret, String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(raw.length * 2);
            for (byte b : raw) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    public void acceptsValidSignatureWithSha256Prefix() {
        String sig = "sha256=" + hmacSha256Hex(SECRET, PAYLOAD);
        JiraSignatureVerifier.verifySignature(PAYLOAD, sig, SECRET, "id-1");
    }

    @Test
    public void acceptsValidSignatureWithoutPrefix() {
        String sig = hmacSha256Hex(SECRET, PAYLOAD);
        JiraSignatureVerifier.verifySignature(PAYLOAD, sig, SECRET, "id-2");
    }

    @Test
    public void acceptsValidSignatureUppercase() {
        // Some senders emit uppercase hex; the verifier normalises to lowercase before comparing.
        String sig = "sha256=" + hmacSha256Hex(SECRET, PAYLOAD).toUpperCase();
        JiraSignatureVerifier.verifySignature(PAYLOAD, sig, SECRET, "id-3");
    }

    @Test
    public void rejectsForgedSignature() {
        String forged = "sha256=" + hmacSha256Hex("wrong-secret", PAYLOAD);
        assertThrows(BadRequestException.class, () ->
                JiraSignatureVerifier.verifySignature(PAYLOAD, forged, SECRET, "id-4"));
    }

    @Test
    public void rejectsTamperedPayload() {
        String sig = "sha256=" + hmacSha256Hex(SECRET, PAYLOAD);
        assertThrows(BadRequestException.class, () ->
                JiraSignatureVerifier.verifySignature(PAYLOAD + "tampered", sig, SECRET, "id-5"));
    }

    @Test
    public void rejectsEmptySignature() {
        assertThrows(BadRequestException.class, () ->
                JiraSignatureVerifier.verifySignature(PAYLOAD, "", SECRET, "id-6"));
    }

    @Test
    public void rejectsEmptyPayload() {
        String sig = "sha256=" + hmacSha256Hex(SECRET, "");
        assertThrows(BadRequestException.class, () ->
                JiraSignatureVerifier.verifySignature("", sig, SECRET, "id-7"));
    }

    @Test
    public void rejectsSignatureWithLengthMismatch() {
        // Truncated hex still parses but won't match.
        String truncated = "sha256=" + hmacSha256Hex(SECRET, PAYLOAD).substring(0, 32);
        assertThrows(BadRequestException.class, () ->
                JiraSignatureVerifier.verifySignature(PAYLOAD, truncated, SECRET, "id-8"));
    }
}
