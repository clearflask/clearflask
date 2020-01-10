package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.ToString;
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

    void updateAccountPassword(String accountId, String password, String sessionIdToLeave);

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
    class Session {
        @NonNull
        private final String accountId;

        @NonNull
        private final String sessionId;

        @NonNull
        private final Instant expiry;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class Account {

        @NonNull
        private final String accountId;

        @NonNull
        private final ImmutableSet<String> planIds;

        @NonNull
        private final String company;

        @NonNull
        private final String name;

        @NonNull
        private final String email;

        @NonNull
        @ToString.Exclude
        private final String password;

        private final String phone;

        @NonNull
        private final String paymentToken;

        private final ImmutableSet<String> projectIds;
    }
}
