package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.ItemUtils;
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
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.CancellationReason;
import com.amazonaws.services.dynamodbv2.model.Delete;
import com.amazonaws.services.dynamodbv2.model.Put;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItem;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsRequest;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsResult;
import com.amazonaws.services.dynamodbv2.model.TransactionCanceledException;
import com.amazonaws.services.dynamodbv2.model.Update;
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
import com.kik.config.ice.annotations.NoDefaultValue;
import com.kik.config.ice.convert.MoreConfigValueConverters;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.api.model.UserUpdateAdmin;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.ElasticUtil.*;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.RequiredTypeException;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.impl.compression.GzipCompressionCodec;
import io.jsonwebtoken.security.SignatureException;
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
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.search.MatchQuery;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;
import static com.smotana.clearflask.util.ElasticUtil.*;
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

        @DefaultValue("200")
        long voteBloomFilterExpectedInsertions();

        @DefaultValue("0.001")
        double expressBloomFilterFalsePositiveProbability();

        @DefaultValue("100")
        long expressBloomFilterExpectedInsertions();

        @DefaultValue("0.001")
        double fundBloomFilterFalsePositiveProbability();

        @DefaultValue("50")
        long fundBloomFilterExpectedInsertions();

        @NoDefaultValue
        SecretKey tokenSignerPrivKey();
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
        elastic.indices().createAsync(new CreateIndexRequest(elasticUtil.getIndexName(USER_INDEX, projectId)).settings(
                gson.toJson(ImmutableMap.of(
                        "index", ImmutableMap.of(
                                "analysis", ImmutableMap.of(
                                        "analyzer", ImmutableMap.of(
                                                AUTOCOMPLETE_ANALYZER_NAME, AUTOCOMPLETE_ANALYZER
                                        ),
                                        "tokenizer", ImmutableMap.of(
                                                AUTOCOMPLETE_TOKENIZER_NAME, AUTOCOMPLETE_TOKENIZER
                                        )
                                )
                        )
                )), XContentType.JSON).mapping(gson.toJson(ImmutableMap.of(
                "dynamic", "false",
                "properties", ImmutableMap.builder()
                        .put("name", ImmutableMap.of(
                                "type", "text",
                                "analyzer", AUTOCOMPLETE_ANALYZER_NAME,
                                "index_prefixes", ImmutableMap.of(
                                        "min_chars", 1,
                                        "max_chars", 4)))
                        .put("email", ImmutableMap.of(
                                "type", "text",
                                "analyzer", AUTOCOMPLETE_ANALYZER_NAME,
                                "index_prefixes", ImmutableMap.of(
                                        "min_chars", 1,
                                        "max_chars", 4)))
                        .put("balance", ImmutableMap.of(
                                "type", "double"))
                        .put("isAdmin", ImmutableMap.of(
                                "type", "boolean"))
                        .build())), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));
        return indexingFuture;
    }

    @Override
    public UserAndIndexingFuture<IndexResponse> createUser(UserModel user) {
        try {
            dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(ImmutableList.<TransactWriteItem>builder()
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(userSchema.tableName())
                            .withItem(userSchema.toAttrMap(user))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(Map.of("#partitionKey", userSchema.partitionKeyName()))))
                    .addAll(getUserIdentifiers(user).entrySet().stream()
                            .map(e -> new TransactWriteItem().withPut(new Put()
                                    .withTableName(identifierToUserIdSchema.tableName())
                                    .withItem(identifierToUserIdSchema.toAttrMap(new IdentifierUser(
                                            e.getKey().getType(),
                                            e.getKey().isHashed() ? hashIdentifier(e.getValue()) : e.getValue(),
                                            user.getProjectId(),
                                            user.getUserId())))
                                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                                    .withExpressionAttributeNames(Map.of("#partitionKey", identifierToUserIdSchema.partitionKeyName()))))
                            .collect(ImmutableList.toImmutableList()))
                    .build()));
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
                                "balance", orNull(user.getBalance()),
                                "isAdmin", user.getIsAdmin() != null && user.getIsAdmin()
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

        BoolQueryBuilder queryBuilder = QueryBuilders.boolQuery();
        if (userSearchAdmin.getIsAdmin() != null) {
            queryBuilder.must(QueryBuilders.termQuery("isAdmin", userSearchAdmin.getIsAdmin().booleanValue()));
        }
        queryBuilder.must(QueryBuilders.multiMatchQuery(userSearchAdmin.getSearchText(), "name", "email")
                .fuzziness("AUTO").zeroTermsQuery(MatchQuery.ZeroTermsQuery.ALL));
        log.trace("User search query: {}", queryBuilder);
        ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(
                new SearchRequest(elasticUtil.getIndexName(USER_INDEX, projectId))
                        .source(new SearchSourceBuilder()
                                .fetchSource(false)
                                .query(queryBuilder)),
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
    public UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdateAdmin updatesAdmin) {
        return updateUser(projectId, userId, new UserUpdate(
                updatesAdmin.getName(),
                updatesAdmin.getEmail(),
                updatesAdmin.getPassword(),
                updatesAdmin.getEmailNotify(),
                updatesAdmin.getIosPush() == Boolean.FALSE ? "" : null,
                updatesAdmin.getAndroidPush() == Boolean.FALSE ? "" : null,
                updatesAdmin.getBrowserPush() == Boolean.FALSE ? "" : null
        ));
    }

    @FunctionalInterface
    private interface UpdateIdentifierFunction {
        void apply(IdentifierType type, String oldVal, String newVal);
    }

    @Override
    public UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdate updates) {
        UserModel user = getUser(projectId, userId).get();
        UserModel.UserModelBuilder userUpdatedBuilder = user.toBuilder();

        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, AttributeValue> valMap = Maps.newHashMap();
        List<String> setUpdates = Lists.newArrayList();
        List<String> removeUpdates = Lists.newArrayList();
        ImmutableList.Builder<TransactWriteItem> transactionsBuilder = ImmutableList.builder();
        Map<String, Object> indexUpdates = Maps.newHashMap();
        boolean updateAuthTokenValidityStart = false;
        UpdateIdentifierFunction updateIdentifier = (type, oldVal, newVal) -> {
            if (!Strings.isNullOrEmpty(newVal)) {
                transactionsBuilder.add(new TransactWriteItem().withPut(new Put()
                        .withTableName(identifierToUserIdSchema.tableName())
                        .withItem(identifierToUserIdSchema.toAttrMap(new IdentifierUser(
                                type.getType(),
                                type.isHashed() ? hashIdentifier(newVal) : newVal,
                                projectId,
                                userId)))
                        .withConditionExpression("attribute_not_exists(#partitionKey)")
                        .withExpressionAttributeNames(Map.of("#partitionKey", identifierToUserIdSchema.partitionKeyName()))));
            }
            if (!Strings.isNullOrEmpty(oldVal)) {
                transactionsBuilder.add(new TransactWriteItem().withDelete(new Delete()
                        .withTableName(identifierToUserIdSchema.tableName())
                        .withKey(ItemUtils.toAttributeValueMap(identifierToUserIdSchema.primaryKey(ImmutableMap.of(
                                "identifierHash", type.isHashed() ? hashIdentifier(oldVal) : oldVal,
                                "type", type.getType(),
                                "projectId", projectId))))
                        .withConditionExpression("attribute_exists(#partitionKey) AND #userId = :userId")
                        .withExpressionAttributeNames(Map.of(
                                "#partitionKey", identifierToUserIdSchema.partitionKeyName(),
                                "#userId", "userId"))
                        .withExpressionAttributeValues(Map.of(
                                ":userId", identifierToUserIdSchema.toAttrValue("userId", userId)))));
            }
        };

        if (updates.getName() != null) {
            nameMap.put("#name", "name");
            valMap.put(":name", userSchema.toAttrValue("name", updates.getName()));
            setUpdates.add("#name = :name");
            indexUpdates.put("name", updates.getName());
            userUpdatedBuilder.name(updates.getName());
        }
        if (updates.getEmail() != null) {
            updateAuthTokenValidityStart = true;
            nameMap.put("#email", "email");
            if (updates.getEmail().isEmpty()) {
                removeUpdates.add("#email");
            } else {
                valMap.put(":email", userSchema.toAttrValue("email", updates.getEmail()));
                setUpdates.add("#email = :email");
            }
            nameMap.put("#emailLastUpdated", "emailLastUpdated");
            Instant emailLastUpdated = Instant.now();
            valMap.put(":emailLastUpdated", userSchema.toAttrValue("emailLastUpdated", emailLastUpdated));
            setUpdates.add("#emailLastUpdated = :emailLastUpdated");
            indexUpdates.put("email", updates.getEmail());
            updateIdentifier.apply(IdentifierType.EMAIL, user.getEmail(), updates.getEmail());
            userUpdatedBuilder.email(updates.getEmail())
                    .emailLastUpdated(emailLastUpdated);
        }
        if (updates.getPassword() != null) {
            updateAuthTokenValidityStart = true;
            nameMap.put("#password", "password");
            if (updates.getPassword().isEmpty()) {
                removeUpdates.add("#password");
            } else {
                valMap.put(":password", userSchema.toAttrValue("password", updates.getPassword()));
                setUpdates.add("#password = :password");
            }
            userUpdatedBuilder.password(updates.getPassword());
        }
        if (updates.getEmailNotify() != null) {
            nameMap.put("#emailNotify", "emailNotify");
            valMap.put(":emailNotify", userSchema.toAttrValue("emailNotify", updates.getEmailNotify()));
            setUpdates.add("#emailNotify = :emailNotify");
            userUpdatedBuilder.emailNotify(updates.getEmailNotify());
        }
        if (updates.getIosPushToken() != null) {
            nameMap.put("#iosPushToken", "iosPushToken");
            if (updates.getIosPushToken().isEmpty()) {
                removeUpdates.add("#iosPushToken");
            } else {
                valMap.put(":iosPushToken", userSchema.toAttrValue("iosPushToken", updates.getIosPushToken()));
                setUpdates.add("#iosPushToken = :iosPushToken");
            }
            updateIdentifier.apply(IdentifierType.IOS_PUSH, user.getIosPushToken(), updates.getIosPushToken());
            userUpdatedBuilder.iosPushToken(updates.getIosPushToken());
        }
        if (updates.getAndroidPushToken() != null) {
            nameMap.put("#androidPushToken", "androidPushToken");
            if (updates.getAndroidPushToken().isEmpty()) {
                removeUpdates.add("#androidPushToken");
            } else {
                valMap.put(":androidPushToken", userSchema.toAttrValue("androidPushToken", updates.getAndroidPushToken()));
                setUpdates.add("#androidPushToken = :androidPushToken");
            }
            updateIdentifier.apply(IdentifierType.ANDROID_PUSH, user.getAndroidPushToken(), updates.getAndroidPushToken());
            userUpdatedBuilder.androidPushToken(updates.getAndroidPushToken());
        }
        if (updates.getBrowserPushToken() != null) {
            nameMap.put("#browserPushToken", "browserPushToken");
            if (updates.getBrowserPushToken().isEmpty()) {
                removeUpdates.add("#browserPushToken");
            } else {
                valMap.put(":browserPushToken", userSchema.toAttrValue("browserPushToken", updates.getBrowserPushToken()));
                setUpdates.add("#browserPushToken = :browserPushToken");
            }
            updateIdentifier.apply(IdentifierType.BROWSER_PUSH, user.getBrowserPushToken(), updates.getBrowserPushToken());
            userUpdatedBuilder.browserPushToken(updates.getBrowserPushToken());
        }
        if (updateAuthTokenValidityStart) {
            Instant authTokenValidityStart = Instant.now();
            nameMap.put("#authTokenValidityStart", "authTokenValidityStart");
            valMap.put(":authTokenValidityStart", userSchema.toAttrValue("authTokenValidityStart", authTokenValidityStart));
            setUpdates.add("#authTokenValidityStart = :authTokenValidityStart");
            userUpdatedBuilder.authTokenValidityStart(authTokenValidityStart);
        }

        String updateExpression = (setUpdates.isEmpty() ? "" : "SET " + String.join(", ", setUpdates))
                + (removeUpdates.isEmpty() ? "" : " REMOVE " + String.join(", ", removeUpdates));
        nameMap.put("#partitionKey", userSchema.partitionKeyName());
        log.info("updateUser with expression: {} {} {}", updateExpression, nameMap, valMap);

        Update update = new Update()
                .withTableName(userSchema.tableName())
                .withKey(ItemUtils.toAttributeValueMap(userSchema.primaryKey(Map.of(
                        "userId", userId,
                        "projectId", projectId))))
                .withUpdateExpression(updateExpression)
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withExpressionAttributeNames(nameMap);
        if (!valMap.isEmpty()) {
            update.withExpressionAttributeValues(valMap);
        }
        transactionsBuilder.add(new TransactWriteItem().withUpdate(update));
        try {
            TransactWriteItemsResult transactWriteItemsResult = dynamo.transactWriteItems(new TransactWriteItemsRequest()
                    .withTransactItems(transactionsBuilder.build()));
            log.info("transactWriteItemsResult {} {}", transactWriteItemsResult.getConsumedCapacity(), transactWriteItemsResult.getItemCollectionMetrics());
        } catch (TransactionCanceledException ex) {
            if (ex.getCancellationReasons().stream().map(CancellationReason::getCode).anyMatch("ConditionalCheckFailed"::equals)) {
                throw new ErrorWithMessageException(Response.Status.CONFLICT, "User with your sign in details already exists, please choose another.", ex);
            }
            throw ex;
        }

        UserModel userUpdated = userUpdatedBuilder.build();
        if (!indexUpdates.isEmpty()) {
            SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(USER_INDEX, projectId), userId)
                            .doc(gson.toJson(indexUpdates), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
            return new UserAndIndexingFuture<>(userUpdated, indexingFuture);
        } else {
            return new UserAndIndexingFuture<>(userUpdated, Futures.immediateFuture(null));
        }
    }

    @Override
    public UserModel userVoteUpdateBloom(String projectId, String userId, String ideaId) {
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
    public UserModel userExpressUpdateBloom(String projectId, String userId, String ideaId) {
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
    public UserAndIndexingFuture<UpdateResponse> updateUserBalance(String projectId, String userId, long balanceDiff, Optional<String> ideaIdOpt) {
        UserModel user = getUser(projectId, userId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"));
        BloomFilter<CharSequence> bloomFilter = Optional.ofNullable(user.getFundBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .orElseGet(() -> BloomFilter.create(Funnels.stringFunnel(Charsets.UTF_8), config.fundBloomFilterExpectedInsertions(), config.fundBloomFilterFalsePositiveProbability()));
        boolean bloomFilterUpdated = ideaIdOpt.map(bloomFilter::put).orElse(false);

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
    public String createToken(String projectId, String userId, Duration ttl) {
        return createToken(projectId, userId, ttl, true);
    }

    @Override
    public String createToken(String projectId, String userId, Duration ttl, boolean revocable) {
        Instant now = Instant.now();
        return Jwts.builder()
                .setIssuedAt(revocable ? new Date(now.toEpochMilli()) : null)
                .setExpiration(new Date(now.plus(ttl).toEpochMilli()))
                .addClaims(ImmutableMap.of(
                        "pid", projectId,
                        "uid", userId))
                .signWith(config.tokenSignerPrivKey(), MoreConfigValueConverters.TOKEN_ALGO)
                .compressWith(new GzipCompressionCodec())
                .compact();
    }

    @Override
    public Optional<UserModel> verifyToken(String token) {
        if (Strings.isNullOrEmpty(token)) {
            return Optional.empty();
        }

        Claims claims;
        try {
            claims = Jwts.parser()
                    .setSigningKey(config.tokenSignerPrivKey())
                    .parseClaimsJws(token)
                    .getBody();
        } catch (UnsupportedJwtException | MalformedJwtException | SignatureException ex) {
            log.warn("Failed to parse token {}", token, ex);
            return Optional.empty();
        } catch (ExpiredJwtException ex) {
            log.trace("Token is past expiration {}", token);
            return Optional.empty();
        }

        String projectId;
        String userId;
        try {
            projectId = claims.get("pid", String.class);
            userId = claims.get("uid", String.class);
        } catch (RequiredTypeException ex) {
            log.warn("Invalid type in token {}", token);
            return Optional.empty();
        }
        if (projectId == null) {
            log.warn("Missing pid in token {}", token);
            return Optional.empty();
        }
        if (userId == null) {
            log.warn("Missing uid in token {}", token);
            return Optional.empty();
        }

        Optional<UserModel> userOpt = getUser(projectId, userId);
        if (!userOpt.isPresent()) {
            log.info("User in auth token does not exists, projectId {} userId {}",
                    projectId, userId);
            return Optional.empty();
        }

        if (userOpt.get().getAuthTokenValidityStart() != null
                && claims.getIssuedAt() != null
                && userOpt.get().getAuthTokenValidityStart().isAfter(claims.getIssuedAt().toInstant())) {
            log.debug("Token is created prior to revocation {}, projectId {} userId {}",
                    userOpt.get().getAuthTokenValidityStart(), projectId, userId);
            return Optional.empty();
        }

        return userOpt;
    }

    @Override
    public Optional<UserModel> ssoCreateOrGet(String projectId, String secretKey, String token) {
        if (Strings.isNullOrEmpty(token) || Strings.isNullOrEmpty(secretKey)) {
            return Optional.empty();
        }

        Claims claims;
        try {
            claims = Jwts.parser()
                    .setSigningKey(new SecretKeySpec(secretKey.getBytes(Charsets.UTF_8), SignatureAlgorithm.HS256.getJcaName()))
                    .parseClaimsJws(token)
                    .getBody();
        } catch (UnsupportedJwtException | MalformedJwtException | SignatureException ex) {
            if (LogUtil.rateLimitAllowLog("ssoCreateOrGet-failed-parse")) {
                log.warn("Failed to parse token {}", token, ex);
            }
            return Optional.empty();
        } catch (ExpiredJwtException ex) {
            log.trace("Token is past expiration {}", token);
            return Optional.empty();
        }

        String guid;
        Optional<String> emailOpt;
        Optional<String> nameOpt;
        try {
            guid = claims.get("guid", String.class);
            if (guid == null) {
                if (LogUtil.rateLimitAllowLog("ssoCreateOrGet-missing-guid")) {
                    log.warn("Missing guid in token {}", token);
                }
                return Optional.empty();
            }
            emailOpt = Optional.ofNullable(claims.get("email", String.class));
            nameOpt = Optional.ofNullable(claims.get("name", String.class));
        } catch (RequiredTypeException ex) {
            if (LogUtil.rateLimitAllowLog("ssoCreateOrGet-invalid-type")) {
                log.warn("Invalid type in token {}", token, ex);
            }
            return Optional.empty();
        }

        Optional<UserModel> userOpt = getUserByIdentifier(projectId, IdentifierType.SSO_GUID, guid);
        if (userOpt.isPresent()) {
            if (userOpt.get().getAuthTokenValidityStart() != null
                    && claims.getIssuedAt() != null
                    && userOpt.get().getAuthTokenValidityStart().isAfter(claims.getIssuedAt().toInstant())) {
                log.debug("SSO Token is created prior to revocation {}, projectId {} userId {}",
                        userOpt.get().getAuthTokenValidityStart(), projectId, userOpt.get().getUserId());
                userOpt = Optional.empty();
            }
        } else {
            userOpt = Optional.of(createUser(new UserModel(
                    projectId,
                    genUserId(),
                    guid,
                    null,
                    nameOpt.orElse(null),
                    emailOpt.orElse(null),
                    null,
                    null,
                    null,
                    emailOpt.isPresent(),
                    0,
                    null,
                    null,
                    null,
                    Instant.now(),
                    null,
                    null,
                    null))
                    .getUser());
        }

        return userOpt;
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
        if (!Strings.isNullOrEmpty(user.getSsoGuid())) {
            identifiersBuilder.put(IdentifierType.SSO_GUID, user.getSsoGuid());
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
