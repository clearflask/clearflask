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
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.dynamo.mapper.CompoundPrimaryKey;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.ElasticUtil.ConfigSearch;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.compress.utils.Lists;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;

import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Singleton
public class DynamoElasticUserStore extends ManagedService implements UserStore {

    public interface Config {
        /** Intended for tests. Force immediate index refresh after write request. */
        @DefaultValue("false")
        boolean elasticForceRefresh();
    }

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

    private static final String USER_INDEX = "user";
    private static final String USER_TABLE = "user";
    private static final String IDENTIFIER_USER_TABLE = "identifierToUser";
    private static final String SESSION_TABLE = "userSession";

    @Inject
    private Config config;
    @Inject
    @Named("user")
    private ConfigSearch configSearch;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    private RestHighLevelClient elastic;
    @Inject
    private ElasticUtil elasticUtil;
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
    public ListenableFuture<CreateIndexResponse> createIndex(String projectId) {
        SettableFuture<CreateIndexResponse> indexingFuture = SettableFuture.create();
        elastic.indices().createAsync(new CreateIndexRequest(elasticUtil.getIndexName(USER_INDEX, projectId)).mapping(gson.toJson(ImmutableMap.of(
                "dynamic", "false",
                "properties", ImmutableMap.builder()
                        // TODO explore index_prefixes and norms for name and email
                        .put("name", ImmutableMap.of(
                                "type", "text",
                                "index_prefixes", ImmutableMap.of()))
                        .put("email", ImmutableMap.of(
                                "type", "text",
                                "index_prefixes", ImmutableMap.of()))
                        .put("balance", ImmutableMap.of(
                                "type", "double"))
                        .build())), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));
        return indexingFuture;
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
        elastic.indexAsync(new IndexRequest(elasticUtil.getIndexName(USER_INDEX, user.getProjectId()))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                        .id(user.getUserId())
                        .source(gson.toJson(ImmutableMap.of(
                                "name", user.getName(),
                                "email", user.getEmail(),
                                "balance", user.getBalance()
                        )), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));

        return new UserAndIndexingFuture<>(user, indexingFuture);
    }

    @Override
    public Optional<User> getUser(String projectId, String userId) {
        log.trace("getUser projectId {} userId {}", projectId, userId);
        return Optional.ofNullable(dynamoMapper.fromItem(userTable.getItem("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "userId", userId
        ), User.class)), User.class));
    }

    @Override
    public ImmutableMap<String, User> getUsers(String projectId, ImmutableCollection<String> userIds) {
        return dynamoDoc.batchGetItem(new TableKeysAndAttributes(USER_TABLE).withHashOnlyKeys("id", userIds.stream()
                .map(uid -> dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "userId", uid), User.class))
                .toArray()))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(i -> dynamoMapper.fromItem(i, User.class))
                .collect(ImmutableMap.toImmutableMap(
                        User::getUserId,
                        i -> i));
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
    public SearchUsersResponse searchUsers(String projectId, UserSearchAdmin userSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt) {
        Optional<SortOrder> sortOrderOpt;
        if (userSearchAdmin.getSortBy() != null) {
            switch (userSearchAdmin.getSortOrder()) {
                case ASC:
                    sortOrderOpt = Optional.of(SortOrder.ASC);
                    break;
                case DESC:
                    sortOrderOpt = Optional.of(SortOrder.DESC);
                    break;
                default:
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                            "Sort order '" + userSearchAdmin.getSortOrder() + "' not supported");
            }
        } else {
            sortOrderOpt = Optional.empty();
        }

        ImmutableList<String> sortFields;
        if (userSearchAdmin.getSortBy() != null) {
            switch (userSearchAdmin.getSortBy()) {
                case CREATED:
                    sortFields = ImmutableList.of("created");
                    break;
                case FUNDSAVAILABLE:
                    sortFields = ImmutableList.of("balance");
                    break;
                case FUNDEDIDEAS:
                case SUPPORTEDIDEAS:
                case FUNDEDAMOUNT:
                case LASTACTIVE:
                default:
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                            "Sorting by '" + userSearchAdmin.getSortBy() + "' not supported");
            }
        } else {
            sortFields = ImmutableList.of();
        }

        ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(
                new SearchRequest(elasticUtil.getIndexName(USER_INDEX, projectId))
                        .source(new SearchSourceBuilder()
                                .fetchSource(false)
                                .query(QueryBuilders.multiMatchQuery(userSearchAdmin.getSearchText(), "name", "email")
                                        .fuzziness("AUTO"))),
                cursorOpt, sortFields, sortOrderOpt, useAccurateCursor, pageSizeOpt, configSearch);

        SearchHit[] hits = searchResponseWithCursor.getSearchResponse().getHits().getHits();
        if (hits.length == 0) {
            return new SearchUsersResponse(ImmutableList.of(), Optional.empty());
        }

        ImmutableList<String> userIds = Arrays.stream(hits)
                .map(SearchHit::getId)
                .collect(ImmutableList.toImmutableList());

        return new SearchUsersResponse(userIds, searchResponseWithCursor.getCursorOpt());
    }

    @Override
    public UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdate updates) {
        UpdateItemSpec updateItemSpec = new UpdateItemSpec()
                .withPrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "userId", userId), User.class))
                .withReturnValues(ReturnValue.ALL_NEW);
        Map<String, Object> indexUpdates = Maps.newHashMap();
        if (updates.getName() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("name")
                    .put(dynamoMapper.toDynamoValue(updates.getName())));
            indexUpdates.put("name", updates.getName());
        }
        if (updates.getEmail() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("email")
                    .put(dynamoMapper.toDynamoValue(updates.getEmail())));
            indexUpdates.put("email", updates.getEmail());
        }
        if (updates.getPassword() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("password")
                    .put(dynamoMapper.toDynamoValue(updates.getPassword())));
        }
        if (updates.getEmailNotify() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("emailNotify")
                    .put(dynamoMapper.toDynamoValue(updates.getEmailNotify())));
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

        if (!indexUpdates.isEmpty()) {
            SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(USER_INDEX, projectId), user.getUserId())
                            .doc(gson.toJson(indexUpdates), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
            return new UserAndIndexingFuture<>(user, indexingFuture);
        } else {
            return new UserAndIndexingFuture<>(user, Futures.immediateFuture(null));
        }
    }

    @Override
    public ListenableFuture<BulkResponse> deleteUsers(String projectId, ImmutableCollection<String> userIds) {
        ImmutableCollection<User> users = getUsers(projectId, userIds).values();
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

        SettableFuture<BulkResponse> indexingFuture = SettableFuture.create();
        elastic.bulkAsync(new BulkRequest()
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                        .add(users.stream()
                                .map(user -> new DeleteRequest(elasticUtil.getIndexName(USER_INDEX, projectId), user.getUserId()))
                                .collect(ImmutableList.toImmutableList())),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return indexingFuture;
    }

    @Override
    public UserSession createSession(String projectId, String userId, Instant expiry) {
        UserSession session = UserSession.builder()
                .projectId(projectId)
                .userId(userId)
                .sessionId(IdUtil.randomId())
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
                install(ConfigSystem.configModule(Config.class));
                install(ConfigSystem.configModule(ConfigSearch.class, Names.named("user")));
            }
        };
    }
}
