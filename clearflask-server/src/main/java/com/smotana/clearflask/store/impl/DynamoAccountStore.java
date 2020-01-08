package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Expected;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.Delete;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.Put;
import com.amazonaws.services.dynamodbv2.model.ResourceNotFoundException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.services.dynamodbv2.model.TimeToLiveSpecification;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItem;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsRequest;
import com.amazonaws.services.dynamodbv2.model.Update;
import com.amazonaws.services.dynamodbv2.model.UpdateTimeToLiveRequest;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.Optional;

@Slf4j
@Singleton
public class DynamoAccountStore extends ManagedService implements AccountStore {

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    public static class EmailAccount {

        @NonNull
        private final String email;

        @NonNull
        private final String accountId;
    }

    private static final String ACCOUNT_TABLE = "account";
    private static final String EMAIL_ACCOUNT_TABLE = "emailToAccount";
    private static final String SESSION_TABLE = "accountSession";

    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;

    private Table accountTable;
    private Table emailAccountTable;
    private Table sessionTable;

    @Override
    protected void serviceStart() throws Exception {
        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(ACCOUNT_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("accountId").withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("accountId").withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            log.debug("Table {} created", ACCOUNT_TABLE);
        } catch (ResourceNotFoundException ex) {
            log.debug("Table {} already exists", ACCOUNT_TABLE);
        }
        accountTable = dynamoDoc.getTable(ACCOUNT_TABLE);

        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(EMAIL_ACCOUNT_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("email").withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("email").withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            log.debug("Table {} created", EMAIL_ACCOUNT_TABLE);
        } catch (ResourceNotFoundException ex) {
            log.debug("Table {} already exists", EMAIL_ACCOUNT_TABLE);
        }
        emailAccountTable = dynamoDoc.getTable(EMAIL_ACCOUNT_TABLE);

        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(SESSION_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("accountId").withKeyType(KeyType.HASH),
                            new KeySchemaElement().withAttributeName("sessionId").withKeyType(KeyType.RANGE)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("accountId").withAttributeType(ScalarAttributeType.S),
                            new AttributeDefinition().withAttributeName("sessionId").withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            dynamo.updateTimeToLive(new UpdateTimeToLiveRequest()
                    .withTableName(SESSION_TABLE)
                    .withTimeToLiveSpecification(new TimeToLiveSpecification()
                            .withEnabled(true)
                            .withAttributeName("expiry")));
            log.debug("Table {} created", SESSION_TABLE);
        } catch (ResourceNotFoundException ex) {
            log.debug("Table {} already exists", SESSION_TABLE);
        }
        sessionTable = dynamoDoc.getTable(SESSION_TABLE);
    }

    @Override
    public Optional<Account> getAccount(String accountId) {
        return Optional.ofNullable(dynamoMapper.fromItem(
                accountTable.getItem("accountId", accountId),
                Account.class));
    }

    @Override
    public Optional<Account> getAccountByEmail(String email) {
        return Optional.ofNullable(dynamoMapper.fromItem(
                emailAccountTable.getItem("email", email),
                EmailAccount.class))
                .map(session -> getAccount(session.getAccountId())
                        .orElseThrow(() -> new IllegalStateException("EmailAccount entry exists but Account doesn't for email " + email)));
    }

