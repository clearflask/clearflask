package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
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

    @Test(timeout = 5_000L)
    public void testAccount() throws Exception {
        Account account = new Account(
                IdUtil.randomId(),
                ImmutableSet.of("planId1"),
                "company",
                "name",
                "my@email.com",
                "password",
                "123456",
                "paymentToken",
                ImmutableSet.of());
        store.createAccount(account);
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        account = account.toBuilder()
                .name("name2")
                .build();
        store.updateAccountName(account.getAccountId(), account.getName());
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));

        AccountStore.Session session1 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS));
        AccountStore.Session session2 = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS));
        account = account.toBuilder()
                .password("password2")
                .build();
        store.updateAccountPassword(account.getAccountId(), account.getPassword(), session1.getSessionId());
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));
        assertEquals(Optional.of(session1), store.getSession(account.getAccountId(), session1.getSessionId()));
        assertEquals(Optional.empty(), store.getSession(account.getAccountId(), session2.getSessionId()));

        String projectId = IdUtil.randomId();
        account = account.toBuilder()
                .projectIds(ImmutableSet.<String>builder()
                        .add(projectId)
                        .addAll(account.getProjectIds())
                        .build())
                .build();
        store.addAccountProjectId(account.getAccountId(), projectId);
        assertEquals(Optional.of(account), store.getAccount(account.getAccountId()));

        AccountStore.Session session = store.createSession(account.getAccountId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS));
        assertTrue(store.getSession(account.getAccountId(), session.getSessionId()).isPresent());

        String oldEmail = account.getEmail();
        account = account.toBuilder()
                .email("new@email.com")
                .build();
        store.updateAccountEmail(account.getAccountId(), oldEmail, account.getEmail());
        assertEquals(Optional.empty(), store.getAccountByEmail(oldEmail));
        assertEquals(Optional.of(account), store.getAccountByEmail(account.getEmail()));
        assertEquals(Optional.empty(), store.getSession(account.getAccountId(), session.getSessionId()));
        assertEquals(Optional.empty(), store.getSession(account.getAccountId(), session2.getSessionId()));
    }

    @Test(timeout = 5_000L)
    public void testSession() throws Exception {
        Account account = new Account(
                IdUtil.randomId(),
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

        Instant refreshedExpiry = Instant.ofEpochMilli(System.currentTimeMillis()).plus(2, ChronoUnit.DAYS);
        store.refreshSession(account.getAccountId(), session3.getSessionId(), refreshedExpiry);
        assertTrue(store.getSession(account.getAccountId(), session3.getSessionId()).isPresent());
        assertEquals(refreshedExpiry, store.getSession(account.getAccountId(), session3.getSessionId()).get().getExpiry());

        store.revokeSessions(account.getAccountId());
        assertFalse(store.getSession(account.getAccountId(), session3.getSessionId()).isPresent());
    }
}
