package com.smotana.clearflask.core.push;

import com.google.common.util.concurrent.ListenableFuture;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

// TODO
public interface NotificationService {

    ListenableFuture<Void> send(String projectId, String userId, String message);

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
