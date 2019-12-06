package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Expected;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.Delete;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.Put;
import com.amazonaws.services.dynamodbv2.model.ResourceNotFoundException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.services.dynamodbv2.model.TimeToLiveSpecification;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItem;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsRequest;
import com.amazonaws.services.dynamodbv2.model.UpdateTimeToLiveRequest;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static com.google.common.base.Preconditions.checkNotNull;

@Slf4j
@Singleton
public class DynamoAccountStore extends ManagedService implements AccountStore {

    private static final String ACCOUNT_TABLE = "account";
    private static final String EMAIL_ACCOUNT_TABLE = "emailAccount";
    private static final String ACCOUNT_ID = "aid";
    private static final String ACCOUNT_EMAIL = "email";
    private static final String ACCOUNT_DATA = "data";
    private static final String SESSION_TABLE = "session";
    private static final String SESSION_ID = "sid";
    private static final String SESSION_EXPIRY = "ttl";

    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private Gson gson;

    private Table accountTable;
    private Table emailAccountTable;
    private Table sessionTable;

    @Override
    protected void serviceStart() throws Exception {
        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(ACCOUNT_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName(ACCOUNT_ID).withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName(ACCOUNT_ID).withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
        } catch (ResourceNotFoundException ex) {
            // Table exists
        }
        accountTable = dynamoDoc.getTable(ACCOUNT_TABLE);

        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(EMAIL_ACCOUNT_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName(ACCOUNT_EMAIL).withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName(ACCOUNT_EMAIL).withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
        } catch (ResourceNotFoundException ex) {
            // Table exists
        }
        emailAccountTable = dynamoDoc.getTable(EMAIL_ACCOUNT_TABLE);

        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(SESSION_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName(ACCOUNT_ID).withKeyType(KeyType.HASH),
                            new KeySchemaElement().withAttributeName(SESSION_ID).withKeyType(KeyType.RANGE)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName(ACCOUNT_ID).withAttributeType(ScalarAttributeType.S),
                            new AttributeDefinition().withAttributeName(SESSION_ID).withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            dynamo.updateTimeToLive(new UpdateTimeToLiveRequest()
                    .withTableName(SESSION_TABLE)
                    .withTimeToLiveSpecification(new TimeToLiveSpecification()
                            .withEnabled(true)
                            .withAttributeName(SESSION_EXPIRY)));
        } catch (ResourceNotFoundException ex) {
            // Table exists
        }
        sessionTable = dynamoDoc.getTable(SESSION_TABLE);
    }

    @Override
    public Optional<Account> getAccount(String accountId) {
        final Item item = accountTable.getItem(ACCOUNT_ID, accountId);

        final Optional<Account> accountOpt;
        if (item == null) {
            accountOpt = Optional.empty();
        } else {
            accountOpt = Optional.of(gson.fromJson(item.getString(ACCOUNT_DATA), Account.class));
        }

        return accountOpt;
    }

    @Override
    public Optional<Account> getAccountByEmail(String email) {
        final Item item = emailAccountTable.getItem(ACCOUNT_EMAIL, email);

        if (item == null) {
            return Optional.empty();
        }

        return getAccount(item.getString(ACCOUNT_ID));
    }

