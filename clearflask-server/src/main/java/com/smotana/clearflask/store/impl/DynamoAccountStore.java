package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.ItemUtils;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.*;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.model.*;
import com.google.common.collect.ImmutableList;
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
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
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
    private TableSchema<AccountEmail> accountIdByEmailSchema;
    private TableSchema<AccountSession> sessionBySessionIdSchema;
    private IndexSchema<AccountSession> sessionByAccountIdSchema;

    @Inject
    private void setup() {
        accountSchema = dynamoMapper.parseTableSchema(Account.class);
        accountIdByEmailSchema = dynamoMapper.parseTableSchema(AccountEmail.class);
        sessionBySessionIdSchema = dynamoMapper.parseTableSchema(AccountSession.class);
        sessionByAccountIdSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(1, AccountSession.class);
    }

    @Override
    public void createAccount(Account account) {
        try {
            accountIdByEmailSchema.table().putItem(new PutItemSpec()
                    .withItem(accountIdByEmailSchema.toItem(new AccountEmail(
                            account.getEmail(),
                            account.getAccountId())))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(new NameMap().with("#partitionKey", accountIdByEmailSchema.partitionKeyName())));
        } catch (ConditionalCheckFailedException ex) {
            throw new ErrorWithMessageException(Response.Status.CONFLICT, "Email already in use, please choose another.", ex);
        }
        accountSchema.table().putItem(new PutItemSpec()
                .withItem(accountSchema.toItem(account))
                .withConditionExpression("attribute_not_exists(#partitionKey)")
                .withNameMap(new NameMap().with("#partitionKey", accountSchema.partitionKeyName())));
    }

    @Override
    public Optional<Account> getAccountByAccountId(String accountId) {
        return Optional.ofNullable(accountSchema
                .fromItem(accountSchema
                        .table().getItem(accountSchema
                                .primaryKey(Map.of(
                                        "accountId", accountId)))));
    }

    @Override
    public Optional<Account> getAccountByEmail(String email) {
        return Optional.ofNullable(accountIdByEmailSchema.fromItem(accountIdByEmailSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(accountIdByEmailSchema.primaryKey(Map.of(
                        "email", email))))))
                .map(accountEmail -> getAccountByAccountId(accountEmail.getAccountId())
                        .orElseThrow(() -> new IllegalStateException("AccountEmail entry exists but Account doesn't for email " + email)));
    }

    @Override
    public Account setPlan(String accountId, String planId, Optional<Instant> planExpiry) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("SET #planId = :planId, #planExpiry = :planExpiry")
                .withNameMap(new NameMap()
                        .with("#planId", "planId")
                        .with("#planExpiry", "planExpiry")
                        .with("#partitionKey", accountSchema.partitionKeyName()))
                .withValueMap(new ValueMap()
                        .withString(":planId", planId)
                        .with(":planExpiry", planExpiry.orElse(null)))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public Account addProject(String accountId, String projectId) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
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
    public Account removeProject(String accountId, String projectId) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
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
    public Account updateName(String accountId, String name) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
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
    public Account updatePassword(String accountId, String password, String sessionIdToLeave) {
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("SET #password = :password")
                .withNameMap(new NameMap()
                        .with("#password", "password")
                        .with("#partitionKey", accountSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withString(":password", password))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        revokeSessions(account.getAccountId(), sessionIdToLeave);
        return account;
    }

    @Override
    public Account updateEmail(String accountId, String emailNew, String sessionIdToLeave) {
        Account accountOld = getAccountByAccountId(accountId).get();
        dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(ImmutableList.<TransactWriteItem>builder()
                .add(new TransactWriteItem().withPut(new Put()
                        .withTableName(accountIdByEmailSchema.tableName())
                        .withItem(accountIdByEmailSchema.toAttrMap(new AccountEmail(
                                emailNew, accountId)))))
                .add(new TransactWriteItem().withDelete(new Delete()
                        .withTableName(accountIdByEmailSchema.tableName())
                        .withKey(ItemUtils.toAttributeValueMap(accountIdByEmailSchema.primaryKey(Map.of(
                                "email", accountOld.getEmail()))))
                        .withConditionExpression("attribute_exists(#partitionKey) AND #accountId = :accountId")
                        .withExpressionAttributeNames(Map.of(
                                "#accountId", "accountId",
                                "#partitionKey", accountSchema.partitionKeyName()))
                        .withExpressionAttributeValues(Map.of(
                                ":accountId", accountIdByEmailSchema.toAttrValue("accountId", accountId)))))
                .add(new TransactWriteItem().withUpdate(new Update()
                        .withTableName(accountSchema.tableName())
                        .withKey(ItemUtils.toAttributeValueMap(accountSchema.primaryKey(Map.of(
                                "accountId", accountId))))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("SET #email = :email")
                        .withExpressionAttributeNames(Map.of(
                                "#email", "email",
                                "#partitionKey", accountSchema.partitionKeyName()))
                        .withExpressionAttributeValues(Map.of(
                                ":email", accountSchema.toAttrValue("email", emailNew)))))
                .build()));
        revokeSessions(accountId, sessionIdToLeave);
        return accountOld.toBuilder().email(emailNew).build();
    }

    @Override
    public void deleteAccount(String accountId) {
        String email = getAccountByAccountId(accountId).get().getEmail();
        accountIdByEmailSchema.table().deleteItem(new DeleteItemSpec()
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withNameMap(Map.of(
                        "#partitionKey", accountIdByEmailSchema.partitionKeyName()))
                .withPrimaryKey(accountIdByEmailSchema.primaryKey(Map.of(
                        "email", email))));
        accountSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("email", email))));
        revokeSessions(accountId);
    }

    @Override
    public AccountSession createSession(String accountId, long ttlInEpochSec) {
        AccountSession accountSession = new AccountSession(genSessionId(), accountId, ttlInEpochSec);
        sessionBySessionIdSchema.table().putItem(new PutItemSpec()
                .withItem(sessionBySessionIdSchema.toItem(accountSession)));
        return accountSession;
    }

    @Override
    public Optional<AccountSession> getSession(String sessionId) {
        return Optional.ofNullable(sessionBySessionIdSchema
                .fromItem(sessionBySessionIdSchema
                        .table().getItem(sessionBySessionIdSchema
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
        return sessionBySessionIdSchema.fromItem(sessionBySessionIdSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(sessionBySessionIdSchema.primaryKey(accountSession))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression("SET #ttlInEpochSec = :ttlInEpochSec")
                .withNameMap(new NameMap()
                        .with("#ttlInEpochSec", "ttlInEpochSec")
                        .with("#partitionKey", sessionBySessionIdSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withLong(":ttlInEpochSec", ttlInEpochSec))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public void revokeSession(String sessionId) {
        sessionBySessionIdSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(sessionBySessionIdSchema.primaryKey(Map.of(
                        "sessionId", sessionId))));
    }

    @Override
    public void revokeSessions(String accountId) {
        revokeSessions(accountId, Optional.empty());
    }

    @Override
    public void revokeSessions(String accountId, String sessionToLeave) {
        revokeSessions(accountId, Optional.of(sessionToLeave));
    }

    private void revokeSessions(String accountId, Optional<String> sessionToLeaveOpt) {
        Iterables.partition(StreamSupport.stream(sessionByAccountIdSchema.index().query(new QuerySpec()
                .withHashKey(sessionByAccountIdSchema.partitionKey(Map.of(
                        "accountId", accountId)))
                .withRangeKeyCondition(new RangeKeyCondition(sessionByAccountIdSchema.rangeKeyName())
                        .beginsWith(sessionByAccountIdSchema.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(sessionByAccountIdSchema::fromItem)
                .map(AccountSession::getSessionId)
                .filter(sessionId -> !sessionToLeaveOpt.isPresent() || !sessionToLeaveOpt.get().equals(sessionId))
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(sessionIdsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(sessionBySessionIdSchema.tableName());
                    sessionIdsBatch.stream()
                            .map(sessionId -> sessionBySessionIdSchema.primaryKey(Map.of(
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
