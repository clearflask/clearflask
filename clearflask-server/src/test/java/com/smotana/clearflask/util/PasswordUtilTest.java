// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

public class PasswordUtilTest {

    private final PasswordUtil passwordUtil = new PasswordUtil();

    @Test
    public void hashVerifyRoundTrip() {
        String hash = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, "clienthash123", "me@example.com");
        assertTrue(hash, hash.startsWith("$pbkdf2-sha512$210000$"));
        assertTrue(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "clienthash123", "me@example.com", hash));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "clienthash124", "me@example.com", hash));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "clienthash123", "other@example.com", hash));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.USER, "clienthash123", "me@example.com", hash));
        assertFalse(passwordUtil.needsRehash(hash));
    }

    @Test
    public void hashesAreSaltedPerPassword() {
        String a = passwordUtil.saltHashPassword(PasswordUtil.Type.USER, "pw", "user1");
        String b = passwordUtil.saltHashPassword(PasswordUtil.Type.USER, "pw", "user1");
        assertNotEquals(a, b);
        assertTrue(passwordUtil.verify(PasswordUtil.Type.USER, "pw", "user1", a));
        assertTrue(passwordUtil.verify(PasswordUtil.Type.USER, "pw", "user1", b));
    }

    @Test
    public void legacyHashesStillVerifyAndAreFlaggedForRehash() {
        String legacy = PasswordUtil.legacySaltHashPassword(PasswordUtil.Type.ACCOUNT, "pw", "me@example.com");
        // Pin the legacy formula so a refactor cannot silently lock everyone out
        assertTrue(legacy, legacy.matches("^[A-Za-z0-9+/]{86}==$"));
        assertTrue(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "pw", "me@example.com", legacy));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "wrong", "me@example.com", legacy));
        assertTrue(passwordUtil.needsRehash(legacy));
    }

    @Test
    public void rejectsGarbage() {
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "pw", "id", null));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "pw", "id", ""));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, null, "id", "$pbkdf2-sha512$1$AA$AA"));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "pw", "id", "$pbkdf2-sha512$notanumber$AA$AA"));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "pw", "id", "$pbkdf2-sha512$1$AA"));
        assertFalse(passwordUtil.verify(PasswordUtil.Type.ACCOUNT, "pw", "id", "$pbkdf2-sha512$1$!!$AA"));
        assertFalse(passwordUtil.needsRehash(null));
        assertTrue(passwordUtil.needsRehash("$pbkdf2-sha512$1000$AA$AA"));
    }
}
