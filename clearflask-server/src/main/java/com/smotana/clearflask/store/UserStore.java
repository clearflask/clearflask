package com.smotana.clearflask.store;

import com.google.gson.annotations.SerializedName;
import lombok.NonNull;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

public interface UserStore {

    Optional<User> getUser(String userId);

    Optional<User> getUserByEmail(String email);

    Optional<User> getUserByPushToken(String pushToken);

    void createUser(User user);

    void updateAccountName(String accountId, String name);

    void updateAccountPassword(String accountId, String password);

    void updateAccountEmail(String accountId, String previousEmail, String email);

    Session createSession(String accountId, Instant expiry);

    Optional<Session> getSession(String accountId, String sessionId);

    Session refreshSession(String accountId, String sessionId, Instant expiry);

    void revokeSession(String accountId, String sessionId);

    void revokeSessions(String accountId);

    void revokeSessions(String accountId, String sessionToLeave);

    @Value
    class Session {

        @NonNull
        @SerializedName("sessionId")
        private final String sessionId;

        @NonNull
        @SerializedName("aid")
        private final String accountId;

        @NonNull
        @SerializedName("expiry")
        private final Instant expiry;
    }

    @Value
    class User {

        private static final String USER_ID = "uid";
        @NonNull
        @SerializedName(USER_ID)
        private final String userId;

        private static final String NAME = "name";
        @SerializedName(NAME)
        private final String name;

        private static final String EMAIL = "email";
        @SerializedName(EMAIL)
        private final String email;

        private static final String EMAIL_NOTIFY = "emailNotify";
        @NonNull
        @SerializedName(EMAIL_NOTIFY)
        private final Boolean emailNotify;

        private static final String IOS_PUSH = "iosPush";
        @NonNull
        @SerializedName(IOS_PUSH)
        private final Boolean iosPush;

        private static final String ANDROID_PUSH = "androidPush";
        @NonNull
        @SerializedName(ANDROID_PUSH)
        private final Boolean androidPush;

        private static final String BROWSER_PUSH = "browserPush";
        @NonNull
        @SerializedName(BROWSER_PUSH)
        private final Boolean browserPush;

        private static final String BALANCE = "balance";
        @NonNull
        @SerializedName(BALANCE)
        private final BigDecimal balance;

        private static final String IOS_PUSH_TOKEN = "iosPushToken";
        @SerializedName(IOS_PUSH_TOKEN)
        private final String iosPushToken;

        private static final String ANDROID_PUSH_TOKEN = "androidPushToken";
        @SerializedName(ANDROID_PUSH_TOKEN)
        private final String androidPushToken;

        private static final String BROWSER_PUSH_TOKEN = "browserPushToken";
        @SerializedName(BROWSER_PUSH_TOKEN)
        private final String browserPushToken;
    }
}
