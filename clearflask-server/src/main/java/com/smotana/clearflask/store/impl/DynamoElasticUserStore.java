// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.*;
import com.amazonaws.services.dynamodbv2.document.spec.*;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.model.*;
import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.*;
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;
import com.google.common.hash.HashFunction;
import com.google.common.hash.Hashing;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;
import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.gson.annotations.SerializedName;
import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.kik.config.ice.convert.MoreConfigValueConverters;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.mysql.CompletionStageUtil;
import com.smotana.clearflask.store.mysql.DefaultMysqlProvider;
import com.smotana.clearflask.store.mysql.MoreSQLDataType;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.store.mysql.model.tables.JooqUser;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqUserRecord;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.OAuthUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.util.WebhookService;
import io.dataspray.singletable.IndexSchema;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import io.jsonwebtoken.*;
import io.jsonwebtoken.impl.compression.GzipCompressionCodec;
import io.jsonwebtoken.security.SignatureException;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.lucene.search.TotalHits;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.GetIndexRequest;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.ZeroTermsQueryOption;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Query;
import org.jooq.SortField;
import org.jooq.impl.SQLDataType;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.elastic.ElasticUtil.*;
import static com.smotana.clearflask.store.mysql.DefaultMysqlProvider.ID_MAX_LENGTH;
import static com.smotana.clearflask.util.ExplicitNull.orNull;

@Slf4j
@Singleton
public class DynamoElasticUserStore extends ManagedService implements UserStore {

    @Value
    public static class OAuthAuthorizationResponse {
        @NonNull
        @GsonNonNull
        @SerializedName("access_token")
        String accessToken;
    }

    public interface Config {
        /**
         * Intended for tests. Force immediate index refresh after write request.
         */
        @DefaultValue("false")
        boolean elasticForceRefresh();

        @DefaultValue("0.001")
        double voteBloomFilterFalsePositiveProbability();

        @DefaultValue("200")
        long voteBloomFilterExpectedInsertions();

        @DefaultValue("0.001")
        double commentVoteBloomFilterFalsePositiveProbability();

        @DefaultValue("100")
        long commentVoteBloomFilterExpectedInsertions();

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

        /**
         * This value can never be decreased.
         * Increase this value to match the number of DynamoDB shards.
         */
        @DefaultValue("8")
        long userCounterShardCount();

        @DefaultValue("true")
        boolean enableHistograms();
    }

    private static final String USER_INDEX = "user";

    private final HashFunction hashFunction = Hashing.murmur3_128(-223823442);

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    @Named("user")
    private ConfigSearch configSearch;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private SingleTable singleTable;
    @Inject
    private Provider<RestHighLevelClient> elastic;
    @Inject
    private ElasticUtil elasticUtil;
    @Inject
    private Gson gson;
    @Inject
    private WebhookService webhookService;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private Provider<DSLContext> mysql;
    @Inject
    private MysqlUtil mysqlUtil;

    private TableSchema<UserModel> userSchema;
    private IndexSchema<UserModel> userByProjectIdSchema;
    private TableSchema<IdentifierUser> identifierToUserIdSchema;
    private IndexSchema<IdentifierUser> identifierByProjectIdSchema;
    private TableSchema<UserSession> sessionByIdSchema;
    private IndexSchema<UserSession> sessionByUserSchema;
    private TableSchema<UserCounter> userCounterSchema;
    private CloseableHttpClient client;

    @Inject
    private void setup() {
        userSchema = singleTable.parseTableSchema(UserModel.class);
        userByProjectIdSchema = singleTable.parseGlobalSecondaryIndexSchema(2, UserModel.class);
        identifierToUserIdSchema = singleTable.parseTableSchema(IdentifierUser.class);
        identifierByProjectIdSchema = singleTable.parseGlobalSecondaryIndexSchema(2, IdentifierUser.class);
        sessionByIdSchema = singleTable.parseTableSchema(UserSession.class);
        sessionByUserSchema = singleTable.parseGlobalSecondaryIndexSchema(1, UserSession.class);
        userCounterSchema = singleTable.parseTableSchema(UserCounter.class);
    }

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(DefaultMysqlProvider.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        client = HttpClientBuilder.create().build();
        if (configApp.createIndexesOnStartup() && configApp.defaultSearchEngine().isWriteMysql()) {
            createIndexMysql();
        }
    }

    @Override
    protected void serviceStop() throws Exception {
        if (client != null) {
            client.close();
        }
    }

    @Extern
    @Override
    public ListenableFuture<Void> createIndex(String projectId) {
        if (projectStore.getSearchEngineForProject(projectId).isWriteElastic()) {
            return createIndexElasticSearch(projectId);
        } else {
            return Futures.immediateFuture(null);
        }
    }

