package com.smotana.clearflask.store;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBDocument;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBHashKey;
import com.google.common.collect.ImmutableSet;
import com.google.gson.annotations.SerializedName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.util.Optional;

public interface AccountStore {

    Optional<Account> getAccount(String accountId);

    Optional<Account> getAccountByEmail(String email);

    void createAccount(Account account);

    void addAccountPlanId(String accountId, String planId);

    void removeAccountPlanId(String accountId, String planId);

    void addAccountProjectId(String accountId, String projectId);

    void removeAccountProjectId(String accountId, String projectId);

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
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoDBDocument
    class Session {

        @NonNull
        @DynamoDBHashKey(attributeName = "sessionId")
        private final String sessionId;

        @NonNull
        private final String accountId;

        @NonNull
        @SerializedName("expiry")
        private final Instant expiry;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class Account {

        @NonNull
        @SerializedName("aid")
        private final String accountId;

        @NonNull
        @SerializedName("plans")
        private final ImmutableSet<String> planIds;

        @NonNull
        @SerializedName("company")
        private final String company;

        @NonNull
        @SerializedName("name")
        private final String name;

        @NonNull
        @SerializedName("email")
        private final String email;

        @NonNull
        @SerializedName("password")
        private final String password;

        @SerializedName("phone")
        private final String phone;

        @NonNull
        @SerializedName("paymentToken")
        private final String paymentToken;

        @NonNull
        @SerializedName("projectIds")
        private final ImmutableSet<String> projectIds;
    }
}
