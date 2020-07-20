package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.Notification;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface NotificationStore {

    default String genNotificationId() {
        // NotificationId is a range key and we want them to be sorted by creation time when listing
        return IdUtil.randomAscId();
    }

    void notificationCreate(NotificationModel notification);

    NotificationListResponse notificationList(String projectId, String userId, Optional<String> cursorOpt);

    void notificationClear(String projectId, String userId, String notificationId);

    void notificationClearAll(String projectId, String userId);

    @Value
    class NotificationListResponse {
        ImmutableList<NotificationModel> notifications;
        Optional<String> cursorOpt;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "notification", rangeKeys = "notificationId")
    class NotificationModel {

        @NonNull
        String projectId;

        @NonNull
        String userId;

        @NonNull
        String notificationId;

        @NonNull
        String relatedIdeaId;

        String relatedCommentId;

        @NonNull
        Instant created;

        @NonNull
        long ttlInEpochSec;

        @NonNull
        String description;

        public Notification toNotification() {
            return new Notification(
                    getProjectId(),
                    getNotificationId(),
                    getUserId(),
                    getRelatedIdeaId(),
                    getRelatedCommentId(),
                    getCreated(),
                    getDescription());
        }
    }
}