    @Override
    public void createAccount(Account account) {
        dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(
                new TransactWriteItem().withPut(new Put()
                        .withTableName(EMAIL_ACCOUNT_TABLE)
                        .withItem(dynamoMapper.toAttrMap(EmailAccount.builder()
                                .email(account.getEmail())
                                .accountId(account.getAccountId())
                                .build()))
                        .withConditionExpression("attribute_not_exists(email)")),
                new TransactWriteItem().withPut(new Put()
                        .withTableName(ACCOUNT_TABLE)
                        .withItem(dynamoMapper.toAttrMap(account))
                        .withConditionExpression("attribute_not_exists(accountId)"))));
    }

    @Override
    public void addAccountPlanId(String accountId, String planId) {
        accountTable.updateItem("accountId", accountId,
                ImmutableList.of(new Expected("accountId").exists()),
                new AttributeUpdate("planIds").addElements(planId));
    }

    @Override
    public void removeAccountPlanId(String accountId, String planId) {
        accountTable.updateItem("accountId", accountId,
                ImmutableList.of(new Expected("accountId").exists()),
                new AttributeUpdate("planIds").removeElements(planId));
    }

    @Override
    public void addAccountProjectId(String accountId, String projectId) {
        accountTable.updateItem("accountId", accountId,
                ImmutableList.of(new Expected("accountId").exists()),
                new AttributeUpdate("projectIds").addElements(projectId));
    }

    @Override
    public void removeAccountProjectId(String accountId, String projectId) {
        accountTable.updateItem("accountId", accountId,
                ImmutableList.of(new Expected("accountId").exists()),
                new AttributeUpdate("projectIds").removeElements(projectId));
    }

    @Override
    public void updateAccountName(String accountId, String name) {
        accountTable.updateItem("accountId", accountId,
                ImmutableList.of(new Expected("accountId").exists()),
                new AttributeUpdate("name").put(name));
    }

    @Override
    public void updateAccountPassword(String accountId, String password, String sessionIdToLeave) {
        accountTable.updateItem("accountId", accountId,
                ImmutableList.of(new Expected("accountId").exists()),
                new AttributeUpdate("password").put(password));
        revokeSessions(accountId, sessionIdToLeave);
    }

    @Override
    public void updateAccountEmail(String accountId, String previousEmail, String email) {
        dynamo.transactWriteItems(new TransactWriteItemsRequest()
                .withTransactItems(
                        new TransactWriteItem().withUpdate(new Update()
                                .withTableName(ACCOUNT_TABLE)
                                .withKey(ImmutableMap.of("accountId", new AttributeValue(accountId)))
                                .withUpdateExpression("SET #email = :emailNew")
                                .withConditionExpression("#email = :emailOld")
                                .withExpressionAttributeNames(ImmutableMap.of("#email", "email"))
                                .withExpressionAttributeValues(ImmutableMap.of(
                                        ":emailOld", new AttributeValue(previousEmail),
                                        ":emailNew", new AttributeValue(email)))),
                        new TransactWriteItem().withDelete(new Delete()
                                .withTableName(EMAIL_ACCOUNT_TABLE)
                                .addKeyEntry("email", new AttributeValue(previousEmail))
                                .withConditionExpression("#email = :emailOld")
                                .withExpressionAttributeNames(ImmutableMap.of("#email", "email"))
                                .withExpressionAttributeValues(ImmutableMap.of(":emailOld", new AttributeValue(previousEmail)))),
                        new TransactWriteItem().withPut(new Put()
                                .withTableName(EMAIL_ACCOUNT_TABLE)
                                .withItem(dynamoMapper.toAttrMap(EmailAccount.builder()
                                        .email(email)
                                        .accountId(accountId)
                                        .build())))
                ));
        revokeSessions(accountId);
    }

    // TODO
    @Override
    public Session createSession(String accountId, Instant expiry) {
        Session session = Session.builder()
                .sessionId(IdUtil.randomId())
                .accountId(accountId)
                .expiry(expiry)
                .build();
        sessionTable.putItem(dynamoMapper.toItem(session));
        return session;
    }

    @Override
    public Optional<Session> getSession(String accountId, String sessionId) {
        Optional<Session> session = Optional.ofNullable(dynamoMapper.fromItem(
                sessionTable.getItem(
                        "accountId", accountId,
                        "sessionId", sessionId),
                Session.class));

        if (session.isPresent() && session.get().getExpiry().isBefore(Instant.now())) {
            log.trace("DynamoDB has an expired account session with expiry {}", session.get().getExpiry());
            session = Optional.empty();
        }

        return session;
    }

    @Override
    public Session refreshSession(String accountId, String sessionId, Instant expiry) {
        return dynamoMapper.fromItem(sessionTable.updateItem(new UpdateItemSpec()
                .withPrimaryKey(
                        "accountId", accountId,
                        "sessionId", sessionId)
                .withAttributeUpdate(new AttributeUpdate("expiry")
                        .put(dynamoMapper.toDynamoValue(expiry)))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem(), Session.class);
    }

    @Override
    public void revokeSession(String accountId, String sessionId) {
        sessionTable.deleteItem("accountId", accountId, "sessionId", sessionId);
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
        QuerySpec querySpec = new QuerySpec()
                .withMaxPageSize(25)
                .withKeyConditionExpression("#i = :i")
                .withNameMap(ImmutableMap.of("#i", "accountId"))
                .withValueMap(ImmutableMap.of(":i", accountId));
        ItemCollection<QueryOutcome> items = sessionTable.query(querySpec);
        items.pages().forEach(page -> {
            TableWriteItems tableWriteItems = new TableWriteItems(SESSION_TABLE);
            page.forEach(item -> {
                Session session = dynamoMapper.fromItem(item, Session.class);
                if (sessionToLeaveOpt.isPresent() && sessionToLeaveOpt.get().equals(session.getSessionId())) {
                    return;
                }
                tableWriteItems.addHashAndRangePrimaryKeyToDelete("accountId", accountId, "sessionId", session.getSessionId());
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
                bind(AccountStore.class).to(DynamoAccountStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoAccountStore.class);
            }
        };
    }
}
