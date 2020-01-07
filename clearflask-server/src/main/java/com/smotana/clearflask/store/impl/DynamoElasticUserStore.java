package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.Put;
import com.amazonaws.services.dynamodbv2.model.ResourceNotFoundException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.amazonaws.services.dynamodbv2.model.TimeToLiveSpecification;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItem;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsRequest;
import com.amazonaws.services.dynamodbv2.model.UpdateTimeToLiveRequest;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.SettableFuture;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.dynamo.mapper.CompoundPrimaryKey;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.util.PasswordUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.compress.utils.Lists;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.builder.SearchSourceBuilder;

import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Future;

@Slf4j
@Singleton
public class DynamoElasticUserStore extends ManagedService implements UserStore {

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @CompoundPrimaryKey(key = "id", primaryKeys = {"type", "identifier"})
    public static class IdentifierUser {

        @NonNull
        private final String type;

        @NonNull
        private final String identifier;

        @NonNull
        private final String userId;
    }

    private static final String USER_TABLE = "user";
    private static final String IDENTIFIER_USER_TABLE = "identifierToUser";
    private static final String SESSION_TABLE = "userSession";

    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    private RestHighLevelClient elastic;
    @Inject
    private PasswordUtil passwordUtil;
    @Inject
    private Gson gson;

    private Table userTable;
    private Table identifierUserTable;
    private Table sessionTable;

    @Override
    protected void serviceStart() throws Exception {
        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(USER_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("id").withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("id").withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            log.debug("Table {} created", USER_TABLE);
        } catch (ResourceNotFoundException ex) {
            log.debug("Table {} already exists", USER_TABLE);
        }
        userTable = dynamoDoc.getTable(USER_TABLE);

        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(IDENTIFIER_USER_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("id").withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("id").withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            log.debug("Table {} created", IDENTIFIER_USER_TABLE);
        } catch (ResourceNotFoundException ex) {
            log.debug("Table {} already exists", IDENTIFIER_USER_TABLE);
        }
        identifierUserTable = dynamoDoc.getTable(IDENTIFIER_USER_TABLE);

        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(SESSION_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("id").withKeyType(KeyType.HASH),
                            new KeySchemaElement().withAttributeName("sessionId").withKeyType(KeyType.RANGE)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("id").withAttributeType(ScalarAttributeType.S),
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
    public Optional<User> getUser(String projectId, String userId) {
        log.trace("getUser projectId {} userId {}", projectId, userId);
        return Optional.ofNullable(dynamoMapper.fromItem(
                userTable.getItem(
                        "id",
                        dynamoMapper.getCompoundPrimaryKey(
                                ImmutableMap.of("projectId", projectId, "userId", userId),
                                User.class)),
                User.class));
    }

    @Override
    public ImmutableList<User> getUsers(String projectId, String... userIds) {
        return getUsersByIds(projectId, Arrays.stream(userIds)
                .map(uid -> dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "userId", uid), User.class))
                .toArray(String[]::new));
    }

    private ImmutableList<User> getUsersByIds(String projectId, String... ids) {
        return dynamoDoc.batchGetItem(new TableKeysAndAttributes(USER_TABLE).withHashOnlyKeys("id", (Object[]) ids))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(i -> dynamoMapper.fromItem(i, User.class))
                .collect(ImmutableList.toImmutableList());
    }

    @Override
    public Optional<User> getUserByIdentifier(String projectId, IdentifierType type, String identifier) {
        return Optional.ofNullable(dynamoMapper.fromItem(
                identifierUserTable.getItem(
                        "id",
                        dynamoMapper.getCompoundPrimaryKey(
                                ImmutableMap.of("type", type.getType(), "identifier", identifier),
                                IdentifierUser.class)),
                IdentifierUser.class))
                .map(identifierUser -> getUser(projectId, identifierUser.getUserId())
                        .orElseThrow(() -> new IllegalStateException("IdentifierUser entry exists but User doesn't for type " + type.getType() + " identifier " + identifier)));
    }

