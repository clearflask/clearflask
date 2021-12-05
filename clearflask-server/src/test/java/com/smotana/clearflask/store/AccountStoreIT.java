// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Maps;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoElasticAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.ProjectUpgraderImpl;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.util.StringableSecretKey;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Optional;

import static io.jsonwebtoken.SignatureAlgorithm.HS512;
import static org.junit.Assert.*;

@Slf4j
public class AccountStoreIT extends AbstractIT {

    @Inject
    private AccountStore store;

    @Override
    protected void configure() {
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                DynamoElasticAccountStore.module(),
                DynamoProjectStore.module(),
                ProjectUpgraderImpl.module(),
                Application.module(),
                IntercomUtil.module(),
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
                StringableSecretKey privKey = new StringableSecretKey(Keys.secretKeyFor(HS512));
                log.trace("Using generated priv key: {}", privKey);
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
}
