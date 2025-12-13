package com.smotana.clearflask.core.email;

import com.google.common.util.concurrent.ControllableSleepingStopwatch;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.smotana.clearflask.billing.PlanVerifyStore;
import com.smotana.clearflask.core.email.WeeklyDigestService.WeeklyDigestWork;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.DynamoTokenVerifyStore;
import com.smotana.clearflask.testutil.AbstractTest;
import org.junit.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.Assert.*;

public class WeeklyDigestServiceLockingTest extends AbstractTest {

    @Inject
    private WeeklyDigestService weeklyDigestService;


    @Override
    protected void configure() {
        super.configure();

        bindMock(AccountStore.class);
        bindMock(IdeaStore.class);
        bindMock(UserStore.class);
        bindMock(ProjectStore.class);
        bindMock(NotificationStore.class);
        bindMock(NotificationService.class);
        bindMock(PlanVerifyStore.class);

        ControllableSleepingStopwatch controllableSleepingStopwatch = new ControllableSleepingStopwatch();
        install(GuavaRateLimiters.testModule(controllableSleepingStopwatch));
        bind(ControllableSleepingStopwatch.class).toInstance(controllableSleepingStopwatch);

        install(Modules.override(
                WeeklyDigestService.module(),
                DynamoTokenVerifyStore.module(),
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
            }
        }));
    }

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        // No lock set
        Instant now = Instant.now();
        assertEquals(Optional.empty(), weeklyDigestService.checkLock(now));

        // Lock it successfully
        assertTrue(weeklyDigestService.lock(now));
        assertEquals(Optional.of(WeeklyDigestService.Status.PROCESSING), weeklyDigestService.checkLock(now)
                .map(WeeklyDigestWork::getStatus));

        // Lock it again, should fail
        assertFalse(weeklyDigestService.lock(now));
        assertEquals(Optional.of(WeeklyDigestService.Status.PROCESSING), weeklyDigestService.checkLock(now)
                .map(WeeklyDigestWork::getStatus));

        // Complete it
        weeklyDigestService.complete(now);
        assertEquals(Optional.of(WeeklyDigestService.Status.COMPLETE), weeklyDigestService.checkLock(now)
                .map(WeeklyDigestWork::getStatus));
    }
}