    @Override
    public UserAndIndexingFuture<IndexResponse> createUser(User user) {
        dynamo.transactWriteItems(new TransactWriteItemsRequest()
                .withTransactItems(new TransactWriteItem().withPut(new Put()
                        .withTableName(USER_TABLE)
                        .withItem(dynamoMapper.toAttrMap(user))
                        .withConditionExpression("attribute_not_exists(id)")))
                .withTransactItems(getUserIdentifiers(user).entrySet().stream()
                        .map(e -> new TransactWriteItem().withPut(new Put()
                                .withTableName(IDENTIFIER_USER_TABLE)
                                .withItem(dynamoMapper.toAttrMap(new IdentifierUser(
                                        e.getKey(),
                                        e.getValue(),
                                        user.getUserId())))
                                .withConditionExpression("attribute_not_exists(id)")))
                        .toArray(TransactWriteItem[]::new)));

        SettableFuture<IndexResponse> indexingFuture = SettableFuture.create();
        elastic.indexAsync(new IndexRequest("user")
                        .id(dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                                "projectId", user.getProjectId(),
                                "userId", user.getUserId()), User.class))
                        .source(gson.toJson(user), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));

        return new UserAndIndexingFuture(user, indexingFuture);
    }

    @Override
    public Future<List<DeleteResponse>> deleteUsers(String projectId, String... userIds) {
        ImmutableList<User> users = getUsers(projectId, userIds);
        dynamoDoc.batchWriteItem(new TableWriteItems(USER_TABLE).withPrimaryKeysToDelete(users
                .stream()
                .map(User::getUserId)
                .map(uid -> new PrimaryKey(
                        "id",
                        dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "userId", uid), User.class)))
                .toArray(PrimaryKey[]::new)));

        List<PrimaryKey> identifierPrimaryKeys = Lists.newArrayList();
        for (User user : users) {
            if (!Strings.isNullOrEmpty(user.getEmail())) {
                identifierPrimaryKeys.add(new PrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "type", IdentifierType.EMAIL.getType(),
                        "identifier", user.getEmail()), IdentifierUser.class)));
            }
            if (!Strings.isNullOrEmpty(user.getAndroidPushToken())) {
                identifierPrimaryKeys.add(new PrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "type", IdentifierType.ANDROID_PUSH.getType(),
                        "identifier", user.getAndroidPushToken()), IdentifierUser.class)));
            }
            if (!Strings.isNullOrEmpty(user.getIosPushToken())) {
                identifierPrimaryKeys.add(new PrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "type", IdentifierType.IOS_PUSH.getType(),
                        "identifier", user.getIosPushToken()), IdentifierUser.class)));
            }
            if (!Strings.isNullOrEmpty(user.getBrowserPushToken())) {
                identifierPrimaryKeys.add(new PrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "type", IdentifierType.BROWSER_PUSH.getType(),
                        "identifier", user.getBrowserPushToken()), IdentifierUser.class)));
            }
        }

        dynamoDoc.batchWriteItem(new TableWriteItems(IDENTIFIER_USER_TABLE).withPrimaryKeysToDelete(identifierPrimaryKeys.toArray(new PrimaryKey[0])));

        users.forEach(user -> revokeSessions(projectId, user.getUserId()));

        Future<List<DeleteResponse>> indexingFutures = Futures.allAsList(users.stream().map(user -> {
            SettableFuture<DeleteResponse> indexingFuture = SettableFuture.create();
            elastic.deleteAsync(new DeleteRequest("user",
                            dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                                    "projectId", user.getProjectId(),
                                    "userId", user.getUserId()), User.class)),
                    RequestOptions.DEFAULT,
                    ActionListeners.fromFuture(indexingFuture));
            return indexingFuture;
        }).collect(ImmutableList.toImmutableList()));

        return indexingFutures;
    }

    @Override
    public UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdate updates) {
        UpdateItemSpec updateItemSpec = new UpdateItemSpec()
                .withPrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "userId", userId), User.class))
                .withReturnValues(ReturnValue.ALL_NEW);
        boolean updateElastic = false;
        if (updates.getName() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("name")
                    .put(dynamoMapper.toDynamoValue(updates.getName())));
            updateElastic = true;
        }
        if (updates.getEmail() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("email")
                    .put(dynamoMapper.toDynamoValue(updates.getEmail())));
            updateElastic = true;
        }
        if (updates.getPassword() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("password")
                    .put(dynamoMapper.toDynamoValue(updates.getPassword())));
        }
        if (updates.getEmailNotify() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("emailNotify")
                    .put(dynamoMapper.toDynamoValue(updates.getEmailNotify())));
            updateElastic = true;
        }
        if (updates.getIosPushToken() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("iosPushToken")
                    .put(dynamoMapper.toDynamoValue(updates.getIosPushToken())));
        }
        if (updates.getAndroidPushToken() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("androidPushToken")
                    .put(dynamoMapper.toDynamoValue(updates.getAndroidPushToken())));
        }
        if (updates.getBrowserPushToken() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("browserPushToken")
                    .put(dynamoMapper.toDynamoValue(updates.getBrowserPushToken())));
        }

        User user = dynamoMapper.fromItem(userTable.updateItem(updateItemSpec).getItem(), User.class);

        if (updateElastic) {
            SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
            elastic.updateAsync(new UpdateRequest("user",
                            dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                                    "projectId", user.getProjectId(),
                                    "userId", user.getUserId()), User.class))
                            .upsert(gson.toJson(user), XContentType.JSON),
                    RequestOptions.DEFAULT,
                    ActionListeners.fromFuture(indexingFuture));
            return new UserAndIndexingFuture(user, indexingFuture);
        } else {
            return new UserAndIndexingFuture(user, Futures.immediateFuture(null));
        }

    }

    @Override
    public ImmutableList<User> searchUsers(String projectId, UserSearchAdmin parameters) {
        SearchResponse searchResponse;
        try {
            searchResponse = elastic.search(new SearchRequest("user").source(new SearchSourceBuilder()
//                            .fetchSource(false)
                            .query(QueryBuilders
                                    .boolQuery()
                                    .filter(QueryBuilders.termQuery("project_id", projectId))
                                    .should(QueryBuilders.matchQuery("name", parameters.getSearchText()).fuzziness("AUTO"))
                                    .should(QueryBuilders.matchQuery("email", parameters.getSearchText()).fuzziness("AUTO"))
                                    .minimumShouldMatch(1)
                            )),
                    RequestOptions.DEFAULT);
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
        if (searchResponse.getHits().getHits().length == 0) {
            return ImmutableList.of();
        }
        log.trace("searchUsers results {}", (Object) searchResponse.getHits().getHits());
        return getUsersByIds(projectId, Arrays.stream(searchResponse.getHits().getHits())
                .map(hit -> hit.field("_id").<String>getValue())
                .toArray(String[]::new));
    }

    @Override
    public UserSession createSession(String projectId, String userId, Instant expiry) {
        UserSession session = UserSession.builder()
                .projectId(projectId)
                .userId(userId)
                .sessionId(UUID.randomUUID().toString())
                .expiry(expiry)
                .build();
        sessionTable.putItem(dynamoMapper.toItem(session));
        return session;
    }

    @Override
    public Optional<UserSession> getSession(String projectId, String userId, String sessionId) {
        Optional<UserSession> session = Optional.ofNullable(dynamoMapper.fromItem(
                sessionTable.getItem(
                        "id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "userId", userId), UserSession.class),
                        "sessionId", sessionId),
                UserSession.class));

        if (session.isPresent() && session.get().getExpiry().isBefore(Instant.now())) {
            log.trace("DynamoDB has an expired user session with expiry {}", session.get().getExpiry());
            session = Optional.empty();
        }

        return session;
    }

    @Override
    public UserSession refreshSession(String projectId, String userId, String sessionId, Instant expiry) {
        return dynamoMapper.fromItem(sessionTable.updateItem(new UpdateItemSpec()
                .withPrimaryKey(
                        "id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "userId", userId), UserSession.class),
                        "sessionId", sessionId)
                .withAttributeUpdate(new AttributeUpdate("expiry")
                        .put(dynamoMapper.toDynamoValue(expiry)))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem(), UserSession.class);
    }

    @Override
    public void revokeSession(String projectId, String userId, String sessionId) {
        sessionTable.deleteItem(
                "id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "userId", userId), UserSession.class),
                "sessionId", sessionId);
    }

    @Override
    public void revokeSessions(String projectId, String userId) {
        revokeSessions(projectId, userId, Optional.empty());
    }

    @Override
    public void revokeSessions(String projectId, String userId, String sessionToLeave) {
        revokeSessions(projectId, userId, Optional.of(sessionToLeave));
    }

    private void revokeSessions(String projectId, String userId, Optional<String> sessionToLeaveOpt) {
        String id = dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "userId", userId), UserSession.class);
        QuerySpec querySpec = new QuerySpec()
                .withMaxPageSize(25)
                .withKeyConditionExpression("#i = :i")
                .withNameMap(ImmutableMap.of("#i", "id"))
                .withValueMap(ImmutableMap.of(":i", id));
        ItemCollection<QueryOutcome> items = sessionTable.query(querySpec);
        items.pages().forEach(page -> {
            TableWriteItems tableWriteItems = new TableWriteItems(SESSION_TABLE);
            page.forEach(item -> {
                UserSession session = dynamoMapper.fromItem(item, UserSession.class);
                if (sessionToLeaveOpt.isPresent() && sessionToLeaveOpt.get().equals(session.getSessionId())) {
                    return;
                }
                tableWriteItems.addHashAndRangePrimaryKeyToDelete("id", id, "sessionId", session.getSessionId());
            });
            if (tableWriteItems.getPrimaryKeysToDelete() == null || tableWriteItems.getPrimaryKeysToDelete().size() <= 0) {
                return;
            }
            dynamoDoc.batchWriteItem(tableWriteItems);
        });
    }

    private ImmutableMap<String, String> getUserIdentifiers(User user) {
        ImmutableMap.Builder<String, String> identifiersBuilder = ImmutableMap.builder();
        if (!Strings.isNullOrEmpty(user.getEmail())) {
            identifiersBuilder.put(IdentifierType.EMAIL.getType(), user.getEmail());
        }
        if (!Strings.isNullOrEmpty(user.getBrowserPushToken())) {
            identifiersBuilder.put(IdentifierType.BROWSER_PUSH.getType(), user.getBrowserPushToken());
        }
        if (!Strings.isNullOrEmpty(user.getAndroidPushToken())) {
            identifiersBuilder.put(IdentifierType.ANDROID_PUSH.getType(), user.getAndroidPushToken());
        }
        if (!Strings.isNullOrEmpty(user.getIosPushToken())) {
            identifiersBuilder.put(IdentifierType.IOS_PUSH.getType(), user.getIosPushToken());
        }
        return identifiersBuilder.build();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(UserStore.class).to(DynamoElasticUserStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoElasticUserStore.class);
            }
        };
    }
}
