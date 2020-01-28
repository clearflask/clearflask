package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.Page;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.collect.ImmutableList;
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
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.ServerSecret;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Singleton
public class DynamoVoteStore implements VoteStore {

    public interface Config {
        @DefaultValue("10")
        int searchFetchMax();

        @DefaultValue("P30D")
        Duration transactionExpiry();
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(partitionKeys = {"userId", "projectId"}, rangePrefix = "vote", rangeKeys = "targetId")
    private static class VoteModel {
        @NonNull
        private final String userId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String targetId;

        @NonNull
        private final int vote; // Vote enum
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(partitionKeys = {"userId", "projectId"}, rangePrefix = "express", rangeKeys = "targetId")
    private static class ExpressModel {
        @NonNull
        private final String userId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String targetId;

        @NonNull
        private final ImmutableSet<String> expressions;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(partitionKeys = {"userId", "projectId"}, rangePrefix = "fund", rangeKeys = "targetId")
    private static class FundModel {
        @NonNull
        private final String userId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String targetId;

        @NonNull
        private final long fundAmount;
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
    public void commentVote(String projectId, String userId, String commentId, Vote vote) {
        Vote votePrevious = vote(projectId, userId, commentId, vote);
        // TODO update totals
    }

    @Override
    public void ideaVote(String projectId, String userId, String ideaId, Vote vote) {
        Vote votePrevious = vote(projectId, userId, ideaId, vote);
        // TODO update totals
    }

    @Override
    public void ideaExpress(String projectId, String userId, String ideaId, Optional<String> expression) {
        ImmutableSet<String> expressionsPrevious = express(projectId, userId, ideaId, expression);
        // TODO update totals
    }

    @Override
    public void ideaExpressMulti(String projectId, String userId, String ideaId, ImmutableSet<String> addExpressions, ImmutableSet<String> removeExpressions) {
        ImmutableSet<String> expressionsPrevious = expressMulti(projectId, userId, ideaId, addExpressions, removeExpressions);
        // TODO update totals
    }

    @Override
    public Transaction ideaFund(String projectId, String userId, String ideaId, long amount, String transactionType, String summary) {
        long fundAmountPrevious = fund(projectId, userId, ideaId, amount);
        // TODO update totals
        return null;
    }

    @Override
    public TransactionListResponse ideaFundTransactionList(String projectId, String userId, Optional<String> cursorOpt) {
        ItemCollection<QueryOutcome> results = transactionSchema.table().query(new QuerySpec()
                .withHashKey(transactionSchema.partitionKey(Map.of(
                        "userId", userId)))
                .withFilterExpression("attribute_exists(transactionId)")
                .withMaxPageSize(config.searchFetchMax())
                .withScanIndexForward(false)
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> transactionSchema.primaryKey(Map.of(
                                "userId", userId,
                                "transactionId", lastEvaluatedKey)))
                        .orElse(null)));
        Page<Item, QueryOutcome> page = results.firstPage();
        ImmutableList<Transaction> transactions = page
                .getLowLevelResult()
                .getItems()
                .stream()
                .map(item -> transactionSchema.fromItem(item))
                .collect(ImmutableList.toImmutableList());
        Optional<String> newCursorOpt = Optional.ofNullable(page
                .getLowLevelResult()
                .getQueryResult()
                .getLastEvaluatedKey())
                .map(m -> m.get(transactionSchema.rangeKeyName())) // transactionId
                .map(AttributeValue::getS)
                .map(serverSecretCursor::encryptString);
        return new TransactionListResponse(transactions, newCursorOpt);
    }

    private Vote vote(String projectId, String userId, String targetId, Vote vote) {
        return Optional.ofNullable(voteSchema.fromItem(voteSchema.table().putItem(new PutItemSpec()
                .withItem(voteSchema.toItem(new VoteModel(userId, projectId, targetId, vote.getValue())))
                .withReturnValues(ReturnValue.ALL_OLD))
                .getItem()))
                .map(VoteModel::getVote)
                .map(Vote::fromValue)
                .orElse(Vote.NONE);
    }

    private ImmutableSet<String> express(String projectId, String userId, String targetId, Optional<String> expression) {
        return Optional.ofNullable(expressSchema.fromItem(expressSchema.table().putItem(new PutItemSpec()
                .withItem(expressSchema.toItem(new ExpressModel(userId, projectId, targetId, expression.map(ImmutableSet::of).orElse(ImmutableSet.of()))))
                .withReturnValues(ReturnValue.ALL_OLD))
                .getItem()))
                .map(ExpressModel::getExpressions)
                .orElse(ImmutableSet.of());
    }

    private ImmutableSet<String> expressMulti(String projectId, String userId, String targetId, ImmutableSet<String> addExpressions, ImmutableSet<String> removeExpressions) {
        ImmutableList.Builder<AttributeUpdate> updatesBuilder = ImmutableList.builder();
        if (!addExpressions.isEmpty()) {
            updatesBuilder.add(new AttributeUpdate("expressions").addElements(addExpressions.toArray()));
        }
        if (!removeExpressions.isEmpty()) {
            updatesBuilder.add(new AttributeUpdate("expressions").removeElements(removeExpressions.toArray()));
        }
        return Optional.ofNullable(expressSchema.fromItem(expressSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(expressSchema.primaryKey(Map.of("userId", userId, "targetId", targetId)))
                .withAttributeUpdate(updatesBuilder.build())
                .withReturnValues(ReturnValue.ALL_OLD))
                .getItem()))
                .map(ExpressModel::getExpressions)
                .orElse(ImmutableSet.of());
    }

    private long fund(String projectId, String userId, String targetId, long amount) {
        return Optional.ofNullable(fundSchema.fromItem(fundSchema.table().putItem(new PutItemSpec()
                .withItem(fundSchema.toItem(new FundModel(userId, projectId, targetId, amount)))
                .withReturnValues(ReturnValue.ALL_OLD))
                .getItem()))
                .map(FundModel::getFundAmount)
                .orElse(0L);
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
