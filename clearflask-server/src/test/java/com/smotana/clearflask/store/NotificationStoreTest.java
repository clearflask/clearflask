// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.NotificationStore.NotificationListResponse;
import com.smotana.clearflask.store.NotificationStore.NotificationModel;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.DynamoNotificationStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ServerSecretTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.junit.Assert.*;

@Slf4j
public class NotificationStoreTest extends AbstractTest {

    @Inject
    private NotificationStore store;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DynamoNotificationStore.module(),
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                DefaultServerSecret.module(Names.named("cursor"))
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoNotificationStore.Config.class, om -> {
                    om.override(om.id().searchFetchMax()).withValue(10);
                }));
            }
        }));
    }

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        String projectId = IdUtil.randomId();
        String userId = IdUtil.randomId();

        NotificationModel notification1 = randomNotification(projectId, userId, "description 1");
        store.notificationCreate(notification1);
        assertEquals(ImmutableList.of(notification1), store.notificationList(projectId, userId, Optional.empty()).getNotifications());

        NotificationModel notification2 = randomNotification(projectId, userId, "description 2");
        store.notificationCreate(notification2);
        assertEquals(ImmutableList.of(notification2, notification1), store.notificationList(projectId, userId, Optional.empty()).getNotifications());

        NotificationModel notification3 = randomNotification(projectId, userId, "description 3");
        store.notificationCreate(notification3);
        assertEquals(ImmutableList.of(notification3, notification2, notification1), store.notificationList(projectId, userId, Optional.empty()).getNotifications());

        configSet(DynamoNotificationStore.Config.class, "searchFetchMax", "2");
        NotificationListResponse result = store.notificationList(projectId, userId, Optional.empty());
        assertEquals(ImmutableList.of(notification3, notification2), result.getNotifications());
        assertTrue(result.getCursorOpt().isPresent());

        result = store.notificationList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(notification1), result.getNotifications());
        assertFalse(result.getCursorOpt().isPresent());

        store.notificationClear(projectId, userId, notification2.getNotificationId());
        result = store.notificationList(projectId, userId, Optional.empty());
        assertEquals(ImmutableList.of(notification3, notification1), result.getNotifications());
        assertTrue(result.getCursorOpt().isPresent());

        result = store.notificationList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(), result.getNotifications());
        assertFalse(result.getCursorOpt().isPresent());

        store.notificationClearAll(projectId, userId);
        assertEquals(ImmutableList.of(), store.notificationList(projectId, userId, Optional.empty()).getNotifications());
    }

    private NotificationModel randomNotification(String projectId, String userId, String description) {
        return new NotificationModel(
                projectId,
                userId,
                store.genNotificationId(),
                IdUtil.randomId(),
                null,
                Instant.now(),
                Instant.now().plus(1, ChronoUnit.HOURS).getEpochSecond(),
                description
        );
    }
}