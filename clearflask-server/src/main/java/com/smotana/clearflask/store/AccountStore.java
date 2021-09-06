// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.ToString;
import lombok.Value;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.support.WriteResponse;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface AccountStore {

    default String genAccountId() {
        return IdUtil.randomId();
    }

    AccountAndIndexingFuture createAccount(Account account);

    Optional<Account> getAccountByAccountId(String accountId);

    Optional<Account> getAccountByApiKey(String apiKey);

    Optional<Account> getAccountByOauthGuid(String oauthGuid);

    Optional<Account> getAccountByEmail(String email);

    SearchAccountsResponse searchAccounts(AccountSearchSuperAdmin accountSearchSuperAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt);

    long getUserCountForAccount(String accountId);

    AccountAndIndexingFuture setPlan(String accountId, String planid);

    AccountAndIndexingFuture addProject(String accountId, String projectId);

    AccountAndIndexingFuture removeProject(String accountId, String projectId);

    AccountAndIndexingFuture updateName(String accountId, String name);

    Account updatePassword(String accountId, String password, String sessionIdToLeave);

    AccountAndIndexingFuture updateEmail(String accountId, String emailNew, String sessionIdToLeave);

    Account updateApiKey(String accountId, String apiKey);

    AccountAndIndexingFuture updateStatus(String accountId, SubscriptionStatus status);

    Account updateAttrs(String accountId, Map<String, String> attrs, boolean overwriteMap);

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
    class AccountAndIndexingFuture {
        Account account;
        ListenableFuture<WriteResponse> indexingFuture;
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
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = {"apiKey"}, rangePrefix = "accountByApiKey")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"oauthGuid"}, rangePrefix = "accountByOauthGuid")
    class Account {
        @NonNull
        String accountId;

        @NonNull
        String email;

        @NonNull
        SubscriptionStatus status;

        @ToString.Exclude
        String apiKey;

        @NonNull
        String planid;

        @NonNull
        Instant created;

        @NonNull
        String name;

        /** Empty if using OAuth guid */
        @ToString.Exclude
        String password;

        @NonNull
        ImmutableSet<String> projectIds;

        String oauthGuid;

        ImmutableMap<String, String> attrs;

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

        public AccountAdmin toAccountAdmin(IntercomUtil intercomUtil, PlanStore planStore, ClearFlaskSso cfSso, SuperAdminPredicate superAdminPredicate) {
            return new AccountAdmin(
                    getAccountId(),
                    planStore.getBasePlanId(getPlanid()),
                    getStatus(),
                    getName(),
                    getEmail(),
                    cfSso.generateToken(this),
                    intercomUtil.getIdentity(getEmail()).orElse(null),
                    getApiKey(),
                    superAdminPredicate.isEmailSuperAdmin(getEmail()),
                    getAttrs());
        }
    }
}
