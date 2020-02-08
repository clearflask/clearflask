package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.model.CancellationReason;
import com.amazonaws.services.dynamodbv2.model.Put;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItem;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsRequest;
import com.amazonaws.services.dynamodbv2.model.TransactionCanceledException;
import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;
import com.google.common.hash.HashFunction;
import com.google.common.hash.Hashing;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.ElasticUtil.ConfigSearch;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
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
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;
import static com.smotana.clearflask.util.ExplicitNull.orNull;

@Slf4j
@Singleton
public class DynamoElasticUserStore implements UserStore {

    public interface Config {
        /** Intended for tests. Force immediate index refresh after write request. */
        @DefaultValue("false")
        boolean elasticForceRefresh();

        @DefaultValue("0.001")
        double voteBloomFilterFalsePositiveProbability();

        @DefaultValue("100")
        long voteBloomFilterExpectedInsertions();

        @DefaultValue("0.001")
        double expressBloomFilterFalsePositiveProbability();

        @DefaultValue("100")
        long expressBloomFilterExpectedInsertions();

        @DefaultValue("0.001")
        double fundBloomFilterFalsePositiveProbability();

        @DefaultValue("100")
        long fundBloomFilterExpectedInsertions();
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"identifierHash", "type", "projectId"}, rangePrefix = "userByIdentifier")
    public static class IdentifierUser {
        @NonNull
        private final String type;

        @NonNull
        private final String identifierHash;

        @NonNull
        private final String projectId;

        @NonNull
        private final String userId;
    }

    private static final String USER_INDEX = "user";

    private final HashFunction hashFunction = Hashing.murmur3_128(-223823442);

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

    private TableSchema<UserModel> userSchema;
    private TableSchema<IdentifierUser> identifierToUserIdSchema;
    private TableSchema<UserSession> sessionByIdSchema;
    private IndexSchema<UserSession> sessionByUserSchema;

    @Inject
    private void setup() {
        userSchema = dynamoMapper.parseTableSchema(UserModel.class);
        identifierToUserIdSchema = dynamoMapper.parseTableSchema(IdentifierUser.class);
        sessionByIdSchema = dynamoMapper.parseTableSchema(UserSession.class);
        sessionByUserSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(1, UserSession.class);
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
    public UserAndIndexingFuture<IndexResponse> createUser(UserModel user) {
        try {
            dynamo.transactWriteItems(new TransactWriteItemsRequest()
                    .withTransactItems(new TransactWriteItem().withPut(new Put()
                            .withTableName(userSchema.tableName())
                            .withItem(userSchema.toAttrMap(user))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(Map.of("#partitionKey", userSchema.partitionKeyName()))))
                    .withTransactItems(getUserIdentifiers(user).entrySet().stream()
                            .map(e -> new TransactWriteItem().withPut(new Put()
                                    .withTableName(identifierToUserIdSchema.tableName())
                                    .withItem(identifierToUserIdSchema.toAttrMap(new IdentifierUser(
                                            e.getKey().getType(),
                                            e.getKey().isHashed() ? hashIdentifier(e.getValue()) : e.getValue(),
                                            user.getProjectId(),
                                            user.getUserId())))
                                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                                    .withExpressionAttributeNames(Map.of("#partitionKey", identifierToUserIdSchema.partitionKeyName()))))
                            .toArray(TransactWriteItem[]::new)));
        } catch (TransactionCanceledException ex) {
            if (ex.getCancellationReasons().stream().map(CancellationReason::getCode).anyMatch("ConditionalCheckFailed"::equals)) {
                throw new ErrorWithMessageException(Response.Status.CONFLICT, "User with your sign in details already exists, please choose another.", ex);
            }
            throw ex;
        }

        SettableFuture<IndexResponse> indexingFuture = SettableFuture.create();
        elastic.indexAsync(new IndexRequest(elasticUtil.getIndexName(USER_INDEX, user.getProjectId()))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                        .id(user.getUserId())
                        .source(gson.toJson(ImmutableMap.of(
                                "name", orNull(user.getName()),
                                "email", orNull(user.getEmail()),
                                "balance", orNull(user.getBalance())
                        )), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));

        return new UserAndIndexingFuture<>(user, indexingFuture);
    }

    @Override
    public Optional<UserModel> getUser(String projectId, String userId) {
        return Optional.ofNullable(userSchema.fromItem(userSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId))))));
    }

    @Override
    public ImmutableMap<String, UserModel> getUsers(String projectId, ImmutableCollection<String> userIds) {
        return dynamoDoc.batchGetItem(new TableKeysAndAttributes(userSchema.tableName()).withPrimaryKeys(userIds.stream()
                .map(userId -> userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId)))
                .toArray(PrimaryKey[]::new)))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(userSchema::fromItem)
                .collect(ImmutableMap.toImmutableMap(
                        UserModel::getUserId,
                        i -> i));
    }

    @Override
    public Optional<UserModel> getUserByIdentifier(String projectId, IdentifierType type, String identifier) {
        return Optional.ofNullable(identifierToUserIdSchema.fromItem(identifierToUserIdSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(identifierToUserIdSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "type", type.getType(),
                        "identifierHash", type.isHashed() ? hashIdentifier(identifier) : identifier))))))
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
                .withPrimaryKey(userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId)))
                .withReturnValues(ReturnValue.ALL_NEW);
        Map<String, Object> indexUpdates = Maps.newHashMap();
        if (updates.getName() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("name").put(userSchema.toDynamoValue("name", updates.getName())));
            indexUpdates.put("name", updates.getName());
        }
        if (updates.getEmail() != null) {
            if (updates.getEmail().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("email").delete());
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("email").put(userSchema.toDynamoValue("email", updates.getEmail())));
            }
            indexUpdates.put("email", updates.getEmail());
        }
        if (updates.getPassword() != null) {
            if (updates.getPassword().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("password").delete());
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("password").put(userSchema.toDynamoValue("password", updates.getPassword())));
            }
        }
        if (updates.getEmailNotify() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("emailNotify").put(userSchema.toDynamoValue("emailNotify", updates.getEmailNotify())));
        }
        if (updates.getIosPushToken() != null) {
            if (updates.getIosPushToken().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("iosPushToken").delete());
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("iosPushToken").put(userSchema.toDynamoValue("iosPushToken", updates.getIosPushToken())));
            }
        }
        if (updates.getAndroidPushToken() != null) {
            if (updates.getAndroidPushToken().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("androidPushToken").delete());
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("androidPushToken").put(userSchema.toDynamoValue("androidPushToken", updates.getAndroidPushToken())));
            }
        }
        if (updates.getBrowserPushToken() != null) {
            if (updates.getBrowserPushToken().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("browserPushToken").delete());
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("browserPushToken").put(userSchema.toDynamoValue("browserPushToken", updates.getBrowserPushToken())));
            }
        }

        UserModel userModel = userSchema.fromItem(userSchema.table().updateItem(updateItemSpec).getItem());

        if (!indexUpdates.isEmpty()) {
            SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(USER_INDEX, projectId), userModel.getUserId())
                            .doc(gson.toJson(indexUpdates), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
            return new UserAndIndexingFuture<>(userModel, indexingFuture);
        } else {
            return new UserAndIndexingFuture<>(userModel, Futures.immediateFuture(null));
        }
    }

    @Override
    public UserModel userVote(String projectId, String userId, String ideaId) {
        UserModel user = getUser(projectId, userId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"));
        BloomFilter<CharSequence> bloomFilter = Optional.ofNullable(user.getVoteBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .orElseGet(() -> BloomFilter.create(Funnels.stringFunnel(Charsets.UTF_8), config.voteBloomFilterExpectedInsertions(), config.voteBloomFilterFalsePositiveProbability()));
        boolean bloomFilterUpdated = bloomFilter.put(ideaId);
        if (!bloomFilterUpdated) {
            return user;
        }
        return userSchema.fromItem(userSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId)))
                .withAttributeUpdate(new AttributeUpdate("voteBloom").put(BloomFilters.toByteArray(bloomFilter)))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public UserModel userExpress(String projectId, String userId, String ideaId) {
        UserModel user = getUser(projectId, userId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"));
        BloomFilter<CharSequence> bloomFilter = Optional.ofNullable(user.getExpressBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .orElseGet(() -> BloomFilter.create(Funnels.stringFunnel(Charsets.UTF_8), config.expressBloomFilterExpectedInsertions(), config.expressBloomFilterFalsePositiveProbability()));
        boolean bloomFilterUpdated = bloomFilter.put(ideaId);
        if (!bloomFilterUpdated) {
            return user;
        }
        return userSchema.fromItem(userSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId)))
                .withAttributeUpdate(new AttributeUpdate("expressBloom").put(BloomFilters.toByteArray(bloomFilter)))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public UserAndIndexingFuture<UpdateResponse> updateUserBalance(String projectId, String userId, String ideaId, long balanceDiff) {
        UserModel user = getUser(projectId, userId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"));
        BloomFilter<CharSequence> bloomFilter = Optional.ofNullable(user.getFundBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .orElseGet(() -> BloomFilter.create(Funnels.stringFunnel(Charsets.UTF_8), config.fundBloomFilterExpectedInsertions(), config.fundBloomFilterFalsePositiveProbability()));
        boolean bloomFilterUpdated = bloomFilter.put(ideaId);

        List<AttributeUpdate> attrUpdates = Lists.newArrayList();
        attrUpdates.add(new AttributeUpdate("balance").addNumeric(balanceDiff));
        if (bloomFilterUpdated) {
            attrUpdates.add(new AttributeUpdate("fundBloom").put(BloomFilters.toByteArray(bloomFilter)));
        }
        UserModel userModel = userSchema.fromItem(userSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId)))
                .withAttributeUpdate(attrUpdates)
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());

        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(USER_INDEX, projectId), userModel.getUserId())
                        .doc(gson.toJson(Map.of("balance", userModel.getBalance())), XContentType.JSON)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
        return new UserAndIndexingFuture<>(userModel, indexingFuture);
    }

    @Override
    public ListenableFuture<BulkResponse> deleteUsers(String projectId, ImmutableCollection<String> userIds) {
        ImmutableCollection<UserModel> users = getUsers(projectId, userIds).values();
        dynamoDoc.batchWriteItem(new TableWriteItems(userSchema.tableName()).withPrimaryKeysToDelete(users.stream()
                .map(userModel -> userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userModel.getUserId())))
                .toArray(PrimaryKey[]::new)));

        dynamoDoc.batchWriteItem(new TableWriteItems(identifierToUserIdSchema.tableName()).withPrimaryKeysToDelete(users.stream()
                .map(this::getUserIdentifiers)
                .map(ImmutableMap::entrySet)
                .flatMap(Collection::stream)
                .map(e -> identifierToUserIdSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "type", e.getKey().getType(),
                        "identifierHash", e.getKey().isHashed() ? hashIdentifier(e.getValue()) : e.getValue())))
                .toArray(PrimaryKey[]::new)));

        users.stream()
                .map(UserModel::getUserId)
                .forEach(userId -> revokeSessions(projectId, userId, Optional.empty()));

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
    public UserSession createSession(String projectId, String userId, long ttlInEpochSec) {
        UserSession userSession = new UserSession(
                genUserSessionId(),
                projectId,
                userId,
                ttlInEpochSec);
        sessionByIdSchema.table().putItem(new PutItemSpec()
                .withItem(sessionByIdSchema.toItem(userSession)));
        return userSession;
    }

    @Override
    public Optional<UserSession> getSession(String sessionId) {
        return Optional.ofNullable(sessionByIdSchema
                .fromItem(sessionByIdSchema
                        .table().getItem(new GetItemSpec().withPrimaryKey(sessionByIdSchema
                                .primaryKey(Map.of("sessionId", sessionId))))))
                .filter(userSession -> {
                    if (userSession.getTtlInEpochSec() < Instant.now().getEpochSecond()) {
                        log.debug("DynamoDB has an expired user session with expiry {}", userSession.getTtlInEpochSec());
                        return false;
                    }
                    return true;
                });
    }

    @Override
    public UserSession refreshSession(UserSession userSession, long ttlInEpochSec) {
        return sessionByIdSchema.fromItem(sessionByIdSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(sessionByIdSchema.primaryKey(userSession))
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
    public void revokeSession(UserSession userSession) {
        sessionByIdSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(sessionByIdSchema.primaryKey(userSession)));
    }

    @Override
    public void revokeSessions(String projectId, String userId, Optional<String> sessionToLeaveOpt) {
        Iterables.partition(StreamSupport.stream(sessionByUserSchema.index().query(new QuerySpec()
                .withHashKey(sessionByUserSchema.partitionKey(Map.of(
                        "userId", userId)))
                .withRangeKeyCondition(new RangeKeyCondition(sessionByUserSchema.rangeKeyName())
                        .beginsWith(sessionByUserSchema.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(sessionByUserSchema::fromItem)
                .filter(session -> projectId.equals(session.getProjectId()))
                .map(UserSession::getSessionId)
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

    private String hashIdentifier(String identifier) {
        return hashFunction.hashString(identifier, Charsets.UTF_8).toString();
    }

    private ImmutableMap<IdentifierType, String> getUserIdentifiers(UserModel user) {
        ImmutableMap.Builder<IdentifierType, String> identifiersBuilder = ImmutableMap.builder();
        if (!Strings.isNullOrEmpty(user.getEmail())) {
            identifiersBuilder.put(IdentifierType.EMAIL, user.getEmail());
        }
        if (!Strings.isNullOrEmpty(user.getBrowserPushToken())) {
            identifiersBuilder.put(IdentifierType.BROWSER_PUSH, user.getBrowserPushToken());
        }
        if (!Strings.isNullOrEmpty(user.getAndroidPushToken())) {
            identifiersBuilder.put(IdentifierType.ANDROID_PUSH, user.getAndroidPushToken());
        }
        if (!Strings.isNullOrEmpty(user.getIosPushToken())) {
            identifiersBuilder.put(IdentifierType.IOS_PUSH, user.getIosPushToken());
        }
        return identifiersBuilder.build();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(UserStore.class).to(DynamoElasticUserStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                install(ConfigSystem.configModule(ConfigSearch.class, Names.named("user")));
            }
        };
    }
}
