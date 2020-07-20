package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoAccountStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.IdUtil;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.junit.Assert.*;

@Slf4j
public class AccountStoreTest extends AbstractTest {

    @Inject
    private AccountStore store;

    @Override
    protected void configure() {
        super.configure();

        install(DynamoAccountStore.module());
        install(InMemoryDynamoDbProvider.module());
        install(DynamoMapperImpl.module());
    }

    @Test(timeout = 10_000L)
    public void testAccount() throws Exception {
        Account account = new Account(
                store.genAccountId(),
                "my@email.com",
                SubscriptionStatus.ACTIVETRIAL,
                "planId1",
                Instant.now(),
                "name",
                "password",
                "paymentToken",
                ImmutableSet.of());
        store.createAccount(account);
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        account = account.toBuilder()
                .name("name2")
                .build();
        store.updateName(account.getAccountId(), account.getName());
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        AccountStore.AccountSession accountSession1 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        AccountStore.AccountSession accountSession2 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
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
        store.addProject(account.getAccountId(), projectId);
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        AccountStore.AccountSession accountSession = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        assertTrue(store.getSession(accountSession.getSessionId()).isPresent());

        String oldEmail = account.getEmail();
        account = account.toBuilder()
                .email("new@email.com")
                .build();
        store.updateEmail(account.getAccountId(), account.getEmail(), "");
        assertEquals(Optional.empty(), store.getAccountByEmail(oldEmail));
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));
        assertEquals(Optional.empty(), store.getSession(accountSession.getSessionId()));
        assertEquals(Optional.empty(), store.getSession(accountSession2.getSessionId()));

        store.deleteAccount(account.getAccountId());
        assertFalse(store.getAccountByAccountId(account.getAccountId()).isPresent());
        assertFalse(store.getAccountByEmail(account.getEmail()).isPresent());
    }

    @Test(timeout = 10_000L)
    public void testSession() throws Exception {
        Account account = new Account(
                store.genAccountId(),
                "my@email.com",
                SubscriptionStatus.ACTIVETRIAL,
                "planId1",
                Instant.now(),
                "name",
                "password",
                "paymentToken",
                ImmutableSet.of());
        store.createAccount(account);

        AccountStore.AccountSession accountSession1 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 1 {}", accountSession1);
        assertTrue(store.getSession(accountSession1.getSessionId()).isPresent());
        assertEquals(accountSession1, store.getSession(accountSession1.getSessionId()).get());

        AccountStore.AccountSession accountSession2 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 2 {}", accountSession2);
        assertTrue(store.getSession(accountSession2.getSessionId()).isPresent());
        assertEquals(accountSession2, store.getSession(accountSession2.getSessionId()).get());
        assertTrue(store.getSession(accountSession1.getSessionId()).isPresent());

        store.revokeSession(accountSession1.getSessionId());
        assertFalse(store.getSession(accountSession1.getSessionId()).isPresent());
        assertTrue(store.getSession(accountSession2.getSessionId()).isPresent());

        AccountStore.AccountSession accountSession3 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
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
