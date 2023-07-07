// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Maps;
import com.google.common.collect.Sets;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountEmail;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.impl.DynamoElasticAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.store.impl.DynamoVoteStore;
import com.smotana.clearflask.store.mysql.MysqlCustomFunction;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.store.mysql.model.tables.JooqIdea;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.ChatwootUtil;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.ProjectUpgraderImpl;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import io.dataspray.singletable.DynamoTable;
import io.dataspray.singletable.IndexSchema;
import io.dataspray.singletable.ShardPageResult;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.SingleTableTestUtil;
import io.dataspray.singletable.TableSchema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.jooq.DSLContext;
import org.junit.Ignore;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameter;
import org.junit.runners.Parameterized.Parameters;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static io.dataspray.singletable.TableType.Primary;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

@Slf4j
@RunWith(Parameterized.class)
public class AccountStoreIT extends AbstractIT {

    @Parameter(0)
    public SearchEngine searchEngine;

    @Parameters(name = "{0}")
    public static Object[][] data() {
        return new Object[][]{
                {ProjectStore.SearchEngine.READWRITE_ELASTICSEARCH},
                {ProjectStore.SearchEngine.READWRITE_MYSQL},
        };
    }

    @Inject
    private AccountStore store;
    @Inject
    private DynamoElasticAccountStore storeImpl;
    @Inject
    private SingleTable singleTable;
    @Inject
    private Provider<DSLContext> mysql;
    @Inject
    private MysqlUtil mysqlUtil;

