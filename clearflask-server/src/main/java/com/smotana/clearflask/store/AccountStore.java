package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.ToString;
import lombok.Value;

import java.time.Instant;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface AccountStore {

    default String genAccountId() {
        return IdUtil.randomId();
    }

    void createAccount(Account account);

    Optional<Account> getAccountByAccountId(String accountId);

    Optional<Account> getAccountByEmail(String email);

    Account setPlan(String accountId, String planId, Optional<Instant> planExpiry);

    Account addProject(String accountId, String projectId);

    Account removeProject(String accountId, String projectId);

    Account updateName(String accountId, String name);

    Account updatePassword(String accountId, String password, String sessionIdToLeave);

    Account updateEmail(String accountId, String emailNew, String sessionIdToLeave);

    void deleteAccount(String accountId);

    default String genSessionId() {
        return IdUtil.randomAscId();
    }

    AccountSession createSession(String accountId, long ttlInEpochSec);

    Optional<AccountSession> getSession(String sessionId);

    AccountSession refreshSession(AccountSession accountSession, long ttlInEpochSec);

    void revokeSession(String sessionId);

    void revokeSessions(String accountId);

    void revokeSessions(String accountId, String sessionToLeave);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "sessionId", rangePrefix = "accountSessionBySessionId")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "accountId", rangePrefix = "accountSessionByAccountId")
    class AccountSession {
        @NonNull
        private final String sessionId;

        @NonNull
        private final String accountId;

        @NonNull
        private final long ttlInEpochSec;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "email", rangePrefix = "accountIdByEmail")
    class AccountEmail {
        @NonNull
        private final String email;

        @NonNull
        private final String accountId;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "accountId", rangePrefix = "account")
    class Account {
        @NonNull
        private final String accountId;

        @NonNull
        private final String email;

        @NonNull
        private final String stripeCusId;

        @NonNull
        private final String planId;

        private final Instant planExpiry;

        @NonNull
        private final Instant created;

        @NonNull
        private final String name;

        @NonNull
        @ToString.Exclude
        private final String password;

        private final String paymentToken;

        @NonNull
        private final ImmutableSet<String> projectIds;

        public AccountAdmin toAccountAdmin(PlanStore planStore, ClearFlaskSso cfSso) {
            return new AccountAdmin(
                    planStore.getPlan(getPlanId()).orElseThrow(() -> new IllegalStateException("Unknown plan id " + getPlanId())),
                    getName(),
                    getEmail(),
                    cfSso.generateToken(this));
        }
    }
}
