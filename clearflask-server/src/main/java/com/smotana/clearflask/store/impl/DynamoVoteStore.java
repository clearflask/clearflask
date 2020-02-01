package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.KeyAttribute;
import com.amazonaws.services.dynamodbv2.document.Page;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.util.ServerSecret;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Singleton
public class DynamoVoteStore implements VoteStore {

    public interface Config {
        @DefaultValue("10")
        int listFetchMax();

        @DefaultValue("P30D")
        Duration transactionExpiry();
    }

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

    private TableSchema<VoteModel> voteSchema;
    private TableSchema<ExpressModel> expressSchema;
    private TableSchema<FundModel> fundSchema;
    private TableSchema<Transaction> transactionSchema;

    @Inject
    private void setup() {
        voteSchema = dynamoMapper.parseTableSchema(VoteModel.class);
        expressSchema = dynamoMapper.parseTableSchema(ExpressModel.class);
        fundSchema = dynamoMapper.parseTableSchema(FundModel.class);
        transactionSchema = dynamoMapper.parseTableSchema(Transaction.class);
    }

    @Override
    public Vote vote(String projectId, String userId, String targetId, Vote vote) {
        return Optional.ofNullable(voteSchema.fromItem(
                vote != Vote.None
                        ? voteSchema.table().putItem(new PutItemSpec()
                        .withItem(voteSchema.toItem(new VoteModel(userId, projectId, targetId, vote.getValue())))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()
                        : voteSchema.table().deleteItem(new DeleteItemSpec()
                        .withPrimaryKey(voteSchema.primaryKey(Map.of(
                                "userId", userId,
                                "projectId", projectId,
                                "targetId", targetId)))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()))
                .map(VoteModel::getVote)
                .map(Vote::fromValue)
                .orElse(Vote.None);
    }

    @Override
    public ImmutableMap<String, VoteModel> voteSearch(String projectId, String userId, ImmutableSet<String> targetIds) {
        return dynamoDoc.batchGetItem(new TableKeysAndAttributes(voteSchema.tableName()).withPrimaryKeys(targetIds.stream()
                .map(targetId -> voteSchema.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .toArray(PrimaryKey[]::new)))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(voteSchema::fromItem)
                .filter(v -> v.getVote() != Vote.None.getValue())
                .collect(ImmutableMap.toImmutableMap(
                        VoteModel::getTargetId,
                        i -> i));
    }

    @Override
    public ListResponse<VoteModel> voteList(String projectId, String userId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = voteSchema.table().query(new QuerySpec()
                .withHashKey(voteSchema.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(voteSchema.rangeKeyName())
                        .beginsWith(voteSchema.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                voteSchema.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(voteSchema.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> voteSchema.fromItem(item))
                        .filter(v -> v.getVote() != Vote.None.getValue())
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(m -> m.get(voteSchema.rangeKeyName()))
                        .map(AttributeValue::getS)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public ImmutableSet<String> express(String projectId, String userId, String targetId, Optional<String> expression) {
        return Optional.ofNullable(expressSchema.fromItem(
                expression.isPresent()
                        ? expressSchema.table().putItem(new PutItemSpec()
                        .withItem(expressSchema.toItem(new ExpressModel(userId, projectId, targetId, expression.map(ImmutableSet::of).orElse(ImmutableSet.of()))))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()
                        : expressSchema.table().deleteItem(new DeleteItemSpec()
                        .withPrimaryKey(expressSchema.primaryKey(Map.of(
                                "userId", userId,
                                "projectId", projectId,
                                "targetId", targetId)))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()))
                .map(ExpressModel::getExpressions)
                .orElse(ImmutableSet.of());
    }

    @Override
    public ImmutableSet<String> expressMultiAdd(String projectId, String userId, String targetId, ImmutableSet<String> addExpressions) {
        return expressMulti(projectId, userId, targetId,
                new AttributeUpdate("expressions").addElements(addExpressions.toArray()));
    }

    @Override
    public ImmutableSet<String> expressMultiRemove(String projectId, String userId, String targetId, ImmutableSet<String> removeExpressions) {
        return expressMulti(projectId, userId, targetId,
                new AttributeUpdate("expressions").removeElements(removeExpressions.toArray()));
    }

    private ImmutableSet<String> expressMulti(String projectId, String userId, String targetId, AttributeUpdate update) {
        return Optional.ofNullable(expressSchema.fromItem(expressSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(expressSchema.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .withAttributeUpdate(update)
                .withReturnValues(ReturnValue.ALL_OLD))
                .getItem()))
                .map(ExpressModel::getExpressions)
                .orElse(ImmutableSet.of());
    }

    @Override
    public ImmutableMap<String, ExpressModel> expressSearch(String projectId, String userId, ImmutableSet<String> targetIds) {
        return dynamoDoc.batchGetItem(new TableKeysAndAttributes(expressSchema.tableName()).withPrimaryKeys(targetIds.stream()
                .map(targetId -> expressSchema.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .toArray(PrimaryKey[]::new)))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(expressSchema::fromItem)
                .filter(e -> !e.getExpressions().isEmpty())
                .collect(ImmutableMap.toImmutableMap(
                        ExpressModel::getTargetId,
                        i -> i));
    }

    @Override
    public ListResponse<ExpressModel> expressList(String projectId, String userId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = expressSchema.table().query(new QuerySpec()
                .withHashKey(expressSchema.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(expressSchema.rangeKeyName())
                        .beginsWith(expressSchema.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                expressSchema.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(expressSchema.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> expressSchema.fromItem(item))
                        .filter(e -> !e.getExpressions().isEmpty())
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(m -> m.get(expressSchema.rangeKeyName()))
                        .map(AttributeValue::getS)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public Transaction fund(String projectId, String userId, String targetId, long fundAmount, String transactionType, String summary) {
        long fundAmountPrevious = Optional.ofNullable(fundSchema.fromItem(
                fundAmount != 0L
                        ? fundSchema.table().putItem(new PutItemSpec()
                        .withItem(fundSchema.toItem(new FundModel(userId, projectId, targetId, fundAmount)))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()
                        : fundSchema.table().deleteItem(new DeleteItemSpec()
                        .withPrimaryKey(fundSchema.primaryKey(Map.of(
                                "userId", userId,
                                "projectId", projectId,
                                "targetId", targetId)))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()))
                .map(FundModel::getFundAmount)
                .orElse(0L);
        long fundDifference = fundAmount - fundAmountPrevious;
        Transaction transaction = new Transaction(
                userId,
                projectId,
                genTransactionId(),
                Instant.now(),
                fundDifference,
                transactionType,
                targetId,
                summary,
                Instant.now().plus(config.transactionExpiry()).getEpochSecond());
        transactionSchema.table().putItem(new PutItemSpec()
                .withItem(transactionSchema.toItem(transaction))
                .withConditionExpression("attribute_not_exists(#partitionKey)")
                .withNameMap(new NameMap().with("#partitionKey", transactionSchema.partitionKeyName())));
        return transaction;
    }

    @Override
    public ImmutableMap<String, FundModel> fundSearch(String projectId, String userId, ImmutableSet<String> targetIds) {
        return dynamoDoc.batchGetItem(new TableKeysAndAttributes(fundSchema.tableName()).withPrimaryKeys(targetIds.stream()
                .map(targetId -> fundSchema.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .toArray(PrimaryKey[]::new)))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(fundSchema::fromItem)
                .filter(f -> f.getFundAmount() != 0L)
                .collect(ImmutableMap.toImmutableMap(
                        FundModel::getTargetId,
                        i -> i));
    }

    @Override
    public ListResponse<FundModel> fundList(String projectId, String userId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = fundSchema.table().query(new QuerySpec()
                .withHashKey(fundSchema.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(fundSchema.rangeKeyName())
                        .beginsWith(fundSchema.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                fundSchema.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(fundSchema.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> fundSchema.fromItem(item))
                        .filter(f -> f.getFundAmount() != 0L)
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(m -> m.get(fundSchema.rangeKeyName()))
                        .map(AttributeValue::getS)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public ListResponse<Transaction> transactionList(String projectId, String userId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = transactionSchema.table().query(new QuerySpec()
                .withHashKey(transactionSchema.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(transactionSchema.rangeKeyName())
                        .beginsWith(transactionSchema.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                transactionSchema.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(transactionSchema.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> transactionSchema.fromItem(item))
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(m -> m.get(transactionSchema.rangeKeyName()))
                        .map(AttributeValue::getS)
                        .map(serverSecretCursor::encryptString));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(VoteStore.class).to(DynamoVoteStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
