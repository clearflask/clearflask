package com.smotana.clearflask.core.push;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

public interface PushProvider {

    boolean send(NotificationModel notification, String subscription);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class NotificationModel {
        @NonNull
        private final String notificationId;
        @NonNull
        private final String projectId;
        @NonNull
        private final String userId;
        @NonNull
        private final String title;
        private final String body;
        @NonNull
        private final String url;
    }
}
