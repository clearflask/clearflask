package com.smotana.clearflask.core.push.provider;

import com.google.common.collect.Queues;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.store.NotificationStore;
import com.smotana.clearflask.web.NotImplementedException;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;
import java.util.concurrent.BlockingQueue;

@Slf4j
@Singleton
public class MockNotificationStore implements NotificationStore {

    public final BlockingQueue<NotificationModel> sent = Queues.newLinkedBlockingDeque();

    @Override
    public void notificationCreate(NotificationModel notification) {
        log.info("Send {}", notification);
        this.sent.add(notification);
    }

    @Override
    public NotificationListResponse notificationList(String projectId, String userId, Optional<String> cursorOpt) {
        throw new NotImplementedException();
    }

    @Override
    public void notificationClear(String projectId, String userId, String notificationId) {
        throw new NotImplementedException();
    }

    @Override
    public void notificationClearAll(String projectId, String userId) {
        throw new NotImplementedException();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(NotificationStore.class).to(MockNotificationStore.class).asEagerSingleton();
            }
        };
    }
}
