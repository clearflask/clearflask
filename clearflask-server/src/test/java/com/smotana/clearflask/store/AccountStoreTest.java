package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoAccountStore;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

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

    @Test
    public void testAccount() throws Exception {
        Account account = new Account(
                UUID.randomUUID().toString(),
                ImmutableSet.of("planId1"),
                "company",
                "name",
                "my@email.com",
                "password",
                "123456",
                "paymentToken",
                ImmutableSet.of());
        store.createAccount(account);
        assertTrue(store.getAccountByEmail(account.getEmail()).isPresent());
        assertEquals(account, store.getAccountByEmail(account.getEmail()).get());

        String newName = "name2";
        store.updateAccountName(account.getAccountId(), newName);
        assertEquals(newName, store.getAccountByEmail(account.getEmail()).get().getName());

        String newPass = "password2";
        store.updateAccountPassword(account.getAccountId(), newPass);
        assertEquals(newPass, store.getAccountByEmail(account.getEmail()).get().getPassword());

        AccountStore.Session session = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS));
        assertTrue(store.getSession(account.getAccountId(), session.getSessionId()).isPresent());

        String newEmail = "new@email.com";
        store.updateAccountEmail(account.getAccountId(), account.getEmail(), newEmail);
        assertFalse(store.getAccountByEmail(account.getEmail()).isPresent());
        assertTrue(store.getAccountByEmail(newEmail).isPresent());
        assertEquals(newEmail, store.getAccountByEmail(newEmail).get().getEmail());
        assertEquals(newName, store.getAccountByEmail(newEmail).get().getName());
        assertFalse(store.getSession(account.getAccountId(), session.getSessionId()).isPresent());
    }

    @Test
    public void testSession() throws Exception {
        Account account = new Account(
                UUID.randomUUID().toString(),
                ImmutableSet.of("planId1"),
                "company",
                "name",
                "my@email.com",
                "password",
                "123456",
                "paymentToken",
                ImmutableSet.of());
        store.createAccount(account);

        AccountStore.Session session1 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS));
        log.info("Created session 1 {}", session1);
        assertTrue(store.getSession(account.getAccountId(), session1.getSessionId()).isPresent());
        assertEquals(session1, store.getSession(account.getAccountId(), session1.getSessionId()).get());

        AccountStore.Session session2 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS));
        log.info("Created session 2 {}", session2);
        assertTrue(store.getSession(account.getAccountId(), session2.getSessionId()).isPresent());
        assertEquals(session2, store.getSession(account.getAccountId(), session2.getSessionId()).get());
        assertTrue(store.getSession(account.getAccountId(), session1.getSessionId()).isPresent());

        store.revokeSession(account.getAccountId(), session1.getSessionId());
        assertFalse(store.getSession(account.getAccountId(), session1.getSessionId()).isPresent());
        assertTrue(store.getSession(account.getAccountId(), session2.getSessionId()).isPresent());

        AccountStore.Session session3 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS));
        log.info("Created session 3 {}", session3);
        assertTrue(store.getSession(account.getAccountId(), session3.getSessionId()).isPresent());
        assertEquals(session3, store.getSession(account.getAccountId(), session3.getSessionId()).get());
        assertTrue(store.getSession(account.getAccountId(), session2.getSessionId()).isPresent());

        store.revokeSessions(account.getAccountId(), session3.getSessionId());
        assertFalse(store.getSession(account.getAccountId(), session2.getSessionId()).isPresent());
        assertTrue(store.getSession(account.getAccountId(), session3.getSessionId()).isPresent());

        store.revokeSessions(account.getAccountId());
        assertFalse(store.getSession(account.getAccountId(), session3.getSessionId()).isPresent());
    }
}
