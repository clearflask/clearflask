package com.smotana.clearflask.web.security;

import com.google.common.base.Strings;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
@Singleton
public class AuthCookieUtil {

    public enum Type {
        ACCOUNT,
        USER
    }

    @Value
    public static class AuthCookieValue {
        @NonNull
        private final Type type;

        @NonNull
        private final String sessionId;

        /** Set if Type is ACCOUNT */
        private final String accountId;

        /** Set if Type is USER */
        private final String projectId;
    }

    @Inject
    private AuthCookieUtil() {
    }

    public static String encode(AuthCookieValue authCookieValue) {
        return authCookieValue.getType().name() + ":" + authCookieValue.getSessionId() + ":" + (authCookieValue.getType() == Type.ACCOUNT ? authCookieValue.getAccountId() : authCookieValue.getProjectId());
    }

    public static Optional<AuthCookieValue> decode(String value) {
        if (Strings.isNullOrEmpty(value)) {
            log.trace("AuthCookie has empty value");
            return Optional.empty();
        }
        String[] parts = value.split(":");
        if (parts.length != 3) {
            log.warn("AuthCookie has {} parts, expecting 3", parts.length);
            return Optional.empty();
        }
        Type type;
        try {
            type = Type.valueOf(parts[0]);
        } catch (IllegalArgumentException ex) {
            log.warn("AuthCookie has unknown type {}", parts[0]);
            return Optional.empty();
        }
        return Optional.of(new AuthCookieValue(
                type,
                parts[1],
                type == Type.ACCOUNT ? parts[2] : null,
                type == Type.USER ? parts[2] : null));
    }
}
