package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import lombok.*;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.update.UpdateResponse;

import java.time.Instant;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface AccountStore {

    default String genAccountId() {
        return IdUtil.randomId();
    }

    AccountAndIndexingFuture<IndexResponse> createAccount(Account account);

    Optional<Account> getAccountByAccountId(String accountId);

    Optional<Account> getAccountByEmail(String email);

    SearchAccountsResponse searchAccounts(AccountSearchSuperAdmin accountSearchSuperAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt);

    AccountAndIndexingFuture<UpdateResponse> setPlan(String accountId, String planid);

    AccountAndIndexingFuture<UpdateResponse> addProject(String accountId, String projectId);

    AccountAndIndexingFuture<UpdateResponse> removeProject(String accountId, String projectId);

    AccountAndIndexingFuture<UpdateResponse> updateName(String accountId, String name);

    Account updatePassword(String accountId, String password, String sessionIdToLeave);

    AccountAndIndexingFuture<UpdateResponse> updateEmail(String accountId, String emailNew, String sessionIdToLeave);

    Account updateApiKey(String accountId, String apiKey);

    AccountAndIndexingFuture<UpdateResponse> updateStatus(String accountId, SubscriptionStatus status);

    ListenableFuture<DeleteResponse> deleteAccount(String accountId);

    default String genSessionId() {
        return IdUtil.randomAscId();
    }

    AccountSession createSession(Account account, long ttlInEpochSec);

    Optional<AccountSession> getSession(String sessionId);

    AccountSession refreshSession(AccountSession accountSession, long ttlInEpochSec);

    void revokeSession(String sessionId);

    void revokeSessions(String accountId);

    void revokeSessions(String accountId, String sessionToLeave);

    @Value
    class SearchAccountsResponse {
        ImmutableList<String> accountIds;
        ImmutableList<com.smotana.clearflask.api.model.Account> accounts;
        Optional<String> cursorOpt;
    }

    @Value
    class AccountAndIndexingFuture<T> {
        Account account;
        ListenableFuture<T> indexingFuture;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "sessionId", rangePrefix = "accountSessionBySessionId")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "accountId", rangePrefix = "accountSessionByAccountId")
    class AccountSession {
        @NonNull
        String sessionId;

        @NonNull
        String accountId;

        /**
         * Used for checking for Super Admin role
         */
        @NonNull
        String email;

        @NonNull
        long ttlInEpochSec;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "email", rangePrefix = "accountIdByEmail")
    class AccountEmail {
        @NonNull
        String email;

        @NonNull
        String accountId;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "accountId", rangePrefix = "account")
    class Account {
        @NonNull
        String accountId;

        @NonNull
        String email;

        @NonNull
        SubscriptionStatus status;

        String apiKey;

        @NonNull
        String planid;

        @NonNull
        Instant created;

        @NonNull
        String name;

        @NonNull
        @ToString.Exclude
        String password;

        @NonNull
        ImmutableSet<String> projectIds;

        /**
         * ClearFlask Feedback page guid
         */
        public String getClearFlaskGuid() {
            return getAccountId();
        }

        public com.smotana.clearflask.api.model.Account toAccount() {
            return new com.smotana.clearflask.api.model.Account(
                    getName(),
                    getEmail());
        }

        public AccountAdmin toAccountAdmin(PlanStore planStore, ClearFlaskSso cfSso, SuperAdminPredicate superAdminPredicate) {
            return new AccountAdmin(
                    planStore.getPlan(getPlanid()).orElseThrow(() -> new IllegalStateException("Unknown plan id " + getPlanid())),
                    getStatus(),
                    getName(),
                    getEmail(),
                    cfSso.generateToken(this),
                    !Strings.isNullOrEmpty(getApiKey()),
                    superAdminPredicate.isEmailSuperAdmin(getEmail()));
        }
    }
}
