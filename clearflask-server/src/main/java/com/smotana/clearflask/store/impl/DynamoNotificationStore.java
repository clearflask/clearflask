package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ResourceNotFoundException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.services.dynamodbv2.model.TimeToLiveSpecification;
import com.amazonaws.services.dynamodbv2.model.UpdateTimeToLiveRequest;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.NotificationStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.util.ServerSecret;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;
import java.util.stream.StreamSupport;

@Slf4j
@Singleton
public class DynamoNotificationStore extends ManagedService implements NotificationStore {

    public interface Config {
        @DefaultValue("10")
        int maxResultSize();
    }

    private static final String NOTIFICATION_TABLE = "notification";

    @Inject
    private Config config;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;

    private Table notificationTable;

    @Override
    protected void serviceStart() throws Exception {
        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(NOTIFICATION_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("id").withKeyType(KeyType.HASH),
                            new KeySchemaElement().withAttributeName("notificationId").withKeyType(KeyType.RANGE)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("id").withAttributeType(ScalarAttributeType.S),
                            new AttributeDefinition().withAttributeName("notificationId").withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            dynamo.updateTimeToLive(new UpdateTimeToLiveRequest()
                    .withTableName(NOTIFICATION_TABLE)
                    .withTimeToLiveSpecification(new TimeToLiveSpecification()
                            .withEnabled(true)
                            .withAttributeName("expiry")));
            log.debug("Table {} created", NOTIFICATION_TABLE);
        } catch (ResourceNotFoundException ex) {
            log.debug("Table {} already exists", NOTIFICATION_TABLE);
        }
        notificationTable = dynamoDoc.getTable(NOTIFICATION_TABLE);
    }

    @Override
    public NotificationModel notificationCreate(NotificationModel notification) {
        notificationTable.putItem(dynamoMapper.toItem(notification));
        return notification;
    }

    @Override
    public NotificationListResponse notificationList(String projectId, String userId, Optional<String> cursorOpt) {
        String id = dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "userId", userId), NotificationModel.class);
        ItemCollection<QueryOutcome> results = notificationTable.query(new QuerySpec()
                .withHashKey("id", id)
                .withMaxResultSize(config.maxResultSize())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                "id", id,
                                "notificationId", lastEvaluatedKey))
                        .orElse(null)));
        ImmutableList<NotificationModel> notifications = StreamSupport.stream(results.pages().spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(item -> dynamoMapper.fromItem(item, NotificationModel.class))
                .collect(ImmutableList.toImmutableList());
        Optional<String> newCursorOpt = Optional.ofNullable(results.getLastLowLevelResult()
                .getQueryResult()
                .getLastEvaluatedKey())
                .map(m -> m.get("notificationId"))
                .map(AttributeValue::getS)
                .map(serverSecretCursor::encryptString);
        return new NotificationListResponse(notifications, newCursorOpt);
    }

    @Override
    public void notificationClear(String projectId, String userId, String notificationId) {
        notificationTable.deleteItem(
                "id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "userId", userId), NotificationModel.class),
                "notificationId", notificationId);
    }

    @Override
    public void notificationClearAll(String projectId, String userId) {
        String id = dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "userId", userId), NotificationModel.class);
        ItemCollection<QueryOutcome> items = notificationTable.query(new QuerySpec()
                .withMaxPageSize(25)
                .withKeyConditionExpression("#i = :i")
                .withNameMap(ImmutableMap.of("#i", "id"))
                .withValueMap(ImmutableMap.of(":i", id)));
        items.pages().forEach(page -> {
            TableWriteItems tableWriteItems = new TableWriteItems(NOTIFICATION_TABLE);
            page.forEach(item -> {
                tableWriteItems.addHashAndRangePrimaryKeyToDelete(
                        "id", id,
                        "notificationId", item.getString("notificationId"));
            });
            if (tableWriteItems.getPrimaryKeysToDelete() == null || tableWriteItems.getPrimaryKeysToDelete().size() <= 0) {
                return;
            }
            dynamoDoc.batchWriteItem(tableWriteItems);
        });
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(NotificationStore.class).to(DynamoNotificationStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoNotificationStore.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
