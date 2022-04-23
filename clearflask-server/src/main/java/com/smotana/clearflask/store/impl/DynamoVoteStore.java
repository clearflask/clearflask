// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.KeyAttribute;
import com.amazonaws.services.dynamodbv2.document.Page;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.collect.Maps;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.TransactionType;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.dynamo.DynamoUtil;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

@Slf4j
@Singleton
public class DynamoVoteStore implements VoteStore {

    private String apply(Map<String, AttributeValue> m) {
        return fundSchemaByTarget.serializeLastEvaluatedKey(m);
    }

    public interface Config {
        @DefaultValue("10")
        int listFetchMax();

        @DefaultValue("P30D")
        Duration transactionExpiry();
    }

    @Inject
    private Config config;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    private DynamoUtil dynamoUtil;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;

    private TableSchema<VoteModel> voteSchemaByUser;
    private IndexSchema<VoteModel> voteSchemaByTarget;
    private IndexSchema<VoteModel> voteSchemaByProjectId;
    private TableSchema<ExpressModel> expressSchemaByUser;
    private IndexSchema<ExpressModel> expressSchemaByTarget;
    private IndexSchema<ExpressModel> expressSchemaByProjectId;
    private TableSchema<FundModel> fundSchemaByUser;
    private IndexSchema<FundModel> fundSchemaByTarget;
    private IndexSchema<FundModel> fundSchemaByProjectId;
    private TableSchema<TransactionModel> transactionSchema;
    private IndexSchema<TransactionModel> transactionByProjectIdSchema;

    @Inject
    private void setup() {
        voteSchemaByUser = dynamoMapper.parseTableSchema(VoteModel.class);
        voteSchemaByTarget = dynamoMapper.parseGlobalSecondaryIndexSchema(1, VoteModel.class);
        voteSchemaByProjectId = dynamoMapper.parseGlobalSecondaryIndexSchema(2, VoteModel.class);
        expressSchemaByUser = dynamoMapper.parseTableSchema(ExpressModel.class);
        expressSchemaByTarget = dynamoMapper.parseGlobalSecondaryIndexSchema(1, ExpressModel.class);
        expressSchemaByProjectId = dynamoMapper.parseGlobalSecondaryIndexSchema(2, ExpressModel.class);
        fundSchemaByUser = dynamoMapper.parseTableSchema(FundModel.class);
        fundSchemaByTarget = dynamoMapper.parseGlobalSecondaryIndexSchema(1, FundModel.class);
        fundSchemaByProjectId = dynamoMapper.parseGlobalSecondaryIndexSchema(2, FundModel.class);
        transactionSchema = dynamoMapper.parseTableSchema(TransactionModel.class);
        transactionByProjectIdSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(2, TransactionModel.class);
    }

