package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.smotana.clearflask.api.model.ConvoMessage.AuthorTypeEnum;
import com.smotana.clearflask.store.LlmHistoryStore;
import io.dataspray.singletable.IndexSchema;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

public class DynamoLlmHistoryStore implements LlmHistoryStore {

    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private SingleTable singleTable;

    private TableSchema<ConvoModel> convoSchema;
    private IndexSchema<ConvoModel> convoByProjectIdSchema;
    private TableSchema<MessageModel> messageSchema;

    @Inject
    private void setup() {
        convoSchema = singleTable.parseTableSchema(ConvoModel.class);
        convoByProjectIdSchema = singleTable.parseGlobalSecondaryIndexSchema(2, ConvoModel.class);
        messageSchema = singleTable.parseTableSchema(MessageModel.class);
    }

    @Override
    public ConvoModel createConvo(String projectId, String userId, String title) {
        ConvoModel convoModel = new ConvoModel(projectId,
                userId,
                genConvoId(),
                Instant.now(),
                title);
        convoSchema.table().putItem(convoSchema.toItem(convoModel));
        return convoModel;
    }

    @Override
    public Optional<ConvoModel> getConvo(String projectId, String userId, String convoId) {
        return Optional.ofNullable(convoSchema.fromItem(convoSchema.table().getItem(convoSchema.primaryKey(Map.of(
                "convoId", convoId,
                "projectId", projectId,
                "userId", userId)))));
    }

    @Override
    public ImmutableList<ConvoModel> listConvos(String projectId, String userId) {
        return StreamSupport.stream(convoSchema.table().query(new QuerySpec()
                                .withHashKey(convoSchema.partitionKey(Map.of(
                                        "projectId", projectId,
                                        "userId", userId)))
                                .withRangeKeyCondition(new RangeKeyCondition(convoSchema.rangeKeyName())
                                        .beginsWith(convoSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(convoSchema::fromItem)
                .collect(ImmutableList.toImmutableList());
    }

    @Override
    public void deleteConvo(String projectId, String userId, String convoId) {
        convoSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(convoSchema.primaryKey(Map.of(
                        "convoId", convoId,
                        "projectId", projectId,
                        "userId", userId))));

        Iterables.partition(
                        StreamSupport.stream(messageSchema.table().query(new QuerySpec()
                                                .withHashKey(messageSchema.partitionKey(Map.of(
                                                        "convoId", convoId)))
                                                .withRangeKeyCondition(new RangeKeyCondition(messageSchema.rangeKeyName())
                                                        .beginsWith(messageSchema.rangeValuePartial(Map.of()))))
                                        .pages()
                                        .spliterator(), false)
                                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                                .map(messageSchema::fromItem)
                                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(batch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(messageSchema.tableName());
                    batch.stream()
                            .map(messageModel -> messageSchema.primaryKey(Map.of(
                                    "convoId", messageModel.getConvoId(),
                                    "messageId", messageModel.getMessageId())))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
    }

    @Override
    public MessageModel putMessage(String convoId, AuthorTypeEnum authorType, String content) {
        MessageModel messageModel = new MessageModel(convoId,
                genMessageId(),
                Instant.now(),
                authorType,
                content);
        messageSchema.table().putItem(messageSchema.toItem(messageModel));
        return messageModel;
    }

    @Override
    public ImmutableList<MessageModel> getMessages(String convoId) {
        return StreamSupport.stream(messageSchema.table().query(new QuerySpec()
                                .withHashKey(messageSchema.partitionKey(Map.of(
                                        "convoId", convoId)))
                                .withRangeKeyCondition(new RangeKeyCondition(messageSchema.rangeKeyName())
                                        .beginsWith(messageSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(messageSchema::fromItem)
                .collect(ImmutableList.toImmutableList());
    }

    @Override
    public void deleteForProject(String projectId) {
        StreamSupport.stream(convoByProjectIdSchema.index().query(new QuerySpec()
                                .withHashKey(convoByProjectIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(convoByProjectIdSchema.rangeKeyName())
                                        .beginsWith(convoByProjectIdSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(convoByProjectIdSchema::fromItem)
                .forEach(convoModel -> {
                    deleteConvo(projectId, convoModel.getUserId(), convoModel.getConvoId());
                });
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LlmHistoryStore.class).to(DynamoLlmHistoryStore.class).asEagerSingleton();
            }
        };
    }
}