    @Override
    protected void configure() {
        enableKillBillClient = false; // TODO remove me
        overrideSearchEngine = searchEngine;
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                DynamoElasticIdeaStore.module(),
                DynamoElasticAccountStore.module(),
                DynamoProjectStore.module(),
                DynamoVoteStore.module(),
                ProjectUpgraderImpl.module(),
                IntercomUtil.module(),
                ChatwootUtil.module(),
                ElasticUtil.module(),
                Sanitizer.module(),
                DefaultServerSecret.module(Names.named("cursor")),
                WebhookServiceImpl.module(),
                DynamoElasticUserStore.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoElasticAccountStore.Config.class, om -> {
                    om.override(om.id().elasticForceRefresh()).withValue(true);
                }));
            }
        }));
    }

    @Test(timeout = 30_000L)
    public void testAccount() throws Exception {
        Account account = new Account(
                store.genAccountId(),
                "my@email.com",
                SubscriptionStatus.ACTIVETRIAL,
                null,
                "planId1",
                Instant.now(),
                "name",
                "password",
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                ImmutableMap.of(),
                null,
                null);
        store.createAccount(account).getIndexingFuture().get();
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        account = account.toBuilder()
                .name("name2")
                .build();
        store.updateName(account.getAccountId(), account.getName()).getIndexingFuture().get();
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        String apiKey = "asdfgagasd";
        account = account.toBuilder()
                .apiKey(apiKey)
                .build();
        assertEquals(account, store.updateApiKey(account.getAccountId(), apiKey));
        assertEquals(Optional.of(account), store.getAccount(account.getAccountId(), false));
        assertEquals(Optional.of(account), store.getAccountByApiKey(apiKey));

        String apiKey2 = "asdfgagasd2";
        account = account.toBuilder()
                .apiKey(apiKey2)
                .build();
        assertEquals(account, store.updateApiKey(account.getAccountId(), apiKey2));
        assertEquals(Optional.of(account), store.getAccount(account.getAccountId(), false));
        assertEquals(Optional.of(account), store.getAccountByApiKey(apiKey2));
        assertEquals(Optional.empty(), store.getAccountByApiKey(apiKey));

        String oauthGuid = "myoauthguid";
        account = account.toBuilder()
                .oauthGuid(oauthGuid)
                .build();
        assertEquals(account, store.updateOauthGuid(account.getAccountId(), Optional.of(account.getOauthGuid())));
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));
        Optional<Account> accountExpected = Optional.of(account);
        assertEquals(accountExpected, store.getAccountByOauthGuid(oauthGuid));

        account = account.toBuilder()
                .oauthGuid(null)
                .build();
        assertEquals(account, store.updateOauthGuid(account.getAccountId(), Optional.empty()));
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));
        assertEquals(Optional.empty(), store.getAccountByOauthGuid(oauthGuid));

        AccountStore.AccountSession accountSession1 = store.createSession(account, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        AccountStore.AccountSession accountSession2 = store.createSession(account, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        account = account.toBuilder()
                .password("password2")
                .build();
        store.updatePassword(account.getAccountId(), account.getPassword(), Optional.of(accountSession1.getSessionId()));
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));
        assertEquals(Optional.of(accountSession1), store.getSession(accountSession1.getSessionId()));
        assertEquals(Optional.empty(), store.getSession(accountSession2.getSessionId()));

        String projectId = IdUtil.randomId();
        ImmutableSet<String> initialProjectIds = account.getProjectIds();
        account = account.toBuilder()
                .projectIds(ImmutableSet.<String>builder()
                        .add(projectId)
                        .addAll(initialProjectIds)
                        .build())
                .build();
        store.addProject(account.getAccountId(), projectId).getIndexingFuture().get();
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        account = account.toBuilder()
                .projectIds(initialProjectIds)
                .build();
        store.removeProject(account.getAccountId(), projectId).getIndexingFuture().get();
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        String projectId2 = IdUtil.randomId();
        ImmutableSet<String> initialExternalProjectIds = account.getExternalProjectIds();
        account = account.toBuilder()
                .externalProjectIds(ImmutableSet.<String>builder()
                        .add(projectId2)
                        .addAll(initialExternalProjectIds)
                        .build())
                .build();
        store.addExternalProject(account.getAccountId(), projectId2);
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        account = account.toBuilder()
                .externalProjectIds(initialExternalProjectIds)
                .build();
        store.removeExternalProject(account.getAccountId(), projectId2);
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        AccountStore.AccountSession accountSession = store.createSession(account, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        assertTrue(store.getSession(accountSession.getSessionId()).isPresent());

        String oldEmail = account.getEmail();
        account = account.toBuilder()
                .email("new@email.com")
                .build();
        store.updateEmail(account.getAccountId(), account.getEmail(), "").getIndexingFuture().get();
        assertEquals(Optional.empty(), store.getAccountByEmail(oldEmail));
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));
        assertEquals(Optional.empty(), store.getSession(accountSession.getSessionId()));
        assertEquals(Optional.empty(), store.getSession(accountSession2.getSessionId()));

        store.deleteAccount(account.getAccountId()).get();
        assertFalse(store.getAccount(account.getAccountId(), false).isPresent());
        assertFalse(store.getAccountByEmail(account.getEmail()).isPresent());
    }

    @Test(timeout = 30_000L)
    public void testSession() throws Exception {
        Account account = new Account(
                store.genAccountId(),
                "my@email.com",
                SubscriptionStatus.ACTIVETRIAL,
                null,
                "planId1",
                Instant.now(),
                "name",
                "password",
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                ImmutableMap.of(),
                null,
                null);
        store.createAccount(account).getIndexingFuture().get();

        AccountStore.AccountSession accountSession1 = store.createSession(account, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 1 {}", accountSession1);
        assertTrue(store.getSession(accountSession1.getSessionId()).isPresent());
        assertEquals(accountSession1, store.getSession(accountSession1.getSessionId()).get());

        AccountStore.AccountSession accountSession2 = store.createSession(account, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 2 {}", accountSession2);
        assertTrue(store.getSession(accountSession2.getSessionId()).isPresent());
        assertEquals(accountSession2, store.getSession(accountSession2.getSessionId()).get());
        assertTrue(store.getSession(accountSession1.getSessionId()).isPresent());

        store.revokeSession(accountSession1.getSessionId());
        assertFalse(store.getSession(accountSession1.getSessionId()).isPresent());
        assertTrue(store.getSession(accountSession2.getSessionId()).isPresent());

        AccountStore.AccountSession accountSession3 = store.createSession(account, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 3 {}", accountSession3);
        assertTrue(store.getSession(accountSession3.getSessionId()).isPresent());
        assertEquals(accountSession3, store.getSession(accountSession3.getSessionId()).get());
        assertTrue(store.getSession(accountSession2.getSessionId()).isPresent());

        store.revokeSessions(account.getAccountId(), accountSession3.getSessionId());
        assertFalse(store.getSession(accountSession2.getSessionId()).isPresent());
        assertTrue(store.getSession(accountSession3.getSessionId()).isPresent());

        long refreshedExpiry = Instant.ofEpochMilli(System.currentTimeMillis()).plus(2, ChronoUnit.DAYS).getEpochSecond();
        store.refreshSession(accountSession3, refreshedExpiry);
        assertTrue(store.getSession(accountSession3.getSessionId()).isPresent());
        assertEquals(refreshedExpiry, store.getSession(accountSession3.getSessionId()).get().getTtlInEpochSec());

        store.revokeSessions(account.getAccountId());
        assertFalse(store.getSession(accountSession3.getSessionId()).isPresent());
    }

    @Test(timeout = 30_000L)
    public void testAccountAttrs() throws Exception {
        Account account = new Account(
                store.genAccountId(),
                "my@email.com",
                SubscriptionStatus.ACTIVETRIAL,
                null,
                "planId1",
                Instant.now(),
                "name",
                "password",
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                // Prior to adding attrs, all accounts have this as null
                // test the creation of this map
                null,
                null,
                null);

        HashMap<String, String> attrsExpected = null;
        account = store.createAccount(account).getAccount();
        assertEquals(attrsExpected, account.getAttrs());

        attrsExpected = Maps.newHashMap();
        attrsExpected.put("k1", "v1");
        account = store.updateAttrs(account.getAccountId(),
                ImmutableMap.of("k1", "v1"),
                // Same as in AccountResource.accountUpdateAdmin
                account.getAttrs() == null || account.getAttrs().isEmpty());
        assertEquals(attrsExpected, account.getAttrs());

        attrsExpected.put("k2", "v2");
        account = store.updateAttrs(account.getAccountId(),
                ImmutableMap.of("k2", "v2"),
                // Same as in AccountResource.accountUpdateAdmin
                account.getAttrs() == null || account.getAttrs().isEmpty());
        assertEquals(attrsExpected, account.getAttrs());

        attrsExpected.put("k1", "v3");
        account = store.updateAttrs(account.getAccountId(),
                ImmutableMap.of("k1", "v3"),
                // Same as in AccountResource.accountUpdateAdmin
                account.getAttrs() == null || account.getAttrs().isEmpty());
        assertEquals(attrsExpected, account.getAttrs());

        // Removing by empty string
        attrsExpected.remove("k2");
        account = store.updateAttrs(account.getAccountId(),
                ImmutableMap.of("k2", ""),
                // Same as in AccountResource.accountUpdateAdmin
                account.getAttrs() == null || account.getAttrs().isEmpty());
        assertEquals(attrsExpected, account.getAttrs());

        // Removing by null value
        attrsExpected.remove("k1");
        HashMap<String, String> attrsUpdate = Maps.newHashMap(); // Hashmap supports null values
        attrsUpdate.put("k1", null);
        account = store.updateAttrs(account.getAccountId(),
                attrsUpdate,
                // Same as in AccountResource.accountUpdateAdmin
                account.getAttrs() == null || account.getAttrs().isEmpty());
        assertEquals(attrsExpected, account.getAttrs());

        // Adding first value again (triggers overwrite)
        attrsExpected.put("k3", "v4");
        account = store.updateAttrs(account.getAccountId(),
                ImmutableMap.of("k3", "v4"),
                // Same as in AccountResource.accountUpdateAdmin
                account.getAttrs() == null || account.getAttrs().isEmpty());
        assertEquals(attrsExpected, account.getAttrs());

        // Key with weird characters
        attrsExpected.put("3!@#$%^&*()-", "2!@#$%^&*()_+");
        account = store.updateAttrs(account.getAccountId(),
                ImmutableMap.of("3!@#$%^&*()-", "2!@#$%^&*()_+"),
                // Same as in AccountResource.accountUpdateAdmin
                account.getAttrs() == null || account.getAttrs().isEmpty());
        assertEquals(attrsExpected, account.getAttrs());
    }

    @Test(timeout = 30_000L)
    public void testAccountSearch() throws Exception {
        String accountId1 = store.genAccountId();
        Account account1 = new Account(
                accountId1,
                "whateveryo@example.com",
                SubscriptionStatus.ACTIVETRIAL,
                null,
                "planId1",
                Instant.now(),
                "Adsfagregerghrthshgfdsg",
                "password",
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                ImmutableMap.of(),
                null,
                null);
        String accountId2 = store.genAccountId();
        Account account2 = new Account(
                accountId2,
                "mysomethingemail@gmail.io",
                SubscriptionStatus.ACTIVETRIAL,
                null,
                "planId1",
                Instant.now(),
                "POIPLMQWPEEBQWNBENWQMNVEM",
                "password",
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                ImmutableMap.of(),
                null,
                null);

        store.createAccount(account1).getIndexingFuture().get();
        assertAccountSearch(1, accountId1);
        store.createAccount(account2).getIndexingFuture().get();
        assertAccountSearch(1, accountId1, accountId2);

        Stream.of(account1, account2).forEach(account -> {
            assertAccountSearch(account.getEmail(), 1, account.getAccountId());
            assertAccountSearch(account.getName(), 1, account.getAccountId());
            assertAccountSearch(account.getEmail().substring(0, account.getEmail().length() - 2), 1, account.getAccountId());
            assertAccountSearch(account.getName().substring(0, account.getName().length() - 2), 1, account.getAccountId());
        });

        store.updateName(accountId1, "NewName").getIndexingFuture().get();
        assertAccountSearch(account1.getName(), 1);
        assertAccountSearch("NewName", 1, accountId1);
    }

    private ImmutableList<Account> assertAccountSearch(int pageSize, String... expectedAccountIds) {
        return assertAccountSearch(AccountSearchSuperAdmin.builder().build(), pageSize, expectedAccountIds);
    }

    private ImmutableList<Account> assertAccountSearch(String searchText, int pageSize, String... expectedAccountIds) {
        return assertAccountSearch(AccountSearchSuperAdmin.builder()
                .searchText(searchText).build(), pageSize, expectedAccountIds);
    }

    private ImmutableList<Account> assertAccountSearch(AccountSearchSuperAdmin search, int pageSize, String... expectedAccountIds) {
        Optional<String> cursorOpt = Optional.empty();
        Set<String> actualAccountIds = Sets.newHashSet();
        ImmutableList.Builder<Account> actualAccountsBuilder = ImmutableList.builder();
        do {
            AccountStore.SearchAccountsResponse response = store.searchAccounts(search, true, cursorOpt, Optional.of(pageSize));
            assertTrue("Result size " + response.getAccounts().size() + " is higher than page size " + pageSize,
                    response.getAccounts().size() <= pageSize);
            cursorOpt = response.getCursorOpt();
            response.getAccounts().forEach(account -> assertTrue("Already contained: " + account, actualAccountIds.add(account.getAccountId())));
            actualAccountsBuilder.addAll(response.getAccounts());
        } while (cursorOpt.isPresent());
        assertEquals(ImmutableSet.copyOf(expectedAccountIds), actualAccountIds);
        return actualAccountsBuilder.build();
    }

    @Test(timeout = 30_000L)
    public void testShouldSendTrialEnded() throws Exception {
        Account account = new Account(
                store.genAccountId(),
                "my@email.com",
                SubscriptionStatus.ACTIVETRIAL,
                null,
                "planId1",
                Instant.now(),
                "name",
                "password",
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                // Prior to adding attrs, all accounts have this as null
                // test the creation of this map
                null,
                null,
                null);
        account = store.createAccount(account).getAccount();

        assertTrue(store.shouldSendTrialEndedNotification(account.getAccountId(), "plan1"));
        assertFalse(store.shouldSendTrialEndedNotification(account.getAccountId(), "plan1"));
        assertTrue(store.shouldSendTrialEndedNotification(account.getAccountId(), "plan2"));
        assertTrue(store.shouldSendTrialEndedNotification(account.getAccountId(), "plan3"));
        assertTrue(store.shouldSendTrialEndedNotification(account.getAccountId(), "plan2"));
        assertTrue(store.shouldSendTrialEndedNotification(account.getAccountId(), "plan1"));
        assertFalse(store.shouldSendTrialEndedNotification(account.getAccountId(), "plan1"));
    }

    @Test(timeout = 30_000L)
    public void testDontFailDuplicateFunctionOrTableOrIndexCreation() throws Exception {
        if (searchEngine.isWriteMysql()) {
            storeImpl.createIndexMysql();
            storeImpl.createIndexMysql();

            mysqlUtil.createFunctionIfNotExists(MysqlCustomFunction.EXP_DECAY);
            mysqlUtil.createFunctionIfNotExists(MysqlCustomFunction.EXP_DECAY);

            mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.STATUSID));
            mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.STATUSID));
        }
        if (searchEngine.isWriteElastic()) {
            storeImpl.createIndexElasticSearch().get();
            storeImpl.createIndexElasticSearch().get();
        }
    }

    /** Excludes GSI 2 for testing upgrade */
    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "email", rangePrefix = "accountIdByEmail")
    public static class AccountEmailOld {
        @NonNull
        String email;

        @NonNull
        String accountId;
    }

    /** Upgrade completed, ignoring test */
    @Ignore
    @Test(timeout = 30_000L)
    public void testUpgradeAddGsi2ToAccountEmail() throws Exception {
        SingleTableTestUtil.clearDuplicateSchemaDetection(singleTable);
        TableSchema<AccountEmailOld> accountIdByEmailOldSchema = singleTable.parseTableSchema(AccountEmailOld.class);
        SingleTableTestUtil.clearDuplicateSchemaDetection(singleTable);
        TableSchema<AccountEmail> accountIdByEmailSchema = singleTable.parseTableSchema(AccountEmail.class);
        IndexSchema<AccountEmail> accountIdShardedSchema = singleTable.parseGlobalSecondaryIndexSchema(2, AccountEmail.class);

        assertEquals(0, storeImpl.upgradeAddGsi2ToAccountEmailSchema());

        AccountEmailOld acctOld1 = new AccountEmailOld("email1", "account1");
        AccountEmailOld acctOld2 = new AccountEmailOld("email2", "account2");
        AccountEmail acct1 = new AccountEmail(acctOld1.getEmail(), acctOld1.getAccountId());
        AccountEmail acct2 = new AccountEmail(acctOld2.getEmail(), acctOld2.getAccountId());

        accountIdByEmailOldSchema.table().putItem(accountIdByEmailOldSchema.toItem(acctOld1));
        accountIdByEmailOldSchema.table().putItem(accountIdByEmailOldSchema.toItem(acctOld2));
        assertEquals(acct1, accountIdByEmailSchema.fromItem(accountIdByEmailSchema.table().getItem(accountIdByEmailSchema.primaryKey(acct1))));
        assertEquals(acct2, accountIdByEmailSchema.fromItem(accountIdByEmailSchema.table().getItem(accountIdByEmailSchema.primaryKey(acct2))));
        assertEquals(new ShardPageResult(ImmutableList.of(), Optional.empty()), singleTable.fetchShardNextPage(accountIdShardedSchema, Optional.empty(), 100));

        assertEquals(2, storeImpl.upgradeAddGsi2ToAccountEmailSchema());
        assertEquals(0, storeImpl.upgradeAddGsi2ToAccountEmailSchema());
        assertEquals(acctOld1, accountIdByEmailOldSchema.fromItem(accountIdByEmailOldSchema.table().getItem(accountIdByEmailOldSchema.primaryKey(acctOld1))));
        assertEquals(acctOld2, accountIdByEmailOldSchema.fromItem(accountIdByEmailOldSchema.table().getItem(accountIdByEmailOldSchema.primaryKey(acctOld2))));
        assertEquals(acct1, accountIdByEmailSchema.fromItem(accountIdByEmailSchema.table().getItem(accountIdByEmailSchema.primaryKey(acct1))));
        assertEquals(acct2, accountIdByEmailSchema.fromItem(accountIdByEmailSchema.table().getItem(accountIdByEmailSchema.primaryKey(acct2))));
        assertEquals(new ShardPageResult<>(ImmutableList.of(acct1, acct2), Optional.empty()), singleTable.fetchShardNextPage(accountIdShardedSchema, Optional.empty(), 100));
    }
}