    @Extern
    @Override
    public VoteValue vote(String projectId, String userId, String targetId, VoteValue vote) {
        return Optional.ofNullable(voteSchemaByUser.fromItem(
                vote != VoteValue.None
                        ? voteSchemaByUser.table().putItem(new PutItemSpec()
                        .withItem(voteSchemaByUser.toItem(new VoteModel(userId, projectId, targetId, vote.getValue())))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()
                        : voteSchemaByUser.table().deleteItem(new DeleteItemSpec()
                        .withPrimaryKey(voteSchemaByUser.primaryKey(Map.of(
                                "userId", userId,
                                "projectId", projectId,
                                "targetId", targetId)))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()))
                .map(VoteModel::getVote)
                .map(VoteValue::fromValue)
                .orElse(VoteValue.None);
    }

    @Override
    public ImmutableMap<String, VoteModel> voteSearch(String projectId, String userId, ImmutableSet<String> targetIds) {
        if (targetIds.isEmpty()) {
            return ImmutableMap.of();
        }
        return dynamoUtil.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(voteSchemaByUser.tableName()).withPrimaryKeys(targetIds.stream()
                .map(targetId -> voteSchemaByUser.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .toArray(PrimaryKey[]::new))))
                .map(voteSchemaByUser::fromItem)
                .filter(v -> v.getVote() != VoteValue.None.getValue())
                .collect(ImmutableMap.toImmutableMap(
                        VoteModel::getTargetId,
                        i -> i));
    }

    @Override
    public ListResponse<VoteModel> voteListByUser(String projectId, String userId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = voteSchemaByUser.table().query(new QuerySpec()
                .withHashKey(voteSchemaByUser.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(voteSchemaByUser.rangeKeyName())
                        .beginsWith(voteSchemaByUser.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                voteSchemaByUser.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(voteSchemaByUser.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> voteSchemaByUser.fromItem(item))
                        .filter(v -> v.getVote() != VoteValue.None.getValue())
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(m -> m.get(voteSchemaByUser.rangeKeyName()))
                        .map(AttributeValue::getS)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public ListResponse<VoteModel> voteListByTarget(String projectId, String targetId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = voteSchemaByTarget.index().query(new QuerySpec()
                .withHashKey(voteSchemaByTarget.partitionKey(Map.of(
                        "targetId", targetId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(voteSchemaByTarget.rangeKeyName())
                        .beginsWith(voteSchemaByTarget.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(voteSchemaByTarget::toExclusiveStartKey)
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> voteSchemaByTarget.fromItem(item))
                        .filter(v -> v.getVote() != VoteValue.None.getValue())
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(voteSchemaByTarget::serializeLastEvaluatedKey)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public ImmutableSet<String> express(String projectId, String userId, String targetId, Optional<String> expression) {
        return Optional.ofNullable(expressSchemaByUser.fromItem(
                expression.isPresent()
                        ? expressSchemaByUser.table().putItem(new PutItemSpec()
                        .withItem(expressSchemaByUser.toItem(new ExpressModel(userId, projectId, targetId, expression.map(ImmutableSet::of).orElse(ImmutableSet.of()))))
                        .withReturnValues(ReturnValue.ALL_OLD))
                        .getItem()
                        : expressSchemaByUser.table().deleteItem(new DeleteItemSpec()
                        .withPrimaryKey(expressSchemaByUser.primaryKey(Map.of(
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
        return expressMulti(projectId, userId, targetId, addExpressions, true);
    }

    @Override
    public ImmutableSet<String> expressMultiRemove(String projectId, String userId, String targetId, ImmutableSet<String> removeExpressions) {
        return expressMulti(projectId, userId, targetId, removeExpressions, false);
    }

    private ImmutableSet<String> expressMulti(String projectId, String userId, String targetId, ImmutableSet<String> expressions, boolean isAdd) {
        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, Object> valueMap = Maps.newHashMap();
        nameMap.put("#expressions", "expressions");
        valueMap.put(":expressions", expressions);
        String updateExpression = expressSchemaByUser.upsertExpression(new ExpressModel(userId, projectId, targetId, ImmutableSet.of()), nameMap, valueMap,
                ImmutableSet.of("expressions"), (isAdd ? " ADD " : " DELETE ") + " #expressions :expressions");
        log.trace("ExpressMulti expression: {}", updateExpression);
        return Optional.ofNullable(expressSchemaByUser.fromItem(expressSchemaByUser.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(expressSchemaByUser.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .withUpdateExpression(updateExpression)
                .withNameMap(nameMap)
                .withValueMap(valueMap)
                .withReturnValues(ReturnValue.ALL_OLD))
                .getItem()))
                .map(ExpressModel::getExpressions)
                .orElse(ImmutableSet.of());
    }

    @Override
    public ImmutableMap<String, ExpressModel> expressSearch(String projectId, String userId, ImmutableSet<String> targetIds) {
        if (targetIds.isEmpty()) {
            return ImmutableMap.of();
        }
        return dynamoUtil.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(expressSchemaByUser.tableName()).withPrimaryKeys(targetIds.stream()
                .map(targetId -> expressSchemaByUser.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .toArray(PrimaryKey[]::new))))
                .map(expressSchemaByUser::fromItem)
                .filter(e -> !e.getExpressions().isEmpty())
                .collect(ImmutableMap.toImmutableMap(
                        ExpressModel::getTargetId,
                        i -> i));
    }

    @Override
    public ListResponse<ExpressModel> expressListByUser(String projectId, String userId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = expressSchemaByUser.table().query(new QuerySpec()
                .withHashKey(expressSchemaByUser.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(expressSchemaByUser.rangeKeyName())
                        .beginsWith(expressSchemaByUser.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                expressSchemaByUser.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(expressSchemaByUser.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> expressSchemaByUser.fromItem(item))
                        .filter(e -> !e.getExpressions().isEmpty())
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(m -> m.get(expressSchemaByUser.rangeKeyName()))
                        .map(AttributeValue::getS)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public ListResponse<ExpressModel> expressListByTarget(String projectId, String targetId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = expressSchemaByTarget.index().query(new QuerySpec()
                .withHashKey(expressSchemaByTarget.partitionKey(Map.of(
                        "targetId", targetId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(expressSchemaByTarget.rangeKeyName())
                        .beginsWith(expressSchemaByTarget.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(expressSchemaByTarget::toExclusiveStartKey)
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> expressSchemaByTarget.fromItem(item))
                        .filter(e -> !e.getExpressions().isEmpty())
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(expressSchemaByTarget::serializeLastEvaluatedKey)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public TransactionModel balanceAdjustTransaction(String projectId, String userId, long balanceDiff, String summary, Optional<String> idempotentKey) {
        TransactionModel transaction = new TransactionModel(
                userId,
                projectId,
                idempotentKey.orElseGet(this::genTransactionId),
                Instant.now(),
                balanceDiff,
                TransactionType.ADJUSTMENT.name(),
                null,
                summary,
                Instant.now().plus(config.transactionExpiry()).getEpochSecond());
        try {
            transactionSchema.table().putItem(new PutItemSpec()
                    .withItem(transactionSchema.toItem(transaction))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(new NameMap().with("#partitionKey", transactionSchema.partitionKeyName())));
        } catch (ConditionalCheckFailedException ex) {
            throw new ApiException(Response.Status.CONFLICT, "You found an UUID collision, it's better than winning the lottery.", ex);
        }
        return transaction;
    }

    @Override
    public long fundTransferBetweenTargets(String projectId, String userId, String fromTargetId, String toTargetId) {
        long transferAmount = Optional.ofNullable(fundSchemaByUser.fromItem(fundSchemaByUser.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(fundSchemaByUser.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", fromTargetId)))
                .withReturnValues(ReturnValue.ALL_OLD))
                .getItem()))
                .map(FundModel::getFundAmount)
                .orElse(0L);

        // This is a critical time here where we have withdrawn funds from one target
        // but have not deposited to other one.

        if (transferAmount != 0L) {
            long fundAmountPrevious = fund(projectId, userId, toTargetId, transferAmount);
        }

        return transferAmount;
    }

    @Extern
    @Override
    public TransactionAndFundPrevious fund(String projectId, String userId, String targetId, long fundDiff, String transactionType, String summary) {
        long fundAmountPrevious = fund(projectId, userId, targetId, fundDiff);
        TransactionModel transaction = new TransactionModel(
                userId,
                projectId,
                genTransactionId(),
                Instant.now(),
                fundDiff,
                transactionType,
                targetId,
                summary,
                Instant.now().plus(config.transactionExpiry()).getEpochSecond());
        try {
            transactionSchema.table().putItem(new PutItemSpec()
                    .withItem(transactionSchema.toItem(transaction))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(new NameMap().with("#partitionKey", transactionSchema.partitionKeyName())));
        } catch (ConditionalCheckFailedException ex) {
            throw new ApiException(Response.Status.CONFLICT, "You found an UUID collision, it's better than winning the lottery.", ex);
        }
        return new TransactionAndFundPrevious(transaction, fundAmountPrevious);
    }

    /** Returns previous fund */
    public long fund(String projectId, String userId, String targetId, long fundDiff) {
        Optional<String> conditionExpressionOpt = Optional.empty();
        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, Object> valueMap = Maps.newHashMap();
        nameMap.put("#fundAmount", "fundAmount");
        valueMap.put(":zero", 0L);
        valueMap.put(":fundDiff", fundDiff);
        if (fundDiff < 0) {
            valueMap.put(":minFundAmount", Math.abs(fundDiff));
            conditionExpressionOpt = Optional.of("attribute_exists(#fundAmount) AND #fundAmount >= :minFundAmount");
        }
        String updateExpression = fundSchemaByUser.upsertExpression(new FundModel(userId, projectId, targetId, 0L), nameMap, valueMap,
                ImmutableSet.of("fundAmount"), ", #fundAmount = if_not_exists(#fundAmount, :zero) + :fundDiff");
        log.trace("Fund expression: {}", updateExpression);
        long fundAmountPrevious = Optional.ofNullable(fundSchemaByUser.fromItem(fundSchemaByUser.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(fundSchemaByUser.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .withConditionExpression(conditionExpressionOpt.orElse(null))
                .withUpdateExpression(updateExpression)
                .withNameMap(nameMap)
                .withValueMap(valueMap)
                .withReturnValues(ReturnValue.ALL_OLD))
                .getItem()))
                .map(FundModel::getFundAmount)
                .orElse(0L);
        return fundAmountPrevious;
    }

    @Override
    public ImmutableMap<String, FundModel> fundSearch(String projectId, String userId, ImmutableSet<String> targetIds) {
        if (targetIds.isEmpty()) {
            return ImmutableMap.of();
        }
        return dynamoUtil.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(fundSchemaByUser.tableName()).withPrimaryKeys(targetIds.stream()
                .map(targetId -> fundSchemaByUser.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId,
                        "targetId", targetId)))
                .toArray(PrimaryKey[]::new))))
                .map(fundSchemaByUser::fromItem)
                .filter(f -> f.getFundAmount() != 0L)
                .collect(ImmutableMap.toImmutableMap(
                        FundModel::getTargetId,
                        i -> i));
    }

    @Override
    public ListResponse<FundModel> fundListByUser(String projectId, String userId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = fundSchemaByUser.table().query(new QuerySpec()
                .withHashKey(fundSchemaByUser.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(fundSchemaByUser.rangeKeyName())
                        .beginsWith(fundSchemaByUser.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                fundSchemaByUser.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(fundSchemaByUser.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> fundSchemaByUser.fromItem(item))
                        .filter(f -> f.getFundAmount() != 0L)
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(m -> m.get(fundSchemaByUser.rangeKeyName()))
                        .map(AttributeValue::getS)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public ListResponse<FundModel> fundListByTarget(String projectId, String targetId, Optional<String> cursorOpt) {
        Page<Item, QueryOutcome> page = fundSchemaByTarget.index().query(new QuerySpec()
                .withHashKey(fundSchemaByTarget.partitionKey(Map.of(
                        "targetId", targetId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(fundSchemaByTarget.rangeKeyName())
                        .beginsWith(fundSchemaByTarget.rangeValuePartial(Map.of())))
                .withMaxPageSize(config.listFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(fundSchemaByTarget::toExclusiveStartKey)
                        .orElse(null)))
                .firstPage();
        return new ListResponse<>(
                page.getLowLevelResult()
                        .getItems()
                        .stream()
                        .map(item -> fundSchemaByTarget.fromItem(item))
                        .filter(f -> f.getFundAmount() != 0L)
                        .collect(ImmutableList.toImmutableList()),
                Optional.ofNullable(page.getLowLevelResult()
                        .getQueryResult()
                        .getLastEvaluatedKey())
                        .map(fundSchemaByTarget::serializeLastEvaluatedKey)
                        .map(serverSecretCursor::encryptString));
    }

    @Override
    public ListResponse<TransactionModel> transactionList(String projectId, String userId, Optional<String> cursorOpt) {
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

    @Extern
    @Override
    public void deleteAllForProject(String projectId) {
        // Delete votes
        Iterables.partition(StreamSupport.stream(voteSchemaByProjectId.index().query(new QuerySpec()
                .withHashKey(voteSchemaByProjectId.partitionKey(Map.of(
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(voteSchemaByProjectId.rangeKeyName())
                        .beginsWith(voteSchemaByProjectId.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(voteSchemaByProjectId::fromItem)
                .filter(vote -> projectId.equals(vote.getProjectId()))
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(votesBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(voteSchemaByUser.tableName());
                    votesBatch.stream()
                            .map(vote -> voteSchemaByUser.primaryKey(Map.of(
                                    "userId", vote.getUserId(),
                                    "projectId", projectId,
                                    "targetId", vote.getTargetId())))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete express
        Iterables.partition(StreamSupport.stream(expressSchemaByProjectId.index().query(new QuerySpec()
                .withHashKey(expressSchemaByProjectId.partitionKey(Map.of(
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(expressSchemaByProjectId.rangeKeyName())
                        .beginsWith(expressSchemaByProjectId.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(expressSchemaByProjectId::fromItem)
                .filter(express -> projectId.equals(express.getProjectId()))
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(expressesBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(expressSchemaByUser.tableName());
                    expressesBatch.stream()
                            .map(express -> expressSchemaByUser.primaryKey(Map.of(
                                    "userId", express.getUserId(),
                                    "projectId", projectId,
                                    "targetId", express.getTargetId())))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete fund
        Iterables.partition(StreamSupport.stream(fundSchemaByProjectId.index().query(new QuerySpec()
                .withHashKey(fundSchemaByProjectId.partitionKey(Map.of(
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(fundSchemaByProjectId.rangeKeyName())
                        .beginsWith(fundSchemaByProjectId.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(fundSchemaByProjectId::fromItem)
                .filter(fund -> projectId.equals(fund.getProjectId()))
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(fundsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(fundSchemaByUser.tableName());
                    fundsBatch.stream()
                            .map(fund -> fundSchemaByUser.primaryKey(Map.of(
                                    "userId", fund.getUserId(),
                                    "projectId", projectId,
                                    "targetId", fund.getTargetId())))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete transactions
        Iterables.partition(StreamSupport.stream(transactionByProjectIdSchema.index().query(new QuerySpec()
                .withHashKey(transactionByProjectIdSchema.partitionKey(Map.of(
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(transactionByProjectIdSchema.rangeKeyName())
                        .beginsWith(transactionByProjectIdSchema.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(transactionByProjectIdSchema::fromItem)
                .filter(transaction -> projectId.equals(transaction.getProjectId()))
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(transactionsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(transactionSchema.tableName());
                    transactionsBatch.stream()
                            .map(transaction -> transactionSchema.primaryKey(Map.of(
                                    "userId", transaction.getUserId(),
                                    "projectId", projectId,
                                    "transactionId", transaction.getTransactionId())))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
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
