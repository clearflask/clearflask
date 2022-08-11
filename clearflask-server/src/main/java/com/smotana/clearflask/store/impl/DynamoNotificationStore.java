// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.KeyAttribute;
import com.amazonaws.services.dynamodbv2.document.Page;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.NotificationStore;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.ServerSecret;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.extern.slf4j.Slf4j;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

@Slf4j
@Singleton
public class DynamoNotificationStore implements NotificationStore {

    public interface Config {
        @DefaultValue("10")
        int searchFetchMax();
    }

    @Inject
    private Config config;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private SingleTable singleTable;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;

    private TableSchema<NotificationModel> notificationSchema;

    @Inject
    private void setup() {
        notificationSchema = singleTable.parseTableSchema(NotificationModel.class);
    }

    @Override
    public void notificationCreate(NotificationModel notification) {
        notificationSchema.table().putItem(new PutItemSpec()
                .withItem(notificationSchema.toItem(notification)));
    }

    @Override
    public void notificationsCreate(Collection<NotificationModel> notifications) {

        Iterables.partition(notifications, DYNAMO_WRITE_BATCH_MAX_SIZE).forEach(batch -> {
            singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(notificationSchema.tableName())
                    .withItemsToPut(batch.stream()
                            .map(notificationSchema::toItem)
                            .collect(ImmutableList.toImmutableList()))));
        });
    }

    @Override
    public NotificationListResponse notificationList(String projectId, String userId, Optional<String> cursorOpt) {
        ItemCollection<QueryOutcome> results = notificationSchema.table().query(new QuerySpec()
                .withHashKey(notificationSchema.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(notificationSchema.rangeKeyName())
                        .beginsWith(notificationSchema.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.searchFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                notificationSchema.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(notificationSchema.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)));
        Page<Item, QueryOutcome> page = results.firstPage();
        ImmutableList<NotificationModel> notifications = page
                .getLowLevelResult()
                .getItems()
                .stream()
                .map(item -> notificationSchema.fromItem(item))
                .collect(ImmutableList.toImmutableList());
        Optional<String> newCursorOpt = Optional.ofNullable(page
                        .getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                .map(m -> m.get(notificationSchema.rangeKeyName()))
                .map(AttributeValue::getS)
                .map(serverSecretCursor::encryptString);
        return new NotificationListResponse(notifications, newCursorOpt);
    }

    @Extern
    @Override
    public void notificationClear(String projectId, String userId, String notificationId) {
        notificationSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(notificationSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId,
                        "notificationId", notificationId))));
    }

    @Extern
    @Override
    public void notificationClearAll(String projectId, String userId) {
        Iterables.partition(StreamSupport.stream(notificationSchema.table().query(new QuerySpec()
                                        .withHashKey(notificationSchema.partitionKey(Map.of(
                                                "userId", userId,
                                                "projectId", projectId)))
                                        .withRangeKeyCondition(new RangeKeyCondition(notificationSchema.rangeKeyName())
                                                .beginsWith(notificationSchema.rangeValuePartial(Map.of()))))
                                .pages()
                                .spliterator(), false)
                        .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                        .map(notificationSchema::fromItem)
                        .map(NotificationModel::getNotificationId)
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(notificationIdsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(notificationSchema.tableName());
                    notificationIdsBatch.stream()
                            .map(notificationId -> notificationSchema.primaryKey(Map.of(
                                    "userId", userId,
                                    "projectId", projectId,
                                    "notificationId", notificationId)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(NotificationStore.class).to(DynamoNotificationStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
