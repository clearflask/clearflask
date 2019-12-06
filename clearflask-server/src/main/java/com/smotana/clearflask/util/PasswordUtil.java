package com.smotana.clearflask.util;

import com.google.common.base.Charsets;
import com.google.common.hash.Hashing;
import lombok.extern.slf4j.Slf4j;

import java.util.Base64;

@Slf4j
public class PasswordUtil {

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
     * Warning: changing this method will result in everyone's passwords to be invalid
     */
    public String saltHashPassword(Type type, String pass, String id) {
        return Base64.getEncoder().encodeToString(Hashing.sha512().hashString(id + type.getSalt() + pass, Charsets.UTF_8).asBytes());
    }
}