    @Extern
    public void createIndexMysql() {
        log.debug("Creating Mysql table {}", USER_INDEX);
        mysql.get().createTableIfNotExists(USER_INDEX)
                .column("projectId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("userId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("name", SQLDataType.VARCHAR(255))
                .column("email", SQLDataType.VARCHAR(255))
                .column("created", MoreSQLDataType.DATETIME(6).notNull())
                .column("balance", SQLDataType.BIGINT)
                .column("isMod", SQLDataType.BOOLEAN)
                .primaryKey("projectId", "userId")
                .execute();
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqUser.USER, JooqUser.USER.PROJECTID));
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqUser.USER, JooqUser.USER.ISMOD));
    }

    @Extern
    public ListenableFuture<Void> createIndexElasticSearch(String projectId) {
        SettableFuture<Void> indexingFuture = SettableFuture.create();
        elastic.get().indices().createAsync(new CreateIndexRequest(elasticUtil.getIndexName(USER_INDEX, projectId))
                        .settings(gson.toJson(ImmutableMap.of(
                                "index", ImmutableMap.of(
                                        "analysis", ImmutableMap.of(
                                                "analyzer", ImmutableMap.of(
                                                        AUTOCOMPLETE_ANALYZER_NAME, AUTOCOMPLETE_ANALYZER
                                                ),
                                                "tokenizer", ImmutableMap.of(
                                                        AUTOCOMPLETE_TOKENIZER_NAME, AUTOCOMPLETE_TOKENIZER
                                                ))))), XContentType.JSON)
                        .mapping(gson.toJson(ImmutableMap.of(
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
                                        .put("created", ImmutableMap.of(
                                                "type", "date",
                                                "format", "epoch_second"))
                                        .put("balance", ImmutableMap.of(
                                                "type", "double"))
                                        .put("isMod", ImmutableMap.of(
                                                "type", "boolean"))
                                        .build())), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture, elasticUtil::isIndexAlreadyExistsException));
        return indexingFuture;
    }

    @Extern
    @Override
    public void repopulateIndex(String projectId, boolean deleteExistingIndex, boolean repopulateElasticSearch, boolean repopulateMysql) throws Exception {
        log.info("Repopulating index for project {} deleteExistingIndex {} repopulateElasticSearch {} repopulateMysql {}",
                projectId, deleteExistingIndex, repopulateElasticSearch, repopulateMysql);
        if (repopulateElasticSearch) {
            boolean indexAlreadyExists = elastic.get().indices().exists(
                    new GetIndexRequest(elasticUtil.getIndexName(USER_INDEX, projectId)),
                    RequestOptions.DEFAULT);
            if (indexAlreadyExists && deleteExistingIndex) {
                elastic.get().indices().delete(
                        new DeleteIndexRequest(elasticUtil.getIndexName(USER_INDEX, projectId)),
                        RequestOptions.DEFAULT);
            }
            if (!indexAlreadyExists || deleteExistingIndex) {
                createIndexElasticSearch(projectId).get();
            }
        }
        if (repopulateMysql && deleteExistingIndex) {
            mysql.get().deleteFrom(JooqUser.USER)
                    .where(JooqUser.USER.PROJECTID.eq(projectId))
                    .execute();
        }

        StreamSupport.stream(userByProjectIdSchema.index().query(new QuerySpec()
                                .withHashKey(userByProjectIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(userByProjectIdSchema.rangeKeyName())
                                        .beginsWith(userByProjectIdSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(userByProjectIdSchema::fromItem)
                .filter(user -> projectId.equals(user.getProjectId()))
                .forEach(user -> {
                    if (repopulateElasticSearch) {
                        try {
                            elastic.get().index(userToEsIndexRequest(user), RequestOptions.DEFAULT);
                        } catch (IOException ex) {
                            if (LogUtil.rateLimitAllowLog("dynamoelsaticuserstore-reindex-failure")) {
                                log.warn("Failed to re-index user {}", user.getUserId(), ex);
                            }
                        }
                    }
                    if (repopulateMysql) {
                        userToMysqlQuery(user).execute();
                    }
                });
    }

    @Override
    public UserAndIndexingFuture createUser(UserModel user) {
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
                throw new ApiException(Response.Status.CONFLICT, "User with your sign in details already exists, please choose another.", ex);
            }
            throw ex;
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        indexUser(indexingFuture, user);

        // This should really be in the IdeaResource, but there are too many references to create a user
        webhookService.eventUserNew(user);

        return new UserAndIndexingFuture(user, indexingFuture);
    }

    @Extern
    @Override
    public Optional<UserModel> getUser(String projectId, String userId) {
        return getUser(projectId, userId, false)
                .or(() -> getUser(projectId, userId, true));
    }

    private Optional<UserModel> getUser(String projectId, String userId, boolean consistentRead) {
        return Optional.ofNullable(userSchema.fromItem(userSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId)))
                .withConsistentRead(consistentRead))));
    }

    @Override
    public ImmutableMap<String, UserModel> getUsers(String projectId, ImmutableCollection<String> userIds) {
        if (userIds.isEmpty()) {
            return ImmutableMap.of();
        }
        return singleTable.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(userSchema.tableName()).withPrimaryKeys(userIds.stream()
                        .map(userId -> userSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "userId", userId)))
                        .toArray(PrimaryKey[]::new))))
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
    public HistogramResponse histogram(String projectId, HistogramSearchAdmin searchAdmin) {
        if (!config.enableHistograms()) {
            return new HistogramResponse(ImmutableList.of(), new Hits(0L, null));
        }

        if (projectStore.getSearchEngineForProject(projectId).isReadElastic()) {
            return elasticUtil.histogram(
                    elasticUtil.getIndexName(USER_INDEX, projectId),
                    "created",
                    Optional.ofNullable(searchAdmin.getFilterCreatedStart()),
                    Optional.ofNullable(searchAdmin.getFilterCreatedEnd()),
                    Optional.ofNullable(searchAdmin.getInterval()),
                    Optional.empty());
        } else {
            return mysqlUtil.histogram(
                    JooqUser.USER,
                    JooqUser.USER.PROJECTID.eq(projectId),
                    JooqUser.USER.CREATED,
                    Optional.ofNullable(searchAdmin.getFilterCreatedStart()),
                    Optional.ofNullable(searchAdmin.getFilterCreatedEnd()),
                    Optional.ofNullable(searchAdmin.getInterval()),
                    Optional.empty());
        }
    }

    @Override
    public SearchUsersResponse searchUsers(String projectId, UserSearchAdmin userSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt) {
        if (projectStore.getSearchEngineForProject(projectId).isReadElastic()) {
            Optional<SortOrder> sortOrderOpt;
            if (userSearchAdmin.getSortOrder() != null) {
                switch (userSearchAdmin.getSortOrder()) {
                    case ASC:
                        sortOrderOpt = Optional.of(SortOrder.ASC);
                        break;
                    case DESC:
                        sortOrderOpt = Optional.of(SortOrder.DESC);
                        break;
                    default:
                        throw new ApiException(Response.Status.BAD_REQUEST,
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
                        throw new ApiException(Response.Status.BAD_REQUEST,
                                "Sorting by '" + userSearchAdmin.getSortBy() + "' not supported");
                }
            } else {
                sortFields = ImmutableList.of();
            }

            BoolQueryBuilder queryBuilder = QueryBuilders.boolQuery();
            if (userSearchAdmin.getIsMod() != null) {
                queryBuilder.must(QueryBuilders.termQuery("isMod", userSearchAdmin.getIsMod().booleanValue()));
            }
            if (!Strings.isNullOrEmpty(userSearchAdmin.getSearchText())) {
                queryBuilder.must(QueryBuilders.multiMatchQuery(userSearchAdmin.getSearchText(), "name", "email")
                        .fuzziness("AUTO").zeroTermsQuery(ZeroTermsQueryOption.ALL));
            }
            log.trace("User search query: {}", queryBuilder);
            ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(
                    new SearchRequest(elasticUtil.getIndexName(USER_INDEX, projectId))
                            .source(new SearchSourceBuilder()
                                    .fetchSource(false)
                                    .query(queryBuilder)),
                    cursorOpt, sortFields, sortOrderOpt, useAccurateCursor, pageSizeOpt, configSearch, ImmutableSet.of());

            SearchHit[] hits = searchResponseWithCursor.getSearchResponse().getHits().getHits();
            if (hits.length == 0) {
                return new SearchUsersResponse(
                        ImmutableList.of(),
                        Optional.empty(),
                        0L,
                        false);
            }

            ImmutableList<String> userIds = Arrays.stream(hits)
                    .map(SearchHit::getId)
                    .collect(ImmutableList.toImmutableList());

            return new SearchUsersResponse(
                    userIds,
                    searchResponseWithCursor.getCursorOpt(),
                    searchResponseWithCursor.getSearchResponse().getHits().getTotalHits().value,
                    searchResponseWithCursor.getSearchResponse().getHits().getTotalHits().relation == TotalHits.Relation.GREATER_THAN_OR_EQUAL_TO);
        } else {
            org.jooq.SortOrder sortOrder;
            if (userSearchAdmin.getSortOrder() != null) {
                switch (userSearchAdmin.getSortOrder()) {
                    case ASC:
                        sortOrder = org.jooq.SortOrder.ASC;
                        break;
                    case DESC:
                        sortOrder = org.jooq.SortOrder.DESC;
                        break;
                    default:
                        throw new ApiException(Response.Status.BAD_REQUEST,
                                "Sort order '" + userSearchAdmin.getSortOrder() + "' not supported");
                }
            } else {
                sortOrder = org.jooq.SortOrder.DEFAULT;
            }

            ImmutableList<SortField<?>> sortFields;
            if (userSearchAdmin.getSortBy() != null) {
                switch (userSearchAdmin.getSortBy()) {
                    case CREATED:
                        sortFields = ImmutableList.of(JooqUser.USER.CREATED.sort(sortOrder));
                        break;
                    case FUNDSAVAILABLE:
                        sortFields = ImmutableList.of(JooqUser.USER.BALANCE.sort(sortOrder));
                        break;
                    case FUNDEDIDEAS:
                    case SUPPORTEDIDEAS:
                    case FUNDEDAMOUNT:
                    case LASTACTIVE:
                    default:
                        throw new ApiException(Response.Status.BAD_REQUEST,
                                "Sorting by '" + userSearchAdmin.getSortBy() + "' not supported");
                }
            } else {
                sortFields = ImmutableList.of();
            }

            Condition conditions = JooqUser.USER.PROJECTID.eq(projectId);
            if (userSearchAdmin.getIsMod() != null) {
                conditions = conditions.and(JooqUser.USER.ISMOD.eq(userSearchAdmin.getIsMod()));
            }
            if (!Strings.isNullOrEmpty(userSearchAdmin.getSearchText())) {
                conditions = conditions.and(JooqUser.USER.NAME.like("%" + userSearchAdmin.getSearchText() + "%")
                        .or(JooqUser.USER.EMAIL.like("%" + userSearchAdmin.getSearchText() + "%")));
            }

            List<String> userIds = mysql.get().select(JooqUser.USER.USERID)
                    .from(JooqUser.USER)
                    .where(conditions)
                    .orderBy(sortFields)
                    .offset(mysqlUtil.offset(cursorOpt))
                    .limit(mysqlUtil.pageSizeMax(configSearch, pageSizeOpt))
                    .fetch(JooqUser.USER.USERID);

            return new SearchUsersResponse(
                    ImmutableList.copyOf(userIds),
                    mysqlUtil.nextCursor(configSearch, cursorOpt, pageSizeOpt, userIds.size()),
                    userIds.size(),
                    true);
        }
    }

    @Override
    public void exportAllForProject(String projectId, Consumer<UserModel> consumer) {
        StreamSupport.stream(userByProjectIdSchema.index().query(new QuerySpec()
                                .withHashKey(userByProjectIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(userByProjectIdSchema.rangeKeyName())
                                        .beginsWith(userByProjectIdSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(userByProjectIdSchema::fromItem)
                .filter(user -> projectId.equals(user.getProjectId()))
                .forEach(consumer);
    }

    @Override
    public long getUserCountForProject(String projectId) {
        return StreamSupport.stream(userCounterSchema.table().query(new QuerySpec()
                                .withHashKey(userCounterSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(userCounterSchema.rangeKeyName())
                                        .beginsWith(userCounterSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(userCounterSchema::fromItem)
                .mapToLong(UserCounter::getCount)
                .sum();
    }

    @Override
    public void setUserTracked(String projectId, String userId) {
        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, Object> valMap = Maps.newHashMap();
        List<String> conditions = Lists.newArrayList();
        List<String> setUpdates = Lists.newArrayList();

        nameMap.put("#isTracked", "isTracked");
        valMap.put(":true", true);
        String conditionExpression = "#isTracked <> :true";
        String updateExpression = "SET #isTracked = :true";

        UserModel userModel;
        try {
            userModel = userSchema.fromItem(userSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(userSchema.primaryKey(Map.of(
                                    "projectId", projectId,
                                    "userId", userId)))
                            .withUpdateExpression(updateExpression)
                            .withConditionExpression(conditionExpression)
                            .withNameMap(nameMap)
                            .withValueMap(valMap)
                            .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem());
        } catch (ConditionalCheckFailedException ex) {
            log.trace("User already tracked, projectId {} userId {}", projectId, userId, ex);
            return;
        }

        updateUserCountForProject(projectId, 1L);
    }

    @Extern
    @Override
    public void updateUserCountForProject(String projectId, long diff) {
        if (diff == 0L) {
            return;
        }
        long userCounterShardId = ThreadLocalRandom.current().nextLong(config.userCounterShardCount());
        HashMap<String, String> userCounterNameMap = Maps.newHashMap();
        HashMap<String, Object> userCounterValueMap = Maps.newHashMap();
        userCounterNameMap.put("#count", "count");
        userCounterValueMap.put(":diff", diff);
        userCounterValueMap.put(":zero", 0L);
        String userCounterUpdateExpression = userCounterSchema.upsertExpression(new UserCounter(projectId, userCounterShardId, diff), userCounterNameMap, userCounterValueMap,
                ImmutableSet.of("count"), ", #count = if_not_exists(#count, :zero) + :diff");
        log.trace("UserCounter update expression: {}", userCounterUpdateExpression);
        userCounterSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(userCounterSchema.primaryKey(Map.of(
                        "shardId", userCounterShardId,
                        "projectId", projectId)))
                .withUpdateExpression(userCounterUpdateExpression)
                .withNameMap(userCounterNameMap)
                .withValueMap(userCounterValueMap));
    }

    @Override
    public UserAndIndexingFuture updateUser(String projectId, String userId, UserUpdateAdmin updatesAdmin) {
        return updateUser(projectId, userId, updatesAdmin, null, null, null);
    }

    @FunctionalInterface
    private interface UpdateIdentifierFunction {
        void apply(IdentifierType type, String oldVal, String newVal);
    }

    @Override
    public UserAndIndexingFuture updateUser(String projectId, String userId, UserUpdate updates) {
        return updateUser(projectId, userId, new UserUpdateAdmin(
                        updates.getName(),
                        updates.getEmail(),
                        updates.getPassword(),
                        updates.getEmailNotify(),
                        null,
                        null,
                        null,
                        null,
                        null),
                updates.getIosPushToken(),
                updates.getAndroidPushToken(),
                updates.getBrowserPushToken());
    }

    private UserAndIndexingFuture updateUser(
            String projectId,
            String userId,
            UserUpdateAdmin updates,
            String iosPushToken,
            String androidPushToken,
            String browserPushToken) {
        UserModel user = getUser(projectId, userId).get();
        if (!Strings.isNullOrEmpty(updates.getPassword()) && !Strings.isNullOrEmpty(user.getSsoGuid())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Cannot change password when using Single Sign-On");
        }

        UserModel.UserModelBuilder userUpdatedBuilder = user.toBuilder();

        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, AttributeValue> valMap = Maps.newHashMap();
        List<String> setUpdates = Lists.newArrayList();
        List<String> removeUpdates = Lists.newArrayList();
        ImmutableList.Builder<TransactWriteItem> transactionsBuilder = ImmutableList.builder();
        Map<String, Object> indexUpdates = Maps.newHashMap();
        JooqUserRecord mysqlUpdates = JooqUser.USER.newRecord();
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
            mysqlUpdates.setName(updates.getName());
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
            mysqlUpdates.setEmail(updates.getEmail());
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
        if (updates.getIosPush() == Boolean.FALSE) iosPushToken = "";
        if (iosPushToken != null) {
            nameMap.put("#iosPushToken", "iosPushToken");
            if (iosPushToken.isEmpty()) {
                removeUpdates.add("#iosPushToken");
            } else {
                valMap.put(":iosPushToken", userSchema.toAttrValue("iosPushToken", iosPushToken));
                setUpdates.add("#iosPushToken = :iosPushToken");
            }
            updateIdentifier.apply(IdentifierType.IOS_PUSH, user.getIosPushToken(), iosPushToken);
            userUpdatedBuilder.iosPushToken(iosPushToken);
        }
        if (updates.getAndroidPush() == Boolean.FALSE) androidPushToken = "";
        if (androidPushToken != null) {
            nameMap.put("#androidPushToken", "androidPushToken");
            if (androidPushToken.isEmpty()) {
                removeUpdates.add("#androidPushToken");
            } else {
                valMap.put(":androidPushToken", userSchema.toAttrValue("androidPushToken", androidPushToken));
                setUpdates.add("#androidPushToken = :androidPushToken");
            }
            updateIdentifier.apply(IdentifierType.ANDROID_PUSH, user.getAndroidPushToken(), androidPushToken);
            userUpdatedBuilder.androidPushToken(androidPushToken);
        }
        if (updates.getBrowserPush() == Boolean.FALSE) browserPushToken = "";
        if (browserPushToken != null) {
            nameMap.put("#browserPushToken", "browserPushToken");
            if (browserPushToken.isEmpty()) {
                removeUpdates.add("#browserPushToken");
            } else {
                valMap.put(":browserPushToken", userSchema.toAttrValue("browserPushToken", browserPushToken));
                setUpdates.add("#browserPushToken = :browserPushToken");
            }
            updateIdentifier.apply(IdentifierType.BROWSER_PUSH, user.getBrowserPushToken(), browserPushToken);
            userUpdatedBuilder.browserPushToken(browserPushToken);
        }
        if (updates.getIsMod() != null) {
            nameMap.put("#isMod", "isMod");
            if (updates.getIsMod() == Boolean.FALSE) {
                removeUpdates.add("#isMod");
            } else {
                valMap.put(":isMod", userSchema.toAttrValue("isMod", true));
                setUpdates.add("#isMod = :isMod");
            }
            userUpdatedBuilder.isMod(updates.getIsMod());
            indexUpdates.put("isMod", updates.getIsMod() == Boolean.TRUE);
            mysqlUpdates.setIsmod(updates.getIsMod());
            // Update isMod flag in all active sessions instead of revoking them
            updateSessionsModStatus(projectId, userId, updates.getIsMod());
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
        if (Strings.isNullOrEmpty(updateExpression)) {
            // Nothing to update
            return new UserAndIndexingFuture(user, Futures.immediateFuture(null));
        }
        log.trace("updateUser with expression: {} {} {}", updateExpression, nameMap, valMap);

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
        } catch (TransactionCanceledException ex) {
            if (ex.getCancellationReasons().stream().map(CancellationReason::getCode).anyMatch("ConditionalCheckFailed"::equals)) {
                throw new ApiException(Response.Status.CONFLICT, "User with your sign in details already exists, please choose another.", ex);
            }
            throw ex;
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            if (indexUpdates.size() > 0) {
                elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(USER_INDEX, projectId), userId)
                                .doc(gson.toJson(indexUpdates), XContentType.JSON)
                                .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                        RequestOptions.DEFAULT,
                        searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexUser(f, projectId, userId))
                                : ActionListeners.onFailureRetry(() -> indexUser(projectId, userId)));
            } else if (searchEngine.isReadElastic()) {
                indexingFuture.set(null);
            }
        }
        if (searchEngine.isWriteMysql()) {
            if (mysqlUpdates.changed()) {
                CompletionStage<Integer> completionStage = mysql.get().update(JooqUser.USER)
                        .set(mysqlUpdates)
                        .where(JooqUser.USER.PROJECTID.eq(projectId)
                                .and(JooqUser.USER.USERID.eq(userId)))
                        .executeAsync();
                if (searchEngine.isReadMysql()) {
                    CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
                } else {
                    CompletionStageUtil.logFailure(completionStage);
                }
            } else if (searchEngine.isReadMysql()) {
                indexingFuture.set(null);
            }
        }

        return new UserAndIndexingFuture(userUpdatedBuilder.build(), indexingFuture);
    }

    @Override
    public UserModel userVoteUpdateBloom(String projectId, String userId, String ideaId) {
        UserModel user = getUser(projectId, userId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"));
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
    public UserModel userCommentVoteUpdateBloom(String projectId, String userId, String commentId) {
        UserModel user = getUser(projectId, userId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"));
        BloomFilter<CharSequence> bloomFilter = Optional.ofNullable(user.getCommentVoteBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .orElseGet(() -> BloomFilter.create(Funnels.stringFunnel(Charsets.UTF_8), config.commentVoteBloomFilterExpectedInsertions(), config.commentVoteBloomFilterFalsePositiveProbability()));
        boolean bloomFilterUpdated = bloomFilter.put(commentId);
        if (!bloomFilterUpdated) {
            return user;
        }
        return userSchema.fromItem(userSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(userSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "userId", userId)))
                        .withAttributeUpdate(new AttributeUpdate("commentVoteBloom").put(BloomFilters.toByteArray(bloomFilter)))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public UserModel userExpressUpdateBloom(String projectId, String userId, String ideaId) {
        UserModel user = getUser(projectId, userId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"));
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
    public UserModel updateSubscription(String projectId, String userId, String categoryId, boolean subscribe) {
        return userSchema.fromItem(userSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(userSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "userId", userId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression((subscribe ? "ADD" : "DELETE") + " #subscribedCategoryIds :categoryId")
                        .withNameMap(new NameMap()
                                .with("#subscribedCategoryIds", "subscribedCategoryIds")
                                .with("#partitionKey", userSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().withStringSet(":categoryId", categoryId))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public UserAndIndexingFuture updateUserBalance(String projectId, String userId, long balanceDiff, Optional<String> updateBloomWithIdeaIdOpt) {
        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, Object> valMap = Maps.newHashMap();
        List<String> conditions = Lists.newArrayList();
        List<String> setUpdates = Lists.newArrayList();

        nameMap.put("#balance", "balance");
        valMap.put(":balanceDiff", balanceDiff);
        valMap.put(":zero", 0L);

        setUpdates.add("#balance = if_not_exists(#balance, :zero) + :balanceDiff");

        if (updateBloomWithIdeaIdOpt.isPresent()) {
            UserModel user = getUser(projectId, userId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"));
            BloomFilter<CharSequence> bloomFilter = Optional.ofNullable(user.getFundBloom())
                    .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                    .orElseGet(() -> BloomFilter.create(Funnels.stringFunnel(Charsets.UTF_8), config.fundBloomFilterExpectedInsertions(), config.fundBloomFilterFalsePositiveProbability()));
            boolean bloomFilterUpdated = bloomFilter.put(updateBloomWithIdeaIdOpt.get());
            if (bloomFilterUpdated) {
                nameMap.put("#fundBloom", "fundBloom");
                valMap.put(":fundBloom", BloomFilters.toByteArray(bloomFilter));
                setUpdates.add("#fundBloom = :fundBloom");
            }
        }

        Optional<String> conditionExpressionOpt = Optional.empty();
        if (balanceDiff < 0L) {
            valMap.put(":balanceDiffAbs", Math.abs(balanceDiff));
            conditionExpressionOpt = Optional.of("#balance >= :balanceDiffAbs");
        }

        String updateExpression = "SET " + String.join(", ", setUpdates);
        log.trace("updateUserBalance expression: {}", updateExpression);
        UserModel userModel;
        try {
            userModel = userSchema.fromItem(userSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(userSchema.primaryKey(Map.of(
                                    "projectId", projectId,
                                    "userId", userId)))
                            .withUpdateExpression(updateExpression)
                            .withConditionExpression(conditionExpressionOpt.orElse(null))
                            .withNameMap(nameMap)
                            .withValueMap(valMap)
                            .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem());
        } catch (ConditionalCheckFailedException ex) {
            if (LogUtil.rateLimitAllowLog("userStore-negativeBalanceWarn")) {
                log.warn("Attempted to set balance below zero, projectId {} userId {} balanceDiff {} updateBloomWithIdeaIdOpt {}",
                        projectId, userId, balanceDiff, updateBloomWithIdeaIdOpt, ex);
            }
            throw new ApiException(Response.Status.BAD_REQUEST, "Not enough credits");
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(USER_INDEX, projectId), userModel.getUserId())
                            .doc(gson.toJson(Map.of("balance", userModel.getBalance())), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexUser(f, projectId, userId))
                            : ActionListeners.onFailureRetry(() -> indexUser(projectId, userId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqUser.USER)
                    .set(JooqUser.USER.BALANCE, userModel.getBalance())
                    .where(JooqUser.USER.PROJECTID.eq(projectId)
                            .and(JooqUser.USER.USERID.eq(userId)))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new UserAndIndexingFuture(userModel, indexingFuture);
    }

    @Override
    public ListenableFuture<Void> deleteUsers(String projectId, ImmutableCollection<String> userIds) {
        if (userIds.isEmpty()) {
            return Futures.immediateFuture(null);
        }
        ImmutableCollection<UserModel> users = getUsers(projectId, userIds).values();
        if (users.isEmpty()) {
            return Futures.immediateFuture(null);
        }
        singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(userSchema.tableName()).withPrimaryKeysToDelete(users.stream()
                .map(userModel -> userSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userModel.getUserId())))
                .toArray(PrimaryKey[]::new))));

        PrimaryKey[] identifiersToDelete = users.stream()
                .map(this::getUserIdentifiers)
                .map(ImmutableMap::entrySet)
                .flatMap(Collection::stream)
                .map(e -> identifierToUserIdSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "type", e.getKey().getType(),
                        "identifierHash", e.getKey().isHashed() ? hashIdentifier(e.getValue()) : e.getValue())))
                .toArray(PrimaryKey[]::new);
        if (identifiersToDelete.length > 0) {
            singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(identifierToUserIdSchema.tableName()).withPrimaryKeysToDelete(identifiersToDelete)));
        }

        updateUserCountForProject(projectId, -users.stream()
                .filter(user -> user.getIsTracked() == Boolean.TRUE)
                .count());

        users.stream()
                .map(UserModel::getUserId)
                .forEach(userId -> revokeSessions(projectId, userId, Optional.empty()));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.get().bulkAsync(new BulkRequest()
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                            .add(users.stream()
                                    .map(user -> new DeleteRequest(elasticUtil.getIndexName(USER_INDEX, projectId), user.getUserId()))
                                    .collect(ImmutableList.toImmutableList())),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().deleteFrom(JooqUser.USER)
                    .where(JooqUser.USER.PROJECTID.eq(projectId)
                            .and(JooqUser.USER.USERID.in(users.stream()
                                    .map(UserModel::getUserId)
                                    .collect(Collectors.toList()))))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

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

    @Extern
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

    @Extern
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
            if (LogUtil.rateLimitAllowLog("ssoCreateOrGet-expired-token")) {
                log.warn("Token is past expiration {}", token);
            }
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

        UserModel userModel = createOrGet(projectId, guid, emailOpt, nameOpt, false);

        if (userModel.getAuthTokenValidityStart() != null
                && claims.getIssuedAt() != null
                && userModel.getAuthTokenValidityStart().isAfter(claims.getIssuedAt().toInstant())) {
            log.debug("SSO Token is created prior to revocation {}, projectId {} userId {}",
                    userModel.getAuthTokenValidityStart(), projectId, userModel.getUserId());
            return Optional.empty();
        }

        return Optional.of(userModel);
    }

    @Extern
    @Override
    public Optional<UserModel> oauthCreateOrGet(String projectId, NotificationMethodsOauth oauthProvider, String clientSecret, String redirectUrl, String code) {
        return OAuthUtil
                .fetch(
                        gson,
                        projectId,
                        redirectUrl,
                        oauthProvider.getTokenUrl(),
                        oauthProvider.getUserProfileUrl(),
                        oauthProvider.getGuidJsonPath(),
                        Optional.ofNullable(Strings.emptyToNull(oauthProvider.getNameJsonPath())),
                        Optional.ofNullable(Strings.emptyToNull(oauthProvider.getEmailUrl())),
                        Optional.ofNullable(Strings.emptyToNull(oauthProvider.getEmailJsonPath())),
                        oauthProvider.getClientId(),
                        clientSecret,
                        code)
                .map(result -> createOrGet(
                        projectId,
                        result.getGuid(),
                        result.getEmailOpt(),
                        result.getNameOpt(),
                        false));
    }

    @Extern
    @Override
    public UserModel createOrGet(String projectId, String guid, Optional<String> emailOpt, Optional<String> nameOpt, boolean isMod) {
        return createOrGet(projectId, guid, () -> emailOpt, () -> nameOpt, isMod);
    }

    @Override
    public UserModel createOrGet(String projectId, String guid, Supplier<Optional<String>> emailOptSupplier, Supplier<Optional<String>> nameOptSupplier, boolean isMod) {
        Optional<UserModel> userOpt = getUserByIdentifier(projectId, IdentifierType.GUID, guid);
        Optional<String> emailOpt = emailOptSupplier.get();
        if (!userOpt.isPresent() && emailOpt.isPresent()) {
            userOpt = getUserByIdentifier(projectId, IdentifierType.EMAIL, emailOpt.get());

            // A user already exists that was created a different way other than SSO, OAuth, ...
            // So let's associate that user with this GUID
            if (userOpt.isPresent()) {
                try {
                    TransactWriteItemsResult transactWriteItemsResult = dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(
                            new TransactWriteItem().withPut(new Put()
                                    .withTableName(identifierToUserIdSchema.tableName())
                                    .withItem(identifierToUserIdSchema.toAttrMap(new IdentifierUser(
                                            IdentifierType.GUID.getType(),
                                            IdentifierType.GUID.isHashed() ? hashIdentifier(guid) : guid,
                                            projectId,
                                            userOpt.get().getUserId())))
                                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                                    .withExpressionAttributeNames(Map.of(
                                            "#partitionKey", identifierToUserIdSchema.partitionKeyName()))),
                            new TransactWriteItem().withUpdate(new Update()
                                    .withTableName(userSchema.tableName())
                                    .withKey(ItemUtils.toAttributeValueMap(userSchema.primaryKey(Map.of(
                                            "userId", userOpt.get().getUserId(),
                                            "projectId", projectId))))
                                    .withUpdateExpression("SET #ssoGuid = :ssoGuid")
                                    .withConditionExpression("attribute_exists(#partitionKey)")
                                    .withExpressionAttributeNames(Map.of(
                                            "#partitionKey", userSchema.partitionKeyName(),
                                            "#ssoGuid", "ssoGuid"))
                                    .withExpressionAttributeValues(Map.of(
                                            ":ssoGuid", userSchema.toAttrValue("ssoGuid", guid))))));
                } catch (TransactionCanceledException ex) {
                    if (ex.getCancellationReasons().stream().map(CancellationReason::getCode).anyMatch("ConditionalCheckFailed"::equals)) {
                        throw new ApiException(Response.Status.CONFLICT, "User with your email already exists", ex);
                    }
                    throw ex;
                }
            }
        }
        if (!userOpt.isPresent()) {
            Optional<String> nameOpt = nameOptSupplier.get();
            userOpt = Optional.of(createUser(new UserModel(
                    projectId,
                    genUserId(nameOpt),
                    guid,
                    isMod ? Boolean.TRUE : null,
                    nameOpt.orElse(null),
                    emailOpt.orElse(null),
                    null,
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
                    null,
                    null,
                    null,
                    ImmutableSet.of()))
                    .getUser());
        }
        return userOpt.get();
    }

    @Override
    public UserModel accountCreateOrGet(String projectId, AccountStore.Account account) {
        return createOrGet(projectId, account.getAccountId(), Optional.of(account.getEmail()), Optional.of(account.getName()), true);
    }

    @Extern
    @Override
    public UserSession createSession(UserModel user, long ttlInEpochSec) {
        UserSession userSession = new UserSession(
                genUserSessionId(),
                user.getProjectId(),
                user.getUserId(),
                ttlInEpochSec,
                user.getIsMod());
        sessionByIdSchema.table().putItem(new PutItemSpec()
                .withItem(sessionByIdSchema.toItem(userSession)));
        return userSession;
    }

    @Extern
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
    public void revokeSession(String sessionId) {
        sessionByIdSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(sessionByIdSchema.primaryKey(Map.of("sessionId", sessionId))));
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
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
    }

    /**
     * Update the isMod flag in all sessions for a user.
     * This is more user-friendly than revoking sessions when mod status changes.
     */
    private void updateSessionsModStatus(String projectId, String userId, Boolean isMod) {
        StreamSupport.stream(sessionByUserSchema.index().query(new QuerySpec()
                                .withHashKey(sessionByUserSchema.partitionKey(Map.of(
                                        "userId", userId)))
                                .withRangeKeyCondition(new RangeKeyCondition(sessionByUserSchema.rangeKeyName())
                                        .beginsWith(sessionByUserSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(sessionByUserSchema::fromItem)
                .filter(session -> projectId.equals(session.getProjectId()))
                .forEach(session -> {
                    UpdateItemSpec updateSpec = new UpdateItemSpec()
                            .withPrimaryKey(sessionByIdSchema.primaryKey(Map.of("sessionId", session.getSessionId())));
                    if (isMod == Boolean.TRUE) {
                        updateSpec.withUpdateExpression("SET #isMod = :isMod")
                                .withNameMap(new NameMap().with("#isMod", "isMod"))
                                .withValueMap(new ValueMap().withBoolean(":isMod", true));
                    } else {
                        updateSpec.withUpdateExpression("REMOVE #isMod")
                                .withNameMap(new NameMap().with("#isMod", "isMod"));
                    }
                    sessionByIdSchema.table().updateItem(updateSpec);
                });
    }

    @Extern
    @Override
    public ListenableFuture<Void> deleteAllForProject(String projectId) {
        // Delete users
        Iterables.partition(StreamSupport.stream(userByProjectIdSchema.index().query(new QuerySpec()
                                        .withHashKey(userByProjectIdSchema.partitionKey(Map.of(
                                                "projectId", projectId)))
                                        .withRangeKeyCondition(new RangeKeyCondition(userByProjectIdSchema.rangeKeyName())
                                                .beginsWith(userByProjectIdSchema.rangeValuePartial(Map.of()))))
                                .pages()
                                .spliterator(), false)
                        .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                        .map(userByProjectIdSchema::fromItem)
                        .filter(user -> projectId.equals(user.getProjectId()))
                        .map(UserModel::getUserId)
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(userIdsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(userSchema.tableName());
                    userIdsBatch.stream()
                            .map(userId -> userSchema.primaryKey(Map.of(
                                    "userId", userId,
                                    "projectId", projectId)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete user identifiers
        Iterables.partition(StreamSupport.stream(identifierByProjectIdSchema.index().query(new QuerySpec()
                                        .withHashKey(identifierByProjectIdSchema.partitionKey(Map.of(
                                                "projectId", projectId)))
                                        .withRangeKeyCondition(new RangeKeyCondition(identifierByProjectIdSchema.rangeKeyName())
                                                .beginsWith(identifierByProjectIdSchema.rangeValuePartial(Map.of()))))
                                .pages()
                                .spliterator(), false)
                        .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                        .map(identifierByProjectIdSchema::fromItem)
                        .filter(identifier -> projectId.equals(identifier.getProjectId()))
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(identifiersBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(identifierToUserIdSchema.tableName());
                    identifiersBatch.stream()
                            .map(identifier -> identifierToUserIdSchema.primaryKey(Map.of(
                                    "identifierHash", identifier.getIdentifierHash(),
                                    "type", identifier.getType(),
                                    "projectId", projectId)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete user counter
        Iterables.partition(StreamSupport.stream(userCounterSchema.table().query(new QuerySpec()
                                        .withHashKey(userCounterSchema.partitionKey(Map.of(
                                                "projectId", projectId)))
                                        .withRangeKeyCondition(new RangeKeyCondition(userCounterSchema.rangeKeyName())
                                                .beginsWith(userCounterSchema.rangeValuePartial(Map.of()))))
                                .pages()
                                .spliterator(), false)
                        .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                        .map(userCounterSchema::fromItem)
                        .map(userCounterSchema::primaryKey)
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(userCounterShardPrimaryKeys -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(userSchema.tableName());
                    userCounterShardPrimaryKeys.forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete user index
        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.get().indices().deleteAsync(new DeleteIndexRequest(elasticUtil.getIndexName(USER_INDEX, projectId)),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().deleteFrom(JooqUser.USER)
                    .where(JooqUser.USER.PROJECTID.eq(projectId))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        // Note: not deleting sessions, they will expire themselves eventually

        return indexingFuture;
    }

    private void indexUser(String projectId, String userId) {
        indexUser(SettableFuture.create(), projectId, userId);
    }

    private void indexUser(SettableFuture<Void> indexingFuture, String projectId, String userId) {
        Optional<UserModel> userOpt = getUser(projectId, userId);
        if (!userOpt.isPresent()) {
            SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
            if (searchEngine.isWriteElastic()) {
                elastic.get().deleteAsync(new DeleteRequest(elasticUtil.getIndexName(USER_INDEX, projectId), userId),
                        RequestOptions.DEFAULT,
                        searchEngine.isReadElastic()
                                ? ActionListeners.fromFuture(indexingFuture)
                                : ActionListeners.logFailure());
            }
            if (searchEngine.isWriteMysql()) {
                CompletionStage<Integer> completionStage = mysql.get().deleteFrom(JooqUser.USER)
                        .where(JooqUser.USER.PROJECTID.eq(projectId)
                                .and(JooqUser.USER.USERID.eq(userId)))
                        .executeAsync();
                if (searchEngine.isReadMysql()) {
                    CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
                } else {
                    CompletionStageUtil.logFailure(completionStage);
                }
            }
        } else {
            indexUser(indexingFuture, userOpt.get());
        }
    }

    private void indexUser(UserModel user) {
        indexUser(SettableFuture.create(), user);
    }

    private void indexUser(SettableFuture<Void> indexingFuture, UserModel user) {
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(user.getProjectId());
        if (searchEngine.isWriteElastic()) {
            elastic.get().indexAsync(userToEsIndexRequest(user),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic()
                            ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = userToMysqlQuery(user).executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }
    }

    private Query userToMysqlQuery(UserModel user) {
        JooqUserRecord record = JooqUser.USER.newRecord().values(
                user.getProjectId(),
                user.getUserId(),
                user.getName(),
                user.getEmail(),
                user.getCreated(),
                user.getBalance(),
                user.getIsMod());
        return mysql.get().insertInto(JooqUser.USER, JooqUser.USER.fields())
                .values(record)
                .onDuplicateKeyUpdate()
                .set(record);
    }

    private IndexRequest userToEsIndexRequest(UserModel user) {
        return new IndexRequest(elasticUtil.getIndexName(USER_INDEX, user.getProjectId()))
                .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                .id(user.getUserId())
                .source(gson.toJson(ImmutableMap.of(
                        "name", orNull(user.getName()),
                        "email", orNull(user.getEmail()),
                        "created", orNull(user.getCreated().getEpochSecond()),
                        "balance", orNull(user.getBalance()),
                        "isMod", user.getIsMod() == Boolean.TRUE
                )), XContentType.JSON);
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
            identifiersBuilder.put(IdentifierType.GUID, user.getSsoGuid());
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
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoElasticUserStore.class).asEagerSingleton();
            }
        };
    }
}
