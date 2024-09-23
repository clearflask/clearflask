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
import com.smotana.clearflask.store.LlmHistoryStore;
import io.dataspray.singletable.IndexSchema;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;

import java.time.Instant;
import java.util.Map;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

public class DynamoLlmHistoryStore implements LlmHistoryStore {

    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private SingleTable singleTable;

    private TableSchema<Convo> convoSchema;
    private IndexSchema<Convo> convoByProjectIdSchema;
    private TableSchema<Message> messageSchema;

    @Inject
    private void setup() {
        convoSchema = singleTable.parseTableSchema(Convo.class);
        convoByProjectIdSchema = singleTable.parseGlobalSecondaryIndexSchema(2, Convo.class);
        messageSchema = singleTable.parseTableSchema(Message.class);
    }

    @Override
    public Convo createConvo(String projectId, String userId, String title) {
        Convo convo = new Convo(projectId,
                userId,
                genConvoId(),
                Instant.now(),
                title);
        convoSchema.table().putItem(convoSchema.toItem(convo));
        return convo;
    }

    @Override
    public ImmutableList<Convo> getConvos(String projectId, String userId) {
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
                            .map(message -> messageSchema.primaryKey(Map.of(
                                    "convoId", message.getConvoId(),
                                    "messageId", message.getMessageId())))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
    }

    @Override
    public Message putMessage(String convoId, AuthorType authorType, String content) {
        Message message = new Message(convoId,
                genMessageId(),
                Instant.now(),
                authorType,
                content);
        messageSchema.table().putItem(messageSchema.toItem(message));
        return message;
    }

    @Override
    public ImmutableList<Message> getMessages(String convoId) {
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
                .forEach(convo -> {
                    deleteConvo(projectId, convo.getUserId(), convo.getConvoId());
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
