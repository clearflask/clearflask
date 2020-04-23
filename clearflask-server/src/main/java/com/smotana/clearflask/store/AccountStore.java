package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.AccountAdmin;
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

    void createAccount(Account account);

    Optional<Account> getAccount(String email);

    Account addAccountPlanId(String email, String planId);

    Account removeAccountPlanId(String email, String planId);

    Account addAccountProjectId(String email, String projectId);

    Account removeAccountProjectId(String email, String projectId);

    Account updateAccountName(String email, String name);

    Account updateAccountPassword(String email, String password, String sessionIdToLeave);

    Account updateAccountEmail(String emailCurrent, String emailNew);

    void deleteAccount(String email);

    default String genSessionId() {
        return IdUtil.randomAscId();
    }

    AccountSession createSession(String email, long ttlInEpochSec);

    Optional<AccountSession> getSession(String sessionId);

    AccountSession refreshSession(AccountSession accountSession, long ttlInEpochSec);

    void revokeSession(AccountSession accountSession);

    void revokeSessions(String email);

    void revokeSessions(String email, String sessionToLeave);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "sessionId", rangePrefix = "accountSessionById")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "email", rangePrefix = "accountSessionByEmail")
    class AccountSession {
        @NonNull
        private final String sessionId;

        @NonNull
        private final String email;

        @NonNull
        private final long ttlInEpochSec;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "email", rangePrefix = "account")
    class Account {
        @NonNull
        private final String email;

        @NonNull
        private final String planId;

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

        public AccountAdmin toAccountAdmin(PlanStore planStore) {
            return new AccountAdmin(
                    planStore.getPlan(getPlanId()).orElseThrow(() -> new IllegalStateException("Unknown plan id " + getPlanId())),
                    getName(),
                    getEmail());
        }
    }
}
