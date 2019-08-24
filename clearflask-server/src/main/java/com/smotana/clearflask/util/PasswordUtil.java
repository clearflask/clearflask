package com.smotana.clearflask.util;

import com.google.common.base.Charsets;
import com.google.common.hash.Hashing;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class PasswordUtil {

    /**
     * Warning: changing the salt will result in everyone's passwords to be invalid
     */
    public enum Type {
        USER(":salt:419C8E11-BA69-46D8-BA7A-8FA1D2DCE39E:salt:");

        private String salt;

        Type(String salt) {
            this.salt = salt;
        }

        private String getSalt() {
            return salt;
        }
    }

    private PasswordUtil() {
        // Disallow ctor
    }

    /**
     * Warning: changing this method will result in everyone's passwords to be invalid
     */
    public static String saltHashPassword(Type type, String pass, String id) {
        return Hashing.sha512().hashString(id + type.getSalt() + pass, Charsets.UTF_8).toString();
    }
}
