package com.smotana.clearflask.web.security;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class AuthCookieUtil {

    public enum Type {
        ACCOUNT,
        USER
    }

    @Value
    public static class AuthCookie {
        @NonNull
        private final String accountId;

        @NonNull
        private final String sessionId;

        @NonNull
        private final Type type;
    }


    @Inject
    private AuthCookieUtil() {
    }

    public String encode(AuthCookie authCookie) {
        return authCookie.getAccountId() + ";" + authCookie.getSessionId();
    }

    public AuthCookie decode(String value) {
        String[] parts = value.split(";");
        return new AuthCookie(parts[0], parts[1], Type.valueOf(parts[2]));
    }
}
