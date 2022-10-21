// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.ProjectAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.util.ChatwootUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.ToString;
import lombok.Value;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;

import static io.dataspray.singletable.TableType.Gsi;
import static io.dataspray.singletable.TableType.Primary;

public interface AccountStore {

    default String genAccountId() {
        return IdUtil.randomId();
    }

    AccountAndIndexingFuture createAccount(Account account);

    Optional<Account> getAccount(String accountId, boolean useCache);

    ImmutableMap<String, Account> getAccounts(Collection<String> accountIds, boolean useCache);

    Optional<Account> getAccountByApiKey(String apiKey);

    Optional<Account> getAccountByOauthGuid(String oauthGuid);

    Optional<Account> getAccountByEmail(String email);

    void repopulateIndex(boolean deleteExistingIndex, boolean repopulateElasticSearch, boolean repopulateMysql) throws Exception;

    boolean isEmailAvailable(String email);

    SearchAccountsResponse listAccounts(boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt);

    void listAllAccounts(Consumer<Account> consumer);

    SearchAccountsResponse listAccounts(Optional<String> cursorOpt, int pageSize, boolean populateCache);

    SearchAccountsResponse searchAccounts(AccountSearchSuperAdmin accountSearchSuperAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt);

    long getUserCountForAccount(String accountId);

    long getTeammateCountForAccount(String accountId);

    long getPostCountForAccount(String accountId);

    AccountAndIndexingFuture setPlan(String accountId, String planid, Optional<ImmutableMap<String, String>> addons);

    boolean shouldSendTrialEndedNotification(String accountId, String planId);

    Account updateAddons(String accountId, Map<String, String> addons, boolean overwriteMap);

    AccountAndIndexingFuture addProject(String accountId, String projectId);

    AccountAndIndexingFuture removeProject(String accountId, String projectId);

    Account addExternalProject(String accountId, String projectId);

    Account removeExternalProject(String accountId, String projectId);

    Account updateOauthGuid(String accountId, Optional<String> oauthGuidOpt);

    AccountAndIndexingFuture updateName(String accountId, String name);

    Account updatePassword(String accountId, String password, Optional<String> sessionToLeaveOpt);

    AccountAndIndexingFuture updateEmail(String accountId, String emailNew, String sessionIdToLeave);

    Account updateApiKey(String accountId, String apiKey);

    AccountAndIndexingFuture updateStatus(String accountId, SubscriptionStatus status);

    Account updateAttrs(String accountId, Map<String, String> attrs, boolean overwriteMap);

    ListenableFuture<Void> deleteAccount(String accountId);

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
        ImmutableList<Account> accounts;
        Optional<String> cursorOpt;
    }

    @Value
    class AccountAndIndexingFuture {
        Account account;
        ListenableFuture<Void> indexingFuture;
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
    @DynamoTable(type = Gsi, indexNumber = 2, shardKeys = "accountId", shardCount = 30, rangePrefix = "accountIdSharded", rangeKeys = "accountId")
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

        /** Empty if only using OAuth guid */
        @ToString.Exclude
        String password;

        @NonNull
        ImmutableSet<String> projectIds;

        @NonNull
        ImmutableSet<String> externalProjectIds;

        String oauthGuid;

        ImmutableMap<String, String> attrs;

        ImmutableMap<String, String> addons;

        /**
         * ClearFlask Feedback page guid
         */
        public String getClearFlaskGuid() {
            return getAccountId();
        }

        public com.smotana.clearflask.api.model.Account toAccount() {
            return new com.smotana.clearflask.api.model.Account(
                    getAccountId(),
                    getName(),
                    getEmail());
        }

        public AccountAdmin toAccountAdmin(IntercomUtil intercomUtil, ChatwootUtil chatwootUtil, PlanStore planStore, ClearFlaskSso cfSso, SuperAdminPredicate superAdminPredicate) {
            return new AccountAdmin(
                    getAccountId(),
                    planStore.getBasePlanId(getPlanid()),
                    getStatus(),
                    getName(),
                    getEmail(),
                    cfSso.generateToken(this),
                    intercomUtil.getIdentity(getEmail()).orElse(null),
                    chatwootUtil.getIdentity(getEmail()).orElse(null),
                    getApiKey(),
                    superAdminPredicate.isEmailSuperAdmin(getEmail()),
                    getAttrs(),
                    getAddons());
        }

        public ProjectAdmin toProjectAdmin(ProjectAdmin.RoleEnum role) {
            return new ProjectAdmin(
                    getAccountId(),
                    getName(),
                    getEmail(),
                    role);
        }
    }
}
