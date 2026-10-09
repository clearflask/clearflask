// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.hash.Hashing;
import lombok.extern.slf4j.Slf4j;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

/**
 * Password hashing.
 * <p>
 * Passwords are stored as PBKDF2-HMAC-SHA512 with a random per-password salt, encoded as
 * {@code $pbkdf2-sha512$<iterations>$<salt b64>$<hash b64>}. Hashes written by earlier versions were a single
 * unsalted-per-user SHA-512 of a static salt, which crack at raw SHA-512 speed if the database leaks; they are
 * still verified so existing users can sign in, and are upgraded transparently on the next successful login via
 * {@link #needsRehash}.
 */
@Slf4j
public class PasswordUtil {

    private static final String PBKDF2_ALGORITHM = "PBKDF2WithHmacSHA512";
    private static final String PBKDF2_PREFIX = "$pbkdf2-sha512$";
    private static final int PBKDF2_ITERATIONS = 210_000;
    private static final int PBKDF2_SALT_BYTES = 16;
    private static final int PBKDF2_HASH_BITS = 512;

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Warning: changing the salt will result in everyone's passwords to be invalid
     */
    public enum Type {
        ACCOUNT(":salt:161301A80A714619928BDCBE921586F6:salt:"),
        USER(":salt:D678F297DC77427698EDD76A001EFCE8:salt:");

        private String salt;

        Type(String salt) {
            this.salt = salt;
        }

        private String getSalt() {
            return salt;
        }
    }

    /**
     * Hashes a password for storage.
     *
     * @param id Account email or user id; kept as part of the input so that a hash is bound to its owner
     */
    public String saltHashPassword(Type type, String pass, String id) {
        byte[] salt = new byte[PBKDF2_SALT_BYTES];
        RANDOM.nextBytes(salt);
        byte[] hash = pbkdf2(type, pass, id, salt, PBKDF2_ITERATIONS);
        return PBKDF2_PREFIX
                + PBKDF2_ITERATIONS + "$"
                + Base64.getEncoder().withoutPadding().encodeToString(salt) + "$"
                + Base64.getEncoder().withoutPadding().encodeToString(hash);
    }

    /** Constant-time verification of a supplied password against a stored hash of either format. */
    public boolean verify(Type type, String pass, String id, String storedHash) {
        if (Strings.isNullOrEmpty(storedHash) || pass == null) {
            return false;
        }
        if (!storedHash.startsWith(PBKDF2_PREFIX)) {
            return MessageDigest.isEqual(
                    storedHash.getBytes(Charsets.UTF_8),
                    legacySaltHashPassword(type, pass, id).getBytes(Charsets.UTF_8));
        }
        String[] parts = storedHash.substring(PBKDF2_PREFIX.length()).split("\\$");
        if (parts.length != 3) {
            log.warn("Malformed password hash for type {}", type);
            return false;
        }
        int iterations;
        byte[] salt;
        byte[] expected;
        try {
            iterations = Integer.parseInt(parts[0]);
            salt = Base64.getDecoder().decode(parts[1]);
            expected = Base64.getDecoder().decode(parts[2]);
        } catch (IllegalArgumentException ex) {
            log.warn("Malformed password hash for type {}", type, ex);
            return false;
        }
        return MessageDigest.isEqual(expected, pbkdf2(type, pass, id, salt, iterations));
    }

    /** Whether a stored hash uses an outdated scheme or parameters and should be replaced after a successful login. */
    public boolean needsRehash(String storedHash) {
        if (Strings.isNullOrEmpty(storedHash)) {
            return false;
        }
        if (!storedHash.startsWith(PBKDF2_PREFIX)) {
            return true;
        }
        String[] parts = storedHash.substring(PBKDF2_PREFIX.length()).split("\\$");
        try {
            return parts.length != 3 || Integer.parseInt(parts[0]) < PBKDF2_ITERATIONS;
        } catch (NumberFormatException ex) {
            return true;
        }
    }

    private static byte[] pbkdf2(Type type, String pass, String id, byte[] salt, int iterations) {
        // The static per-type salt and id remain part of the input for domain separation; the random salt is what
        // makes each hash unique.
        char[] input = (id + type.getSalt() + pass).toCharArray();
        try {
            return SecretKeyFactory.getInstance(PBKDF2_ALGORITHM)
                    .generateSecret(new PBEKeySpec(input, salt, iterations, PBKDF2_HASH_BITS))
                    .getEncoded();
        } catch (NoSuchAlgorithmException | InvalidKeySpecException ex) {
            throw new IllegalStateException("Cannot hash password", ex);
        }
    }

    /**
     * Hash format written before per-password salts were introduced. Only used to verify existing hashes.
     * Warning: changing this method will result in everyone's legacy passwords to be invalid
     */
    static String legacySaltHashPassword(Type type, String pass, String id) {
        return Base64.getEncoder().encodeToString(Hashing.sha512().hashString(id + type.getSalt() + pass, Charsets.UTF_8).asBytes());
    }
}
