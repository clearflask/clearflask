package com.smotana.clearflask.web.security;

import com.smotana.clearflask.util.StringSerdeUtil;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
public class AuthCookieUtil {

    @Value
    public static class AccountAuthCookie {
        @NonNull
        private final String sessionId;

        @NonNull
        private final String accountId;
    }

    @Value
    public static class UserAuthCookie {
        @NonNull
        private final String sessionId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String userId;
    }

    private AuthCookieUtil() {
        // Disable ctor
    }

    public static String encode(AccountAuthCookie cookie) {
        return StringSerdeUtil.mergeStrings(cookie.getSessionId(), cookie.getAccountId());
    }

    public static String encode(UserAuthCookie cookie) {
        return StringSerdeUtil.mergeStrings(cookie.getSessionId(), cookie.getProjectId(), cookie.getUserId());
    }

    public static Optional<AccountAuthCookie> decodeAccount(String value) {
        String[] parts = StringSerdeUtil.unMergeString(value);
        if (parts.length != 2) {
            log.warn("AuthCookie has {} parts, expecting 2 for: {}", parts.length, value);
            return Optional.empty();
        }
        return Optional.of(new AccountAuthCookie(parts[0], parts[1]));
    }

    public static Optional<UserAuthCookie> decodeUser(String value) {
        String[] parts = StringSerdeUtil.unMergeString(value);
        if (parts.length != 3) {
            log.warn("AuthCookie has {} parts, expecting 3 for: {}", parts.length, value);
            return Optional.empty();
        }
        return Optional.of(new UserAuthCookie(parts[0], parts[1], parts[2]));
    }
}
