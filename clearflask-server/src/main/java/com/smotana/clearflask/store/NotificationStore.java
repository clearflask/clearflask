// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.Notification;
import com.smotana.clearflask.util.IdUtil;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.util.Collection;
import java.util.Optional;

import static io.dataspray.singletable.TableType.Primary;

public interface NotificationStore {

    default String genNotificationId() {
        // NotificationId is a range key and we want them to be sorted by creation time when listing
        return IdUtil.randomAscId();
    }

    void notificationCreate(NotificationModel notification);

    void notificationsCreate(Collection<NotificationModel> notifications);

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
