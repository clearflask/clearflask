package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
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
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.util.StringableSecretKey;
import com.smotana.clearflask.web.security.Sanitizer;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                DynamoElasticAccountStore.module(),
                ElasticUtil.module(),
                Sanitizer.module(),
                DefaultServerSecret.module(Names.named("cursor"))
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
                ImmutableSet.of());
        store.createAccount(account).getIndexingFuture().get();
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        account = account.toBuilder()
                .name("name2")
                .build();
        store.updateName(account.getAccountId(), account.getName()).getIndexingFuture().get();
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        AccountStore.AccountSession accountSession1 = store.createSession(account, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        AccountStore.AccountSession accountSession2 = store.createSession(account, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        account = account.toBuilder()
                .password("password2")
                .build();
        store.updatePassword(account.getAccountId(), account.getPassword(), accountSession1.getSessionId());
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));
        assertEquals(Optional.of(accountSession1), store.getSession(accountSession1.getSessionId()));
        assertEquals(Optional.empty(), store.getSession(accountSession2.getSessionId()));

        String projectId = IdUtil.randomId();
        account = account.toBuilder()
                .projectIds(ImmutableSet.<String>builder()
                        .add(projectId)
                        .addAll(account.getProjectIds())
                        .build())
                .build();
        store.addProject(account.getAccountId(), projectId).getIndexingFuture().get();
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
        assertFalse(store.getAccountByAccountId(account.getAccountId()).isPresent());
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
                ImmutableSet.of());
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
}
