package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.ItemUtils;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.model.Delete;
import com.amazonaws.services.dynamodbv2.model.Put;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItem;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsRequest;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;


@Slf4j
@Singleton
public class DynamoAccountStore implements AccountStore {

    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;

    private TableSchema<Account> accountSchema;
    private TableSchema<AccountSession> sessionByIdSchema;
    private IndexSchema<AccountSession> sessionByEmailSchema;

    @Inject
    private void setup() {
        accountSchema = dynamoMapper.parseTableSchema(Account.class);
        sessionByIdSchema = dynamoMapper.parseTableSchema(AccountSession.class);
        sessionByEmailSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(1, AccountSession.class);
    }

    @Override
    public void createAccount(Account account) {
        accountSchema.table().putItem(new PutItemSpec()
                .withItem(accountSchema.toItem(account))
                .withConditionExpression("attribute_not_exists(#partitionKey)")
                .withNameMap(new NameMap().with("#partitionKey", accountSchema.partitionKeyName())));
    }

    @Override
    public Optional<Account> getAccount(String email) {
        return Optional.ofNullable(accountSchema
                .fromItem(accountSchema
                        .table().getItem(accountSchema
                                .primaryKey(Map.of(
                                        "email", email)))));
    }

    @Override
    public Account addAccountPlanId(String email, String planId) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("email", email)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("ADD #planIds :planId")
                .withNameMap(new NameMap()
                        .with("#planIds", "planIds")
                        .with("#partitionKey", accountSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withStringSet(":planId", planId))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public Account removeAccountPlanId(String email, String planId) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("email", email)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("DELETE #planIds :planId")
                .withNameMap(new NameMap()
                        .with("#planIds", "planIds")
                        .with("#partitionKey", accountSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withStringSet(":planId", planId))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public Account addAccountProjectId(String email, String projectId) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("email", email)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("ADD #projectIds :projectId")
                .withNameMap(new NameMap()
                        .with("#projectIds", "projectIds")
                        .with("#partitionKey", accountSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withStringSet(":projectId", projectId))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public Account removeAccountProjectId(String email, String projectId) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("email", email)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("DELETE #projectIds :projectId")
                .withNameMap(new NameMap()
                        .with("#projectIds", "projectIds")
                        .with("#partitionKey", accountSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withStringSet(":projectId", projectId))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public Account updateAccountName(String email, String name) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("email", email)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("SET #name = :name")
                .withNameMap(new NameMap()
                        .with("#name", "name")
                        .with("#partitionKey", accountSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withString(":name", name))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public Account updateAccountPassword(String email, String password, String sessionIdToLeave) {
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("email", email)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("SET #password = :password")
                .withNameMap(new NameMap()
                        .with("#password", "password")
                        .with("#partitionKey", accountSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withString(":password", password))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        revokeSessions(email, sessionIdToLeave);
        return account;
    }

    @Override
    public Account updateAccountEmail(String emailCurrent, String emailNew) {
        Account accountNew = getAccount(emailCurrent).get().toBuilder().email(emailNew).build();
        // TODO race condition here. If account gets updated here, it won't be transferred over
        dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(
                new TransactWriteItem().withDelete(new Delete()
                        .withTableName(accountSchema.tableName())
                        .withKey(ItemUtils.toAttributeValueMap(accountSchema.primaryKey(Map.of("email", emailCurrent))))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", accountSchema.partitionKeyName()))),
                new TransactWriteItem().withPut(new Put()
                        .withTableName(accountSchema.tableName())
                        .withItem(accountSchema.toAttrMap(accountNew)))));
        revokeSessions(emailCurrent);
        return accountNew;
    }

    @Override
    public void deleteAccount(String email) {
        accountSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("email", email))));
        revokeSessions(email);
    }

    @Override
    public AccountSession createSession(String email, long ttlInEpochSec) {
        AccountSession accountSession = new AccountSession(genSessionId(), email, ttlInEpochSec);
        sessionByIdSchema.table().putItem(new PutItemSpec()
                .withItem(sessionByIdSchema.toItem(accountSession)));
        return accountSession;
    }

    @Override
    public Optional<AccountSession> getSession(String sessionId) {
        return Optional.ofNullable(sessionByIdSchema
                .fromItem(sessionByIdSchema
                        .table().getItem(sessionByIdSchema
                                .primaryKey(Map.of("sessionId", sessionId)))))
                .filter(session -> {
                    if (session.getTtlInEpochSec() < Instant.now().getEpochSecond()) {
                        log.debug("DynamoDB has an expired account session with expiry {}", session.getTtlInEpochSec());
                        return false;
                    }
                    return true;
                });
    }

    @Override
    public AccountSession refreshSession(AccountSession accountSession, long ttlInEpochSec) {
        return sessionByIdSchema.fromItem(sessionByIdSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(sessionByIdSchema.primaryKey(accountSession))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("SET #ttlInEpochSec = :ttlInEpochSec")
                .withNameMap(new NameMap()
                        .with("#ttlInEpochSec", "ttlInEpochSec")
                        .with("#partitionKey", sessionByIdSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withLong(":ttlInEpochSec", ttlInEpochSec))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public void revokeSession(AccountSession accountSession) {
        sessionByIdSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(sessionByIdSchema.primaryKey(accountSession)));
    }

    @Override
    public void revokeSessions(String email) {
        revokeSessions(email, Optional.empty());
    }

    @Override
    public void revokeSessions(String email, String sessionToLeave) {
        revokeSessions(email, Optional.of(sessionToLeave));
    }

    private void revokeSessions(String email, Optional<String> sessionToLeaveOpt) {
        Iterables.partition(StreamSupport.stream(sessionByEmailSchema.index().query(new QuerySpec()
                .withHashKey(sessionByEmailSchema.partitionKey(Map.of(
                        "email", email)))
                .withRangeKeyCondition(new RangeKeyCondition(sessionByEmailSchema.rangeKeyName())
                        .beginsWith(sessionByEmailSchema.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(sessionByEmailSchema::fromItem)
                .map(AccountSession::getSessionId)
                .filter(sessionId -> !sessionToLeaveOpt.isPresent() || !sessionToLeaveOpt.get().equals(sessionId))
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(sessionIdsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(sessionByIdSchema.tableName());
                    sessionIdsBatch.stream()
                            .map(sessionId -> sessionByIdSchema.primaryKey(Map.of(
                                    "sessionId", sessionId)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    dynamoDoc.batchWriteItem(tableWriteItems);
                });
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AccountStore.class).to(DynamoAccountStore.class).asEagerSingleton();
            }
        };
    }
}