    @Override
    public void createAccount(Account account) {
        dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(
                new TransactWriteItem().withPut(new Put()
                        .withTableName(EMAIL_ACCOUNT_TABLE)
                        .addItemEntry(ACCOUNT_EMAIL, new AttributeValue(account.getEmail()))
                        .addItemEntry(ACCOUNT_ID, new AttributeValue(account.getAccountId()))
                        .withConditionExpression("attribute_not_exists(" + ACCOUNT_EMAIL + ")")),
                new TransactWriteItem().withPut(new Put()
                        .withTableName(ACCOUNT_TABLE)
                        .addItemEntry(ACCOUNT_ID, new AttributeValue(account.getAccountId()))
                        .addItemEntry(ACCOUNT_DATA, new AttributeValue(gson.toJson(account)))
                        .withConditionExpression("attribute_not_exists(" + ACCOUNT_ID + ")"))));
    }

    @Override
    public void addAccountPlanId(String accountId, String planId) {
        final Item item = accountTable.getItem(ACCOUNT_ID, accountId);
        checkNotNull(item);
        Account account = gson.fromJson(item.getString(ACCOUNT_DATA), Account.class);
        Account accountUpdated = new Account(
                account.getAccountId(),
                ImmutableSet.<String>builder().addAll(account.getPlanIds()).add(planId).build(),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                account.getPassword(),
                account.getPhone(),
                account.getPaymentToken(),
                account.getProjectIds());
        accountTable.updateItem(ACCOUNT_ID, accountId,
                ImmutableList.of(new Expected(ACCOUNT_DATA).eq(item.getString(ACCOUNT_DATA))),
                new AttributeUpdate(ACCOUNT_DATA).put(gson.toJson(accountUpdated)));
    }

    @Override
    public void removeAccountPlanId(String accountId, String planId) {
        final Item item = accountTable.getItem(ACCOUNT_ID, accountId);
        checkNotNull(item);
        Account account = gson.fromJson(item.getString(ACCOUNT_DATA), Account.class);
        Account accountUpdated = new Account(
                account.getAccountId(),
                ImmutableSet.copyOf(Sets.difference(account.getPlanIds(), ImmutableSet.of(planId))),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                account.getPassword(),
                account.getPhone(),
                account.getPaymentToken(),
                account.getProjectIds());
        accountTable.updateItem(ACCOUNT_ID, accountId,
                ImmutableList.of(new Expected(ACCOUNT_DATA).eq(item.getString(ACCOUNT_DATA))),
                new AttributeUpdate(ACCOUNT_DATA).put(gson.toJson(accountUpdated)));
    }

    @Override
    public void addAccountProjectId(String accountId, String projectId) {
        final Item item = accountTable.getItem(ACCOUNT_ID, accountId);
        checkNotNull(item);
        Account account = gson.fromJson(item.getString(ACCOUNT_DATA), Account.class);
        Account accountUpdated = new Account(
                account.getAccountId(),
                account.getProjectIds(),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                account.getPassword(),
                account.getPhone(),
                account.getPaymentToken(),
                ImmutableSet.<String>builder().addAll(account.getProjectIds()).add(projectId).build());
        accountTable.updateItem(ACCOUNT_ID, accountId,
                ImmutableList.of(new Expected(ACCOUNT_DATA).eq(item.getString(ACCOUNT_DATA))),
                new AttributeUpdate(ACCOUNT_DATA).put(gson.toJson(accountUpdated)));
    }

    @Override
    public void removeAccountProjectId(String accountId, String projectId) {
        final Item item = accountTable.getItem(ACCOUNT_ID, accountId);
        checkNotNull(item);
        Account account = gson.fromJson(item.getString(ACCOUNT_DATA), Account.class);
        Account accountUpdated = new Account(
                account.getAccountId(),
                account.getProjectIds(),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                account.getPassword(),
                account.getPhone(),
                account.getPaymentToken(),
                ImmutableSet.copyOf(Sets.difference(account.getProjectIds(), ImmutableSet.of(projectId))));
        accountTable.updateItem(ACCOUNT_ID, accountId,
                ImmutableList.of(new Expected(ACCOUNT_DATA).eq(item.getString(ACCOUNT_DATA))),
                new AttributeUpdate(ACCOUNT_DATA).put(gson.toJson(accountUpdated)));
    }

    @Override
    public void updateAccountName(String accountId, String name) {
        final Item item = accountTable.getItem(ACCOUNT_ID, accountId);
        checkNotNull(item);
        Account account = gson.fromJson(item.getString(ACCOUNT_DATA), Account.class);
        Account accountUpdated = new Account(
                account.getAccountId(),
                account.getPlanIds(),
                account.getCompany(),
                name,
                account.getEmail(),
                account.getPassword(),
                account.getPhone(),
                account.getPaymentToken(),
                account.getProjectIds());
        accountTable.updateItem(ACCOUNT_ID, accountId,
                ImmutableList.of(new Expected(ACCOUNT_DATA).eq(item.getString(ACCOUNT_DATA))),
                new AttributeUpdate(ACCOUNT_DATA).put(gson.toJson(accountUpdated)));
    }

    @Override
    public void updateAccountPassword(String accountId, String password) {
        final Item item = accountTable.getItem(ACCOUNT_ID, accountId);
        checkNotNull(item);
        Account account = gson.fromJson(item.getString(ACCOUNT_DATA), Account.class);
        Account accountUpdated = new Account(
                account.getAccountId(),
                account.getPlanIds(),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                password,
                account.getPhone(),
                account.getPaymentToken(),
                account.getProjectIds());
        accountTable.updateItem(ACCOUNT_ID, accountId,
                ImmutableList.of(new Expected(ACCOUNT_DATA).eq(item.getString(ACCOUNT_DATA))),
                new AttributeUpdate(ACCOUNT_DATA).put(gson.toJson(accountUpdated)));
    }

    @Override
    public void updateAccountEmail(String accountId, String previousEmail, String email) {
        final Item item = accountTable.getItem(ACCOUNT_ID, accountId);
        checkNotNull(item, "Cannot update email on non-existent account");
        String accountJson = item.getString(ACCOUNT_DATA);
        Account account = gson.fromJson(accountJson, Account.class);
        Account accountUpdated = new Account(
                account.getAccountId(),
                account.getPlanIds(),
                account.getCompany(),
                account.getName(),
                email,
                account.getPassword(),
                account.getPhone(),
                account.getPaymentToken(),
                account.getProjectIds());
        dynamo.transactWriteItems(new TransactWriteItemsRequest()
                .withTransactItems(
                        new TransactWriteItem().withPut(new Put()
                                .withTableName(ACCOUNT_TABLE)
                                .withConditionExpression("#d = :d")
                                .withExpressionAttributeNames(ImmutableMap.of("#d", ACCOUNT_DATA))
                                .withExpressionAttributeValues(ImmutableMap.of(":d", new AttributeValue(accountJson)))
                                .withItem(ImmutableMap.of(
                                        ACCOUNT_ID, new AttributeValue(accountId),
                                        ACCOUNT_DATA, new AttributeValue(gson.toJson(accountUpdated))))),
                        new TransactWriteItem().withDelete(new Delete()
                                .withTableName(EMAIL_ACCOUNT_TABLE)
                                .withConditionExpression("#e = :e")
                                .withExpressionAttributeNames(ImmutableMap.of("#e", ACCOUNT_EMAIL))
                                .withExpressionAttributeValues(ImmutableMap.of(":e", new AttributeValue(previousEmail)))
                                .addKeyEntry(ACCOUNT_EMAIL, new AttributeValue(previousEmail))),
                        new TransactWriteItem().withPut(new Put()
                                .withTableName(EMAIL_ACCOUNT_TABLE)
                                .withItem(ImmutableMap.of(
                                        ACCOUNT_EMAIL, new AttributeValue(email),
                                        ACCOUNT_ID, new AttributeValue(accountId))))
                ));
        revokeSessions(accountId);
    }

    @Override
    public Session createSession(String accountId, Instant expiry) {
        String sessionId = UUID.randomUUID().toString();
        sessionTable.putItem(new Item()
                .withPrimaryKey(ACCOUNT_ID, accountId, SESSION_ID, sessionId)
                .withLong(SESSION_EXPIRY, expiry.toEpochMilli()));
        return new Session(sessionId, accountId, expiry);
    }

    @Override
    public Optional<Session> getSession(String accountId, String sessionId) {
        final Item session = sessionTable.getItem(ACCOUNT_ID, accountId, SESSION_ID, sessionId);

        if (session == null) {
            return Optional.empty();
        }

        if (session.getLong(SESSION_EXPIRY) < System.currentTimeMillis()) {
            return Optional.empty();
        }

        return Optional.of(new Session(
                sessionId,
                accountId,
                Instant.ofEpochMilli(session.getLong(SESSION_EXPIRY))
        ));
    }

    @Override
    public Session refreshSession(String accountId, String sessionId, Instant expiry) {
        sessionTable.putItem(new Item()
                .withPrimaryKey(ACCOUNT_ID, accountId, SESSION_ID, sessionId)
                .withLong(SESSION_EXPIRY, expiry.toEpochMilli()));
        return new Session(sessionId, accountId, expiry);
    }

    @Override
    public void revokeSession(String accountId, String sessionId) {
        sessionTable.deleteItem(ACCOUNT_ID, accountId, SESSION_ID, sessionId);
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
                .withNameMap(ImmutableMap.of("#i", ACCOUNT_ID))
                .withValueMap(ImmutableMap.of(":i", accountId));
        ItemCollection<QueryOutcome> items = sessionTable.query(querySpec);
        items.pages().forEach(page -> {
            TableWriteItems tableWriteItems = new TableWriteItems(SESSION_TABLE);
            page.forEach(item -> {
                String sessionId = item.getString(SESSION_ID);
                if (sessionToLeaveOpt.isPresent() && sessionToLeaveOpt.get().equals(sessionId)) {
                    return;
                }
                tableWriteItems.addHashAndRangePrimaryKeyToDelete(ACCOUNT_ID, accountId, SESSION_ID, sessionId);
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
