// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.*;
import com.amazonaws.services.dynamodbv2.document.spec.*;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.base.Strings;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.*;
import com.google.common.collect.Sets.SetView;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;
import com.google.gson.Gson;
import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.TransactionAndFundPrevious;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.ElasticScript;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.elastic.ElasticUtil.ConfigSearch;
import com.smotana.clearflask.store.mysql.*;
import com.smotana.clearflask.store.mysql.MysqlUtil.Join;
import com.smotana.clearflask.store.mysql.model.JooqRoutines;
import com.smotana.clearflask.store.mysql.model.tables.JooqIdea;
import com.smotana.clearflask.store.mysql.model.tables.JooqIdeaFunders;
import com.smotana.clearflask.store.mysql.model.tables.JooqIdeaTags;
import com.smotana.clearflask.store.mysql.model.tables.JooqUser;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqIdeaRecord;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqIdeaTagsRecord;
import com.smotana.clearflask.util.*;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.Expression;
import io.dataspray.singletable.*;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
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
import org.elasticsearch.client.core.CountRequest;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.GetIndexRequest;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.*;
import org.elasticsearch.index.query.MoreLikeThisQueryBuilder.Item;
import org.elasticsearch.index.query.functionscore.FunctionScoreQueryBuilder;
import org.elasticsearch.index.query.functionscore.RandomScoreFunctionBuilder;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.aggregations.bucket.terms.Terms;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.jooq.*;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.jooq.util.mysql.MySQLDataType;
import rx.Observable;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletionStage;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static com.google.common.base.Preconditions.checkArgument;
import static com.google.common.base.Preconditions.checkState;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.mysql.DefaultMysqlProvider.ID_MAX_LENGTH;
import static com.smotana.clearflask.util.ExplicitNull.orNull;
import static org.jooq.SortOrder.ASC;
import static org.jooq.SortOrder.DESC;

@Slf4j
@Singleton
public class DynamoElasticIdeaStore extends ManagedService implements IdeaStore {

    public interface Config {
        /**
         * Intended for tests. Force immediate index refresh after write request.
         */
        @DefaultValue("false")
        boolean elasticForceRefresh();

        @DefaultValue("true")
        boolean enableSimilarToIdea();

        @DefaultValue("true")
        boolean enableHistograms();

        @DefaultValue("true")
        boolean enableSearchCache();

        @DefaultValue("PT5M")
        Duration searchCacheExpireAfterWritePeriod();

        Observable<Duration> searchCacheExpireAfterWritePeriodObservable();

        @DefaultValue("PT1M")
        Duration searchCacheExpireAfterAccessPeriod();

        Observable<Duration> searchCacheExpireAfterAccessPeriodObservable();
    }

    public static final String IDEA_INDEX = "idea";
    public static final String IDEA_TAGS_INDEX = "idea_tags";
    public static final String IDEA_FUNDERS_INDEX = "idea_funders";
    private static final long EXP_DECAY_PERIOD_MILLIS = Duration.ofDays(7).toMillis();
    private static final Pattern EXTRACT_GITHUB_ISSUE_FROM_IDEA_ID_MATCHER = Pattern.compile("github-(?<issueNumber>[0-9]+)-(?<issueId>[0-9]+)-(?<repositoryId>[0-9]+)");

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    @Named("idea")
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
    private VoteStore voteStore;
    @Inject
    private UserStore userStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private Sanitizer sanitizer;
    @Inject
    private Provider<DSLContext> mysql;
    @Inject
    private MysqlUtil mysqlUtil;

    private TableSchema<IdeaModel> ideaSchema;
    private IndexSchema<IdeaModel> ideaByProjectIdSchema;
    private ExpDecayScore expDecayScoreWeek;
    private Cache<IdeaSearchKey, SearchResponse> ideaSearchCache;

    @Inject
    private void setup() {
        ideaSchema = singleTable.parseTableSchema(IdeaModel.class);
        ideaByProjectIdSchema = singleTable.parseGlobalSecondaryIndexSchema(2, IdeaModel.class);

        expDecayScoreWeek = new ExpDecayScore(EXP_DECAY_PERIOD_MILLIS);

        Stream.of(config.searchCacheExpireAfterAccessPeriodObservable(),
                        config.searchCacheExpireAfterWritePeriodObservable())
                .forEach(o -> o.subscribe(v -> setupIdeaSearchCache()));
        setupIdeaSearchCache();
    }

    private void setupIdeaSearchCache() {
        ideaSearchCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.searchCacheExpireAfterWritePeriod())
                .expireAfterAccess(config.searchCacheExpireAfterAccessPeriod())
                .weakValues()
                .build();
    }

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(DefaultMysqlProvider.class, DynamoElasticUserStore.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        if (configApp.createIndexesOnStartup() && configApp.defaultSearchEngine().isWriteMysql()) {
            createIndexMysql();
        }
    }

    @Extern
    @Override
    public Optional<GitHubIssueMetadata> extractGitHubIssueFromIdeaId(String ideaId) {
        Matcher matcher = EXTRACT_GITHUB_ISSUE_FROM_IDEA_ID_MATCHER.matcher(ideaId);
        if (!matcher.matches()) {
            return Optional.empty();
        }
        return Optional.of(new GitHubIssueMetadata(
                Long.parseLong(matcher.group("issueNumber")),
                Long.parseLong(matcher.group("issueId")),
                Long.parseLong(matcher.group("repositoryId"))));
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

    public void createIndexMysql() {
        log.info("Creating Mysql table {}", IDEA_INDEX);
        //noinspection removal
        mysql.get().createTableIfNotExists(IDEA_INDEX)
                .column("projectId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("postId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("authorUserId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("authorName", SQLDataType.VARCHAR(255))
                .column("authorIsMod", SQLDataType.BOOLEAN)
                .column("created", MoreSQLDataType.DATETIME(6).notNull())
                .column("lastActivity", MoreSQLDataType.DATETIME_AUTO_UPDATE(6).notNull())
                .column("title", MySQLDataType.TEXT.notNull())
                .column("description", MySQLDataType.MEDIUMTEXT)
                .column("response", MySQLDataType.MEDIUMTEXT)
                .column("responseAuthorUserId", SQLDataType.VARCHAR(255))
                .column("responseAuthorName", SQLDataType.VARCHAR(255))
                .column("categoryId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("statusId", SQLDataType.VARCHAR(ID_MAX_LENGTH))
                .column("commentCount", SQLDataType.BIGINT)
                .column("childCommentCount", SQLDataType.BIGINT)
                .column("funded", SQLDataType.BIGINT)
                .column("fundGoal", SQLDataType.BIGINT)
                .column("fundersCount", SQLDataType.BIGINT)
                .column("voteValue", SQLDataType.BIGINT)
                .column("votersCount", SQLDataType.BIGINT)
                .column("expressionsValue", SQLDataType.DOUBLE)
                .column("trendScore", SQLDataType.DOUBLE)
                .column("mergedToPostId", SQLDataType.VARCHAR(ID_MAX_LENGTH))
                .column("order", SQLDataType.DOUBLE)
                .primaryKey("projectId", "postId")
                .execute();
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.PROJECTID));
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.AUTHORUSERID));
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.CATEGORYID));
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.STATUSID));
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.CREATED));
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.LASTACTIVITY));
        mysqlUtil.createIndexIfNotExists(mysql.get().createIndex().on(JooqIdea.IDEA, JooqIdea.IDEA.MERGEDTOPOSTID));
        mysql.get().createTableIfNotExists(IDEA_TAGS_INDEX)
                .column("projectId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("postId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("tagId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .primaryKey("projectId", "postId", "tagId")
                .constraints(DSL.foreignKey(JooqIdeaTags.IDEA_TAGS.PROJECTID, JooqIdeaTags.IDEA_TAGS.POSTID)
                        .references(JooqIdea.IDEA, JooqIdea.IDEA.PROJECTID, JooqIdea.IDEA.POSTID)
                        .onDeleteCascade())
                .execute();
        mysql.get().createTableIfNotExists(IDEA_FUNDERS_INDEX)
                .column("projectId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("postId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("funderUserId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .primaryKey("projectId", "postId", "funderUserId")
                .constraint(DSL.foreignKey(JooqIdeaFunders.IDEA_FUNDERS.PROJECTID, JooqIdeaFunders.IDEA_FUNDERS.POSTID)
                        .references(JooqIdea.IDEA, JooqIdea.IDEA.PROJECTID, JooqIdea.IDEA.POSTID)
                        .onDeleteCascade())
                .constraint(DSL.foreignKey(JooqIdeaFunders.IDEA_FUNDERS.PROJECTID, JooqIdeaFunders.IDEA_FUNDERS.FUNDERUSERID)
                        .references(JooqUser.USER, JooqUser.USER.PROJECTID, JooqUser.USER.USERID)
                        .onDeleteCascade())
                .execute();
        mysqlUtil.createFunctionIfNotExists(MysqlCustomFunction.EXP_DECAY);
    }

    @Extern
    public ListenableFuture<Void> createIndexElasticSearch(String projectId) {
        SettableFuture<Void> indexingFuture = SettableFuture.create();
        elastic.get().indices().createAsync(new CreateIndexRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)).mapping(gson.toJson(ImmutableMap.of(
                        "dynamic", "false",
                        "properties", ImmutableMap.builder()
                                .put("authorUserId", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("authorName", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("authorIsMod", ImmutableMap.of(
                                        "type", "boolean"))
                                .put("created", ImmutableMap.of(
                                        "type", "date",
                                        "format", "epoch_second"))
                                .put("lastActivity", ImmutableMap.of(
                                        "type", "date",
                                        "format", "epoch_second"))
                                .put("title", ImmutableMap.of(
                                        "type", "text",
                                        "index_prefixes", ImmutableMap.of()))
                                .put("description", ImmutableMap.of(
                                        "type", "text",
                                        "index_prefixes", ImmutableMap.of()))
                                .put("response", ImmutableMap.of(
                                        "type", "text",
                                        "index_prefixes", ImmutableMap.of()))
                                .put("responseAuthorUserId", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("responseAuthorName", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("categoryId", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("statusId", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("tagIds", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("commentCount", ImmutableMap.of(
                                        "type", "long"))
                                .put("childCommentCount", ImmutableMap.of(
                                        "type", "long"))
                                .put("funded", ImmutableMap.of(
                                        "type", "double"))
                                .put("fundGoal", ImmutableMap.of(
                                        "type", "double"))
                                .put("fundersCount", ImmutableMap.of(
                                        "type", "long"))
                                .put("funderUserIds", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("voteValue", ImmutableMap.of(
                                        "type", "long"))
                                .put("votersCount", ImmutableMap.of(
                                        "type", "long"))
                                .put("expressionsValue", ImmutableMap.of(
                                        "type", "double"))
                                .put("expressions", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("trendScore", ImmutableMap.of(
                                        "type", "double"))
                                .put("mergedToPostId", ImmutableMap.of(
                                        "type", "keyword"))
                                .put("order", ImmutableMap.of(
                                        "type", "double"))
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
                    new GetIndexRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)),
                    RequestOptions.DEFAULT);
            if (indexAlreadyExists && deleteExistingIndex) {
                elastic.get().indices().delete(
                        new DeleteIndexRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)),
                        RequestOptions.DEFAULT);
            }
            if (!indexAlreadyExists || deleteExistingIndex) {
                createIndex(projectId).get();
            }
        }
        if (repopulateMysql && deleteExistingIndex) {
            mysql.get().deleteFrom(JooqIdea.IDEA)
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId))
                    .execute();
        }

        StreamSupport.stream(ideaByProjectIdSchema.index().query(new QuerySpec()
                                .withHashKey(ideaByProjectIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(ideaByProjectIdSchema.rangeKeyName())
                                        .beginsWith(ideaByProjectIdSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(ideaByProjectIdSchema::fromItem)
                .filter(idea -> projectId.equals(idea.getProjectId()))
                .forEach(idea -> {
                    if (repopulateElasticSearch) {
                        try {
                            elastic.get().index(ideaToEsIndexRequest(idea, false), RequestOptions.DEFAULT);
                        } catch (IOException ex) {
                            if (LogUtil.rateLimitAllowLog("dynamoelsaticideastore-reindex-failure")) {
                                log.warn("Failed to re-index idea {}", idea.getIdeaId(), ex);
                            }
                        }
                    }
                    if (repopulateMysql) {
                        ideaToMysqlRecords(idea).fetchMany();
                    }
                });
    }

    @Override
    public IdeaAndIndexingFuture createIdeaAndUpvote(IdeaModel idea) {
        voteStore.vote(idea.getProjectId(), idea.getAuthorUserId(), idea.getIdeaId(), VoteValue.Upvote);

        IdeaModel ideaUpvoted = idea.toBuilder()
                .voteValue(idea.getVoteValue() == null ? 1 : idea.getVoteValue() + 1)
                .votersCount(idea.getVotersCount() == null ? 1 : idea.getVotersCount() + 1)
                .trendScore(expDecayScoreWeek.updateScore(
                        idea.getTrendScore() == null ? 0 : idea.getTrendScore(),
                        System.currentTimeMillis()))
                .build();

        // No need to update bloom filter, it is assumed own ideas are always upvoted

        ListenableFuture<Void> indexingFuture = this.createIdea(ideaUpvoted);

        return new IdeaAndIndexingFuture(ideaUpvoted, indexingFuture);
    }

    @Override
    public ListenableFuture<Void> createIdea(IdeaModel idea) {
        try {
            ideaSchema.table().putItem(new PutItemSpec()
                    .withItem(ideaSchema.toItem(idea))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(Map.of("#partitionKey", ideaSchema.partitionKeyName())));
        } catch (ConditionalCheckFailedException ex) {
            throw new ApiException(Response.Status.CONFLICT, "Similar title already exists, please choose another.", ex);
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        indexIdea(indexingFuture, idea);

        return indexingFuture;
    }

    private Queries ideaToMysqlRecords(IdeaModel idea) {
        JooqIdeaRecord ideaRecord = JooqIdea.IDEA.newRecord();
        ideaRecord.setProjectid(idea.getProjectId());
        ideaRecord.setPostid(idea.getIdeaId());
        ideaRecord.setAuthoruserid(idea.getAuthorUserId());
        ideaRecord.setAuthorname(idea.getAuthorName());
        ideaRecord.setAuthorismod(idea.getAuthorIsMod());
        ideaRecord.setCreated(idea.getCreated());
        ideaRecord.setLastactivity(idea.getCreated());
        ideaRecord.setTitle(idea.getTitle());
        ideaRecord.setDescription(idea.getDescriptionAsText(sanitizer));
        ideaRecord.setResponse(idea.getResponseAsText(sanitizer));
        ideaRecord.setResponseauthoruserid(idea.getResponseAuthorUserId());
        ideaRecord.setResponseauthorname(idea.getResponseAuthorName());
        ideaRecord.setCategoryid(idea.getCategoryId());
        ideaRecord.setStatusid(idea.getStatusId());
        ideaRecord.setCommentcount(idea.getCommentCount());
        ideaRecord.setChildcommentcount(idea.getChildCommentCount());
        ideaRecord.setFunded(idea.getFunded());
        ideaRecord.setVotevalue(idea.getVoteValue());
        ideaRecord.setVoterscount(idea.getVotersCount());
        ideaRecord.setExpressionsvalue(idea.getExpressionsValue());
        ideaRecord.setTrendscore(idea.getTrendScore());
        ideaRecord.setMergedtopostid(idea.getMergedToPostId());
        ideaRecord.setOrder(idea.getOrder());

        Stream<JooqIdeaTagsRecord> tagRecords = idea.getTagIds().stream().map(tagId -> JooqIdeaTags.IDEA_TAGS.newRecord().values(
                idea.getProjectId(),
                idea.getIdeaId(),
                tagId));

        return mysql.get().queries(Stream.concat(Stream.of(mysql.get().insertInto(JooqIdea.IDEA, JooqIdea.IDEA.fields())
                                .values(ideaRecord)
                                .onDuplicateKeyUpdate()
                                .set(ideaRecord)),
                        tagRecords.map(tagRecord -> mysql.get().insertInto(JooqIdeaTags.IDEA_TAGS, JooqIdeaTags.IDEA_TAGS.fields())
                                .values(tagRecord)
                                .onDuplicateKeyUpdate()
                                .set(tagRecord)))
                .collect(Collectors.toList())
        );
    }

    private IndexRequest ideaToEsIndexRequest(IdeaModel idea, boolean setRefreshPolicy) {
        IndexRequest req = new IndexRequest(elasticUtil.getIndexName(IDEA_INDEX, idea.getProjectId()))
                .id(idea.getIdeaId())
                .source(gson.toJson(ImmutableMap.builder()
                        .put("authorUserId", idea.getAuthorUserId())
                        .put("authorName", orNull(idea.getAuthorName()))
                        .put("authorIsMod", orNull(idea.getAuthorIsMod()))
                        .put("created", idea.getCreated().getEpochSecond())
                        .put("lastActivity", idea.getCreated().getEpochSecond())
                        .put("title", idea.getTitle())
                        .put("description", orNull(idea.getDescriptionAsText(sanitizer)))
                        .put("response", orNull(idea.getResponseAsText(sanitizer)))
                        .put("responseAuthorUserId", orNull(idea.getResponseAuthorUserId()))
                        .put("responseAuthorName", orNull(idea.getResponseAuthorName()))
                        .put("categoryId", idea.getCategoryId())
                        .put("statusId", orNull(idea.getStatusId()))
                        .put("tagIds", idea.getTagIds())
                        .put("commentCount", idea.getCommentCount())
                        .put("childCommentCount", idea.getCommentCount())
                        .put("funded", orNull(idea.getFunded()))
                        .put("fundGoal", orNull(idea.getFundGoal()))
                        .put("fundersCount", orNull(idea.getFundersCount()))
                        .put("voteValue", orNull(idea.getVoteValue()))
                        .put("votersCount", orNull(idea.getVotersCount()))
                        .put("expressionsValue", orNull(idea.getExpressionsValue()))
                        .put("expressions", idea.getExpressions() == null ? ExplicitNull.get() : idea.getExpressions().keySet())
                        .put("trendScore", orNull(idea.getTrendScore()))
                        .put("mergedToPostId", orNull(idea.getMergedToPostId()))
                        // In dynamo this is empty unless explicitly set.
                        // In ES it is always populated for sorting as it is
                        // not easy to fallback to a value of created unless
                        // script sorting is used.
                        .put("order", idea.getOrderOrDefault())
                        .build()), XContentType.JSON);
        if (setRefreshPolicy) {
            req.setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL);
        }
        return req;
    }

    @Override
    public ListenableFuture<List<Void>> createIdeas(String projectId, Iterable<IdeaModel> ideas) {
        ArrayList<ListenableFuture<Void>> indexingFutures = Lists.newArrayList();
        Iterables.partition(ideas, DYNAMO_WRITE_BATCH_MAX_SIZE).forEach(ideasBatch -> {
            checkState(ideasBatch.stream().map(IdeaModel::getProjectId).allMatch(projectId::equals));
            singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(ideaSchema.tableName())
                    .withItemsToPut(ideasBatch.stream()
                            .map(ideaSchema::toItem)
                            .collect(ImmutableList.toImmutableList()))));

            SettableFuture<Void> indexingFuture = SettableFuture.create();
            SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
            if (searchEngine.isWriteElastic()) {
                elastic.get().bulkAsync(new BulkRequest()
                                .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                                .add(ideasBatch.stream()
                                        .map(idea -> ideaToEsIndexRequest(idea, false))
                                        .collect(ImmutableList.toImmutableList())),
                        RequestOptions.DEFAULT,
                        searchEngine.isReadElastic() ? ActionListeners.fromFuture(indexingFuture)
                                : ActionListeners.logFailure());
            }
            if (searchEngine.isWriteMysql()) {
                List<CompletionStage<?>> completionStages = ideasBatch.stream()
                        .map(this::ideaToMysqlRecords)
                        .map(mysqlUtil::sequentialBatch)
                        .collect(Collectors.toList());
                if (searchEngine.isReadMysql()) {
                    CompletionStageUtil.toSettableFuture(indexingFuture, completionStages);
                } else {
                    CompletionStageUtil.logFailure(completionStages);
                }
            }
            indexingFutures.add(indexingFuture);
        });
        return Futures.allAsList(indexingFutures);
    }

    @Extern
    @Override
    public Optional<IdeaModel> getIdea(String projectId, String ideaId) {
        return Optional.ofNullable(ideaSchema.fromItem(ideaSchema.table().getItem(new GetItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId))))))
                .map(this::upgradeExpressionsProperty);
    }

    @Override
    public ImmutableMap<String, IdeaModel> getIdeas(String projectId, ImmutableCollection<String> ideaIds) {
        if (ideaIds.isEmpty()) {
            return ImmutableMap.of();
        }
        return singleTable.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(ideaSchema.tableName()).withPrimaryKeys(ideaIds.stream()
                        .distinct()
                        .map(ideaId -> ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .toArray(PrimaryKey[]::new))))
                .map(ideaSchema::fromItem)
                .map(this::upgradeExpressionsProperty)
                .collect(ImmutableMap.toImmutableMap(
                        IdeaModel::getIdeaId,
                        i -> i));
    }

    @Override
    public LinkResponse linkIdeas(String projectId, String ideaId, String parentIdeaId, boolean undo, BiFunction<String, String, Double> categoryExpressionToWeightMapper) {
        ConnectResponse connectResponse = connectIdeas(projectId, ideaId, parentIdeaId, false, undo, categoryExpressionToWeightMapper);
        return new LinkResponse(connectResponse.idea, connectResponse.parentIdea);
    }

    @Override
    public MergeResponse mergeIdeas(String projectId, String ideaId, String parentIdeaId, boolean undo, BiFunction<String, String, Double> categoryExpressionToWeightMapper) {
        ConnectResponse connectResponse = connectIdeas(projectId, ideaId, parentIdeaId, true, undo, categoryExpressionToWeightMapper);

        // TODO Fix this: I believe this needs to update more than just mergedToPostId field: votes, expressions, funding, trend score...
        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            ImmutableMap.Builder<Object, Object> updates = ImmutableMap.builder();
            updates.put("mergedToPostId", orNull(connectResponse.getIdea().getMergedToPostId()));
            elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), ideaId)
                            .doc(gson.toJson(updates.build()), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, connectResponse.getIdea()))
                            : ActionListeners.onFailureRetry(() -> indexIdea(connectResponse.getIdea())));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqIdea.IDEA)
                    .set(JooqIdea.IDEA.MERGEDTOPOSTID, connectResponse.getIdea().getMergedToPostId())
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                            .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new MergeResponse(connectResponse.idea, connectResponse.parentIdea, indexingFuture);
    }

    private ConnectResponse connectIdeas(String projectId, String ideaId, String parentIdeaId, boolean merge, boolean undo, BiFunction<String, String, Double> categoryExpressionToWeightMapper) {
        if (ideaId.equals(parentIdeaId)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Cannot connect to itself");
        }
        ImmutableMap<String, IdeaModel> ideas = getIdeas(projectId, ImmutableSet.of(ideaId, parentIdeaId));
        IdeaModel idea = ideas.get(ideaId);
        IdeaModel parentIdea = ideas.get(parentIdeaId);
        if (idea == null || parentIdea == null) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Does not exist");
        }

        // 1. Move over votes and expressions
        long parentIdeaVoteDiff = 0L;
        long parentIdeaVotersDiff = 0L;
        double parentIdeaExpressionValueDiff = 0d;
        Map<String, Long> parentIdeaExpressionDiff = Maps.newHashMap();
        long parentIdeaFundDiff = 0L;
        long parentIdeaFundersDiff = 0L;
        if (merge) {
            if (!undo) {
                Optional<String> voteCursorOpt = Optional.empty();
                do {
                    VoteStore.ListResponse<VoteStore.VoteModel> voteModelListResponse = voteStore.voteListByTarget(projectId, ideaId, voteCursorOpt);
                    voteCursorOpt = voteModelListResponse.getCursorOpt();
                    for (VoteStore.VoteModel vote : voteModelListResponse.getItems()) {
                        if (vote.getVote() == 0) {
                            continue;
                        }
                        VoteValue prevVote = voteStore.vote(projectId, vote.getUserId(), parentIdeaId, VoteValue.fromValue(vote.getVote()));
                        parentIdeaVoteDiff += vote.getVote() - prevVote.getValue();
                        if (prevVote.getValue() == 0) {
                            parentIdeaVotersDiff++;
                        }
                    }
                } while (voteCursorOpt.isPresent());

                Optional<String> expressionCursorOpt = Optional.empty();
                do {
                    VoteStore.ListResponse<VoteStore.ExpressModel> expressModelListResponse = voteStore.expressListByTarget(projectId, ideaId, expressionCursorOpt);
                    expressionCursorOpt = expressModelListResponse.getCursorOpt();
                    for (VoteStore.ExpressModel express : expressModelListResponse.getItems()) {
                        if (express.getExpressions().size() == 0) {
                            continue;
                        }
                        ImmutableSet<String> prevExpressions = voteStore.expressMultiAdd(projectId, express.getUserId(), parentIdeaId, express.getExpressions());
                        for (String expression : express.getExpressions()) {
                            if (prevExpressions.contains(expression)) {
                                continue;
                            }
                            parentIdeaExpressionDiff.compute(expression, (e, oldValue) -> oldValue == null
                                    ? 1L : (oldValue + 1L));
                            parentIdeaExpressionValueDiff += categoryExpressionToWeightMapper.apply(parentIdea.getCategoryId(), expression);
                        }
                    }
                } while (expressionCursorOpt.isPresent());

                Optional<String> fundCursorOpt = Optional.empty();
                do {
                    // Future optimization: Instead of reading all then deleting all and upsert into parent idea,
                    // Just skip the first reading and just delete all.
                    VoteStore.ListResponse<VoteStore.FundModel> fundModelListResponse = voteStore.fundListByTarget(projectId, ideaId, fundCursorOpt);
                    fundCursorOpt = fundModelListResponse.getCursorOpt();
                    for (VoteStore.FundModel fund : fundModelListResponse.getItems()) {
                        if (fund.getFundAmount() == 0L) {
                            continue;
                        }
                        long fundAmountTransferred = voteStore.fundTransferBetweenTargets(projectId, fund.getUserId(), ideaId, parentIdeaId);
                        parentIdeaFundersDiff += 1;
                        parentIdeaFundDiff += fundAmountTransferred;
                    }
                } while (fundCursorOpt.isPresent());
            } else {
                // Since we (intentionally for simplification) lost information whether
                // user has voted for parent idea prior to merge,
                // we assume they did not and we will remove vote from parent.
                Optional<String> voteCursorOpt = Optional.empty();
                do {
                    VoteStore.ListResponse<VoteStore.VoteModel> voteModelListResponse = voteStore.voteListByTarget(projectId, ideaId, voteCursorOpt);
                    voteCursorOpt = voteModelListResponse.getCursorOpt();
                    for (VoteStore.VoteModel vote : voteModelListResponse.getItems()) {
                        if (vote.getVote() == 0) {
                            continue;
                        }
                        VoteValue prevVote = voteStore.vote(projectId, vote.getUserId(), parentIdeaId, VoteValue.None);
                        parentIdeaVoteDiff -= prevVote.getValue();
                        if (prevVote.getValue() != 0) {
                            parentIdeaVotersDiff--;
                        }
                    }
                } while (voteCursorOpt.isPresent());

                // Same as votes, we are also removing expressions from parent as described above.
                Optional<String> expressionCursorOpt = Optional.empty();
                do {
                    VoteStore.ListResponse<VoteStore.ExpressModel> expressModelListResponse = voteStore.expressListByTarget(projectId, ideaId, expressionCursorOpt);
                    expressionCursorOpt = expressModelListResponse.getCursorOpt();
                    for (VoteStore.ExpressModel express : expressModelListResponse.getItems()) {
                        if (express.getExpressions().size() == 0) {
                            continue;
                        }
                        ImmutableSet<String> prevExpressions = voteStore.expressMultiRemove(projectId, express.getUserId(), parentIdeaId, express.getExpressions());
                        for (String expression : express.getExpressions()) {
                            if (!prevExpressions.contains(expression)) {
                                continue;
                            }
                            parentIdeaExpressionDiff.compute(expression, (e, oldValue) -> oldValue == null
                                    ? -1L : (oldValue - 1L));
                            parentIdeaExpressionValueDiff -= categoryExpressionToWeightMapper.apply(parentIdea.getCategoryId(), expression);
                        }
                    }
                } while (expressionCursorOpt.isPresent());

                if (idea.getExpressionsValue() != null) {
                    // For simplicity, since we don't know expression value mappings here, just copy it blindly here
                    parentIdeaExpressionValueDiff -= idea.getExpressionsValue();
                }

                // Funding merge-back omitted, cannot merge back for now for simplicity
            }
        }

        // 2. Update link/merge between projects AND add vote diff and expressions diff
        ExpressionBuilder ideaExpressionBuilder = ideaSchema.expressionBuilder()
                .conditionExists();
        ExpressionBuilder parentIdeaExpressionBuilder = ideaSchema.expressionBuilder()
                .conditionExists();

        if (parentIdeaVoteDiff != 0L) {
            parentIdeaExpressionBuilder.setIncrement("voteValue", parentIdeaVoteDiff);
        }
        if (parentIdeaVotersDiff != 0L) {
            parentIdeaExpressionBuilder.setIncrement("votersCount", parentIdeaVotersDiff);
        }
        if (parentIdeaExpressionValueDiff != 0d) {
            parentIdeaExpressionBuilder.setIncrement("expressionsValue", parentIdeaExpressionValueDiff);
        }
        long expressionCounter = 0L;
        if (parentIdeaExpressionDiff.size() > 0) {
            String expressionsValueField = parentIdeaExpressionBuilder.fieldMapping("expressionsValue");
            String zeroValue = parentIdeaExpressionBuilder.constantMapping("zero", 0L);
            String oneValue = parentIdeaExpressionBuilder.constantMapping("one", 1L);

            for (Map.Entry<String, Long> entry : parentIdeaExpressionDiff.entrySet()) {
                String expression = entry.getKey();
                Long value = entry.getValue();
                if (value == null || value == 0L) {
                    continue;
                }
                String valueSign = value > 0 ? "+" : "-";
                String valueValue = parentIdeaExpressionBuilder.constantMapping("val" + expressionCounter, Math.abs(value));
                String expressionField = parentIdeaExpressionBuilder.fieldMapping("expr" + expressionCounter, expression);
                parentIdeaExpressionBuilder.setExpression(String.format(
                        "expressions.%s = if_not_exists(expressions.%s, %s) + %s, expressionsValue = if_not_exists(%s, %s) %s %s",
                        expressionField, expressionField, zeroValue, oneValue, expressionsValueField, zeroValue, valueSign, valueValue));
            }
        }
        if (parentIdeaFundDiff != 0L) {
            parentIdeaExpressionBuilder.setIncrement("funded", parentIdeaFundDiff);
        }
        if (parentIdeaFundersDiff != 0L) {
            parentIdeaExpressionBuilder.setIncrement("fundersCount", parentIdeaFundersDiff);
        }

        if (merge) {
            if (!undo) {
                if (!Strings.isNullOrEmpty(idea.getMergedToPostId())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Cannot merge a post that's already merged");
                }
                ideaExpressionBuilder.conditionFieldNotExists("mergedToPostId");
                ideaExpressionBuilder.set("mergedToPostId", parentIdeaId);
                ideaExpressionBuilder.set("mergedToPostTime", Instant.now());

                if (!Strings.isNullOrEmpty(parentIdea.getMergedToPostId())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Cannot merge into a post that's already merged");
                }
                parentIdeaExpressionBuilder.conditionFieldNotExists("mergedToPostId");
                parentIdeaExpressionBuilder.add("mergedPostIds", ImmutableSet.of(idea.getIdeaId()));
            } else {
                if (!parentIdeaId.equals(idea.getMergedToPostId())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Cannot undo a merge that's not merged");
                }
                ideaExpressionBuilder.conditionFieldEquals("mergedToPostId", parentIdeaId);
                ideaExpressionBuilder.remove("mergedToPostId");
                ideaExpressionBuilder.remove("mergedToPostTime");

                if (!Strings.isNullOrEmpty(parentIdea.getMergedToPostId())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Cannot undo a merge from a post that's already merged");
                }
                parentIdeaExpressionBuilder.conditionFieldNotExists("mergedToPostId");
                parentIdeaExpressionBuilder.delete("mergedPostIds", ImmutableSet.of(idea.getIdeaId()));
            }
        } else {
            if (!Strings.isNullOrEmpty(idea.getMergedToPostId())) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot link a post that's already merged");
            }
            ideaExpressionBuilder.conditionFieldNotExists("mergedToPostId");
            if (!Strings.isNullOrEmpty(parentIdea.getMergedToPostId())) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot link to a post that's already merged");
            }
            parentIdeaExpressionBuilder.conditionFieldNotExists("mergedToPostId");
            if (!undo) {
                ideaExpressionBuilder.add("linkedToPostIds", ImmutableSet.of(parentIdeaId));
                parentIdeaExpressionBuilder.add("linkedFromPostIds", ImmutableSet.of(ideaId));
            } else {
                ideaExpressionBuilder.delete("linkedToPostIds", ImmutableSet.of(parentIdeaId));
                parentIdeaExpressionBuilder.delete("linkedFromPostIds", ImmutableSet.of(ideaId));
            }
        }

        Expression ideaExpression = ideaExpressionBuilder.build();
        log.trace("connect ideaExpression {}", ideaExpression);
        idea = ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .withUpdateExpression(ideaExpression.updateExpression().orElse(null))
                        .withConditionExpression(ideaExpression.conditionExpression().orElse(null))
                        .withNameMap(ideaExpression.nameMap().orElse(null))
                        .withValueMap(ideaExpression.valMap().orElse(null))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        Expression parentIdeaExpression = parentIdeaExpressionBuilder.build();
        log.trace("connect parentIdeaExpression {}", parentIdeaExpression);
        parentIdea = ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", parentIdeaId)))
                        .withUpdateExpression(parentIdeaExpression.updateExpression().orElse(null))
                        .withConditionExpression(parentIdeaExpression.conditionExpression().orElse(null))
                        .withNameMap(parentIdeaExpression.nameMap().orElse(null))
                        .withValueMap(parentIdeaExpression.valMap().orElse(null))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());

        return new ConnectResponse(idea, parentIdea);
    }

    @Value
    class ConnectResponse {
        IdeaModel idea;
        IdeaModel parentIdea;
    }

    @Override
    public HistogramResponse histogram(String projectId, IdeaHistogramSearchAdmin ideaHistogramSearchAdmin) {
        if (!config.enableHistograms()) {
            return new HistogramResponse(ImmutableList.of(), new Hits(0L, null));
        }

        IdeaSearchAdmin ideaSearchAdmin = new IdeaSearchAdmin(
                null,
                ideaHistogramSearchAdmin.getFilterCategoryIds(),
                null,
                ideaHistogramSearchAdmin.getFilterStatusIds(),
                null,
                ideaHistogramSearchAdmin.getFilterTagIds(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
        if (projectStore.getSearchEngineForProject(projectId).isReadElastic()) {
            return elasticUtil.histogram(
                    elasticUtil.getIndexName(IDEA_INDEX, projectId),
                    "created",
                    Optional.ofNullable(ideaHistogramSearchAdmin.getFilterCreatedStart()),
                    Optional.ofNullable(ideaHistogramSearchAdmin.getFilterCreatedEnd()),
                    Optional.ofNullable(ideaHistogramSearchAdmin.getInterval()),
                    Optional.of(searchIdeasQuery(ideaSearchAdmin, Optional.empty())));
        } else {
            return mysqlUtil.histogram(
                    JooqIdea.IDEA,
                    JooqIdea.IDEA.PROJECTID.eq(projectId),
                    JooqIdea.IDEA.CREATED,
                    Optional.ofNullable(ideaHistogramSearchAdmin.getFilterCreatedStart()),
                    Optional.ofNullable(ideaHistogramSearchAdmin.getFilterCreatedEnd()),
                    Optional.ofNullable(ideaHistogramSearchAdmin.getInterval()),
                    Optional.of(searchIdeasCondition(projectId, ideaSearchAdmin, Optional.empty())));
        }
    }

    @Override
    public SearchResponse searchIdeas(String projectId, IdeaSearch ideaSearch, Optional<String> requestorUserIdOpt, Optional<String> cursorOpt) {
        return searchIdeas(
                projectId,
                new IdeaSearchAdmin(
                        ideaSearch.getSortBy() == null ? null : IdeaSearchAdmin.SortByEnum.valueOf(ideaSearch.getSortBy().name()),
                        ideaSearch.getFilterCategoryIds(),
                        ideaSearch.getInvertCategory(),
                        ideaSearch.getFilterStatusIds(),
                        ideaSearch.getInvertStatus(),
                        ideaSearch.getFilterTagIds(),
                        ideaSearch.getInvertTag(),
                        ideaSearch.getFilterAuthorId(),
                        ideaSearch.getInvertAuthorId(),
                        ideaSearch.getSearchText(),
                        ideaSearch.getFundedByMeAndActive(),
                        ideaSearch.getLimit(),
                        ideaSearch.getSimilarToIdeaId(),
                        null,
                        null,
                        null,
                        null),
                requestorUserIdOpt,
                false,
                cursorOpt);
    }

    @Override
    public SearchResponse searchIdeas(String projectId, IdeaSearchAdmin ideaSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt) {
        return searchIdeas(projectId, ideaSearchAdmin, Optional.empty(), useAccurateCursor, cursorOpt);
    }

    @Value
    public static class SearchIdeasConditions {
        Condition conditions;
        Condition conditionsRange;
        ImmutableList<Join> joins;
    }

    private SearchIdeasConditions searchIdeasCondition(
            String projectId,
            IdeaSearchAdmin ideaSearchAdmin,
            Optional<String> requestorUserIdOpt) {
        List<Condition> conditions = Lists.newArrayList();
        List<Condition> conditionsRange = Lists.newArrayList();
        List<Join> joins = Lists.newArrayList();


        if (ideaSearchAdmin.getFundedByMeAndActive() == Boolean.TRUE) {
            checkArgument(requestorUserIdOpt.isPresent());
            joins.add(new Join(JooqIdeaFunders.IDEA_FUNDERS, JoinType.JOIN,
                    JooqIdeaFunders.IDEA_FUNDERS.PROJECTID.eq(JooqIdea.IDEA.PROJECTID)
                            .and(JooqIdeaFunders.IDEA_FUNDERS.POSTID.eq(JooqIdea.IDEA.POSTID))));
            conditions.add(JooqIdeaFunders.IDEA_FUNDERS.FUNDERUSERID.eq(requestorUserIdOpt.get()));
            // TODO how to check for activeness?? (Figure out which content and states allow funding and filter here)
        }

        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getFilterAuthorId())) {
            if (ideaSearchAdmin.getInvertAuthorId() == Boolean.TRUE) {
                conditions.add(JooqIdea.IDEA.AUTHORUSERID.ne(ideaSearchAdmin.getFilterAuthorId()));
            } else {
                conditions.add(JooqIdea.IDEA.AUTHORUSERID.eq(ideaSearchAdmin.getFilterAuthorId()));
            }
        }

        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getSimilarToIdeaId())) {
            // TODO Instead of an extra select here, embed this directly into the sql
            List<String> similarToIdeaTitleList = mysql.get().select(JooqIdea.IDEA.TITLE)
                    .from(JooqIdea.IDEA)
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                            .and(JooqIdea.IDEA.POSTID.eq(ideaSearchAdmin.getSimilarToIdeaId())))
                    .limit(1)
                    .fetch(JooqIdea.IDEA.TITLE);
            if (!similarToIdeaTitleList.isEmpty()) {
                conditions.add(mysqlUtil.similarToCondition(
                        similarToIdeaTitleList.get(0),
                        JooqIdea.IDEA.TITLE,
                        JooqIdea.IDEA.DESCRIPTION));
            }
            // Don't select self
            conditions.add(JooqIdea.IDEA.POSTID.ne(ideaSearchAdmin.getSimilarToIdeaId()));
        }

        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getSearchText())) {
            conditions.add(mysqlUtil.similarToCondition(
                    ideaSearchAdmin.getSearchText(),
                    JooqIdea.IDEA.TITLE,
                    JooqIdea.IDEA.DESCRIPTION));
        }

        if (ideaSearchAdmin.getFilterCategoryIds() != null && !ideaSearchAdmin.getFilterCategoryIds().isEmpty()) {
            Condition condition = JooqIdea.IDEA.CATEGORYID.in(ideaSearchAdmin.getFilterCategoryIds());
            if (ideaSearchAdmin.getInvertCategory() == Boolean.TRUE) {
                condition = condition.not();
            }
            conditions.add(condition);
        }

        if (ideaSearchAdmin.getFilterStatusIds() != null && !ideaSearchAdmin.getFilterStatusIds().isEmpty()) {
            Condition condition = JooqIdea.IDEA.STATUSID.in(ideaSearchAdmin.getFilterStatusIds());
            if (ideaSearchAdmin.getInvertStatus() == Boolean.TRUE) {
                condition = condition.not();
            }
            conditions.add(condition);
        }

        if (ideaSearchAdmin.getFilterTagIds() != null && !ideaSearchAdmin.getFilterTagIds().isEmpty()) {
            joins.add(new Join(JooqIdeaTags.IDEA_TAGS, JoinType.JOIN,
                    JooqIdeaTags.IDEA_TAGS.PROJECTID.eq(JooqIdea.IDEA.PROJECTID)
                            .and(JooqIdeaTags.IDEA_TAGS.POSTID.eq(JooqIdea.IDEA.POSTID))));
            Condition condition = JooqIdeaTags.IDEA_TAGS.TAGID.in(ideaSearchAdmin.getFilterTagIds());
            if (ideaSearchAdmin.getInvertTag() == Boolean.TRUE) {
                condition = condition.not();
            }
            conditions.add(condition);
        }

        if (ideaSearchAdmin.getFilterCreatedStart() != null) {
            conditionsRange.add(JooqIdea.IDEA.CREATED.greaterOrEqual(ideaSearchAdmin.getFilterCreatedStart()));
        }

        if (ideaSearchAdmin.getFilterCreatedEnd() != null) {
            conditionsRange.add(JooqIdea.IDEA.CREATED.lessOrEqual(ideaSearchAdmin.getFilterCreatedEnd()));
        }

        if (ideaSearchAdmin.getFilterLastActivityStart() != null) {
            conditionsRange.add(JooqIdea.IDEA.LASTACTIVITY.greaterOrEqual(ideaSearchAdmin.getFilterLastActivityStart()));
        }

        if (ideaSearchAdmin.getFilterLastActivityEnd() != null) {
            conditionsRange.add(JooqIdea.IDEA.LASTACTIVITY.lessOrEqual(ideaSearchAdmin.getFilterLastActivityEnd()));
        }

        // Do not look up posts merged into other posts
        conditions.add(JooqIdea.IDEA.MERGEDTOPOSTID.isNull());

        return new SearchIdeasConditions(
                mysqlUtil.and(conditions),
                mysqlUtil.and(conditionsRange),
                ImmutableList.copyOf(joins));
    }

    private QueryBuilder searchIdeasQuery(
            IdeaSearchAdmin ideaSearchAdmin,
            Optional<String> requestorUserIdOpt) {
        BoolQueryBuilder query = QueryBuilders.boolQuery();

        if (ideaSearchAdmin.getFundedByMeAndActive() == Boolean.TRUE) {
            checkArgument(requestorUserIdOpt.isPresent());
            query.must(QueryBuilders.termQuery("funderUserIds", requestorUserIdOpt.get()));
            // TODO how to check for activeness?? (Figure out which content and states allow funding and filter here)
        }

        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getFilterAuthorId())) {
            if (ideaSearchAdmin.getInvertAuthorId() == Boolean.TRUE) {
                query.mustNot(QueryBuilders.termQuery("authorUserId", ideaSearchAdmin.getFilterAuthorId()));
            } else {
                query.must(QueryBuilders.termQuery("authorUserId", ideaSearchAdmin.getFilterAuthorId()));
            }
        }

        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getSimilarToIdeaId())) {
            query.mustNot(QueryBuilders.termsQuery("ideaId", ideaSearchAdmin.getSimilarToIdeaId()));
            query.must(QueryBuilders.moreLikeThisQuery(
                            new String[]{"title", "description"},
                            null,
                            new Item[]{new Item(null, ideaSearchAdmin.getSimilarToIdeaId())})
                    .minTermFreq(1)
                    .minDocFreq(1)
                    .maxQueryTerms(10));
        }

        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getSearchText())) {
            query.should(QueryBuilders.multiMatchQuery(ideaSearchAdmin.getSearchText(),
                            "title", "description", "response")
                    .field("title", 6f)
                    .field("description", 2f)
                    .fuzziness("AUTO")
                    .zeroTermsQuery(ZeroTermsQueryOption.ALL));
        }

        if (ideaSearchAdmin.getFilterCategoryIds() != null && !ideaSearchAdmin.getFilterCategoryIds().isEmpty()) {
            TermsQueryBuilder termsCategory = QueryBuilders.termsQuery("categoryId", ideaSearchAdmin.getFilterCategoryIds().toArray());
            if (ideaSearchAdmin.getInvertCategory() == Boolean.TRUE) {
                query.mustNot(termsCategory);
            } else {
                query.filter(termsCategory);
            }
        }

        if (ideaSearchAdmin.getFilterStatusIds() != null && !ideaSearchAdmin.getFilterStatusIds().isEmpty()) {
            TermsQueryBuilder termsStatus = QueryBuilders.termsQuery("statusId", ideaSearchAdmin.getFilterStatusIds().toArray());
            if (ideaSearchAdmin.getInvertStatus() == Boolean.TRUE) {
                query.mustNot(termsStatus);
            } else {
                query.filter(termsStatus);
            }
        }

        if (ideaSearchAdmin.getFilterTagIds() != null && !ideaSearchAdmin.getFilterTagIds().isEmpty()) {
            TermsQueryBuilder termsTag = QueryBuilders.termsQuery("tagIds", ideaSearchAdmin.getFilterTagIds().toArray());
            if (ideaSearchAdmin.getInvertTag() == Boolean.TRUE) {
                query.mustNot(termsTag);
            } else {
                query.filter(termsTag);
            }
        }

        if (ideaSearchAdmin.getFilterCreatedStart() != null || ideaSearchAdmin.getFilterCreatedEnd() != null) {
            RangeQueryBuilder createdRangeQuery = QueryBuilders.rangeQuery("created");
            if (ideaSearchAdmin.getFilterCreatedStart() != null) {
                createdRangeQuery.gte(ideaSearchAdmin.getFilterCreatedStart().getEpochSecond());
            }
            if (ideaSearchAdmin.getFilterCreatedEnd() != null) {
                createdRangeQuery.lte(ideaSearchAdmin.getFilterCreatedEnd().getEpochSecond());
            }
            query.filter(createdRangeQuery);
        }

        if (ideaSearchAdmin.getFilterLastActivityStart() != null || ideaSearchAdmin.getFilterLastActivityEnd() != null) {
            // TODO Decide when last activity will be updated, don't forget to update it
            RangeQueryBuilder lastActivityRangeQuery = QueryBuilders.rangeQuery("lastActivity");
            if (ideaSearchAdmin.getFilterLastActivityStart() != null) {
                lastActivityRangeQuery.gte(ideaSearchAdmin.getFilterLastActivityStart().getEpochSecond());
            }
            if (ideaSearchAdmin.getFilterLastActivityEnd() != null) {
                lastActivityRangeQuery.lte(ideaSearchAdmin.getFilterLastActivityEnd().getEpochSecond());
            }
            query.filter(lastActivityRangeQuery);
        }

        // Do not look up posts merged into other posts
        query.mustNot(QueryBuilders.existsQuery("mergedToPostId"));

        return query;
    }

    @Value
    static class IdeaSearchKey {
        String projectId;
        IdeaSearchAdmin ideaSearchAdmin;
        Optional<String> cursorOpt;
    }

    private SearchResponse searchIdeas(
            String projectId,
            IdeaSearchAdmin ideaSearchAdmin,
            Optional<String> requestorUserIdOpt,
            boolean useAccurateCursor,
            Optional<String> cursorOpt) {
        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getSimilarToIdeaId())
                && !config.enableSimilarToIdea()) {
            return new SearchResponse(
                    ImmutableList.of(),
                    Optional.empty(),
                    0L,
                    false);
        }

        boolean useCache = config.enableSearchCache()
                && cursorOpt.isEmpty()
                && ideaSearchAdmin.getFundedByMeAndActive() != Boolean.TRUE
                && ideaSearchAdmin.getSearchText() == null;
        IdeaSearchKey key = new IdeaSearchKey(projectId, ideaSearchAdmin, cursorOpt);
        if (useCache) {
            SearchResponse cachedResponse = ideaSearchCache.getIfPresent(key);
            if (cachedResponse != null) {
                return cachedResponse;
            }
        }
        Optional<Integer> limitOpt = Optional.ofNullable(ideaSearchAdmin.getLimit()).map(Long::intValue);

        final SearchResponse searchResponse;
        if (projectStore.getSearchEngineForProject(projectId).isReadElastic()) {
            QueryBuilder query = searchIdeasQuery(ideaSearchAdmin, requestorUserIdOpt);

            Optional<SortOrder> sortOrderOpt;
            ImmutableList<String> sortFields;
            if (ideaSearchAdmin.getSortBy() != null
                    && Strings.isNullOrEmpty(ideaSearchAdmin.getSimilarToIdeaId())
                    && Strings.isNullOrEmpty(ideaSearchAdmin.getSearchText())) {
                switch (ideaSearchAdmin.getSortBy()) {
                    case TOP:
                        sortFields = ImmutableList.of("funded", "voteValue", "expressionsValue");
                        sortOrderOpt = Optional.of(SortOrder.DESC);
                        break;
                    case NEW:
                        sortFields = ImmutableList.of("created");
                        sortOrderOpt = Optional.of(SortOrder.DESC);
                        break;
                    case TRENDING:
                        sortFields = ImmutableList.of("trendScore", "funded", "voteValue", "expressionsValue");
                        sortOrderOpt = Optional.of(SortOrder.DESC);
                        break;
                    case RANDOM:
                        sortFields = ImmutableList.of();
                        sortOrderOpt = Optional.empty();
                        query = new FunctionScoreQueryBuilder(query, new RandomScoreFunctionBuilder()
                                .seed(IdUtil.randomId())
                                .setField("created"));
                        break;
                    case DRAGANDDROP:
                        sortFields = ImmutableList.of("order", "created");
                        sortOrderOpt = Optional.of(SortOrder.ASC);
                        break;
                    default:
                        throw new ApiException(Response.Status.BAD_REQUEST,
                                "Sorting by '" + ideaSearchAdmin.getSortBy() + "' not supported");
                }
            } else if (Strings.isNullOrEmpty(ideaSearchAdmin.getSearchText())) {
                sortFields = ImmutableList.of("funded", "voteValue", "expressionsValue");
                sortOrderOpt = Optional.of(SortOrder.DESC);
            } else {
                sortFields = ImmutableList.of();
                sortOrderOpt = Optional.empty();
            }

            log.trace("Idea search query: {}", query);
            ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(
                    new SearchRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)).source(new SearchSourceBuilder()
                            .fetchSource(false)
                            .query(query)),
                    cursorOpt, sortFields, sortOrderOpt, useAccurateCursor, limitOpt, configSearch, ImmutableSet.of());

            SearchHit[] hits = searchResponseWithCursor.getSearchResponse().getHits().getHits();
            log.trace("searchIdeas hitsSize {} query {}", hits.length, ideaSearchAdmin);

            if (hits.length == 0) {
                searchResponse = new SearchResponse(
                        ImmutableList.of(),
                        Optional.empty(),
                        0L,
                        false);
            } else {
                searchResponse = new SearchResponse(
                        Arrays.stream(hits)
                                .map(SearchHit::getId)
                                .collect(ImmutableList.toImmutableList()),
                        searchResponseWithCursor.getCursorOpt(),
                        searchResponseWithCursor.getSearchResponse().getHits().getTotalHits().value,
                        searchResponseWithCursor.getSearchResponse().getHits().getTotalHits().relation == TotalHits.Relation.GREATER_THAN_OR_EQUAL_TO);
            }
        } else {
            SearchIdeasConditions searchConditions = searchIdeasCondition(projectId, ideaSearchAdmin, requestorUserIdOpt);

            final ImmutableList<SortField<?>> sortFields;
            if (ideaSearchAdmin.getSortBy() != null
                    && Strings.isNullOrEmpty(ideaSearchAdmin.getSimilarToIdeaId())
                    && Strings.isNullOrEmpty(ideaSearchAdmin.getSearchText())) {
                switch (ideaSearchAdmin.getSortBy()) {
                    case TOP:
                        sortFields = ImmutableList.of(JooqIdea.IDEA.FUNDED.sort(DESC), JooqIdea.IDEA.VOTEVALUE.sort(DESC), JooqIdea.IDEA.EXPRESSIONSVALUE.sort(DESC));
                        break;
                    case NEW:
                        sortFields = ImmutableList.of(JooqIdea.IDEA.CREATED.sort(DESC));
                        break;
                    case TRENDING:
                        sortFields = ImmutableList.of(JooqIdea.IDEA.TRENDSCORE.sort(DESC), JooqIdea.IDEA.FUNDED.sort(DESC), JooqIdea.IDEA.VOTEVALUE.sort(DESC), JooqIdea.IDEA.EXPRESSIONSVALUE.sort(DESC));
                        break;
                    case RANDOM:
                        sortFields = ImmutableList.of(DSL.rand().sort(DESC));
                        break;
                    case DRAGANDDROP:
                        sortFields = ImmutableList.of(JooqIdea.IDEA.ORDER.sort(ASC), JooqIdea.IDEA.CREATED.sort(ASC));
                        break;
                    default:
                        throw new ApiException(Response.Status.BAD_REQUEST,
                                "Sorting by '" + ideaSearchAdmin.getSortBy() + "' not supported");
                }
            } else if (Strings.isNullOrEmpty(ideaSearchAdmin.getSearchText())) {
                sortFields = ImmutableList.of(JooqIdea.IDEA.FUNDED.sort(DESC), JooqIdea.IDEA.VOTEVALUE.sort(DESC), JooqIdea.IDEA.EXPRESSIONSVALUE.sort(DESC));
            } else {
                sortFields = ImmutableList.of();
            }

            List<String> postIds = mysql.get().selectDistinct(JooqIdea.IDEA.POSTID)
                    .from(mysqlUtil.join(JooqIdea.IDEA, searchConditions.getJoins()))
                    .where(mysqlUtil.and(
                            searchConditions.getConditions(),
                            searchConditions.getConditionsRange()))
                    .orderBy(sortFields)
                    .offset(mysqlUtil.offset(cursorOpt))
                    .limit(mysqlUtil.pageSizeMax(configSearch, Optional.ofNullable(ideaSearchAdmin.getLimit()).map(Long::intValue)))
                    .fetch(JooqIdea.IDEA.POSTID);

            searchResponse = new SearchResponse(
                    ImmutableList.copyOf(postIds),
                    mysqlUtil.nextCursor(configSearch, cursorOpt, limitOpt, postIds.size()),
                    postIds.size(),
                    true);
        }

        if (useCache) {
            ideaSearchCache.put(key, searchResponse);
        }

        return searchResponse;
    }

    @Override
    public long countIdeas(String projectId) {
        if (projectStore.getSearchEngineForProject(projectId).isReadElastic()) {
            try {
                return elastic.get().count(new CountRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)),
                                RequestOptions.DEFAULT)
                        .getCount();
            } catch (IOException ex) {
                throw new RuntimeException(ex);
            }
        } else {
            return mysql.get().fetchCount(JooqIdea.IDEA, JooqIdea.IDEA.PROJECTID.eq(projectId));
        }
    }

    @Override
    public IdeaAggregateResponse countIdeas(String projectId, String categoryId) {
        if (projectStore.getSearchEngineForProject(projectId).isReadElastic()) {
            org.elasticsearch.action.search.SearchResponse response = elasticUtil.retry(() -> elastic.get().search(new SearchRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId))
                    .source(new SearchSourceBuilder()
                            .fetchSource(false)
                            .query(QueryBuilders.boolQuery()
                                    .must(QueryBuilders.termQuery("categoryId", categoryId))
                                    .mustNot(QueryBuilders.existsQuery("mergedToPostId")))
                            .aggregation(AggregationBuilders
                                    .terms("statuses")
                                    .field("statusId"))
                            .aggregation(AggregationBuilders
                                    .terms("tags")
                                    .field("tagIds"))), RequestOptions.DEFAULT));

            long total = response.getHits().getTotalHits().value;
            ImmutableMap.Builder<String, Long> statusesBuilder = ImmutableMap.builder();
            ImmutableMap.Builder<String, Long> tagsBuilder = ImmutableMap.builder();
            response.getAggregations().<Terms>get("statuses").getBuckets()
                    .forEach(bucket -> statusesBuilder.put(bucket.getKeyAsString(), bucket.getDocCount()));
            response.getAggregations().<Terms>get("tags").getBuckets()
                    .forEach(bucket -> tagsBuilder.put(bucket.getKeyAsString(), bucket.getDocCount()));

            return new IdeaAggregateResponse(
                    total,
                    statusesBuilder.build(),
                    tagsBuilder.build());
        } else {
            return new IdeaAggregateResponse(
                    mysql.get().selectCount()
                            .from(JooqIdea.IDEA)
                            .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                                    .and(JooqIdea.IDEA.CATEGORYID.eq(categoryId))
                                    .and(JooqIdea.IDEA.MERGEDTOPOSTID.isNull()))
                            .fetchOne().component1().longValue(),
                    mysql.get().select(JooqIdea.IDEA.STATUSID, DSL.count())
                            .from(JooqIdea.IDEA)
                            .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                                    .and(JooqIdea.IDEA.CATEGORYID.eq(categoryId))
                                    .and(JooqIdea.IDEA.STATUSID.isNotNull())
                                    .and(JooqIdea.IDEA.MERGEDTOPOSTID.isNull()))
                            .groupBy(JooqIdea.IDEA.STATUSID)
                            .fetchMap(JooqIdea.IDEA.STATUSID, r -> r.component2().longValue()),
                    mysql.get().select(JooqIdeaTags.IDEA_TAGS.TAGID, DSL.count())
                            .from(JooqIdea.IDEA
                                    .join(JooqIdeaTags.IDEA_TAGS, JoinType.JOIN)
                                    .on(JooqIdeaTags.IDEA_TAGS.PROJECTID.eq(JooqIdea.IDEA.PROJECTID)
                                            .and(JooqIdeaTags.IDEA_TAGS.POSTID.eq(JooqIdea.IDEA.POSTID))))
                            .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                                    .and(JooqIdea.IDEA.CATEGORYID.eq(categoryId))
                                    .and(JooqIdeaTags.IDEA_TAGS.TAGID.isNotNull())
                                    .and(JooqIdea.IDEA.MERGEDTOPOSTID.isNull()))
                            .groupBy(JooqIdeaTags.IDEA_TAGS.TAGID)
                            .fetchMap(JooqIdeaTags.IDEA_TAGS.TAGID, r -> r.component2().longValue()));
        }
    }

    @Override
    public void exportAllForProject(String projectId, Consumer<IdeaModel> consumer) {
        StreamSupport.stream(ideaByProjectIdSchema.index().query(new QuerySpec()
                                .withHashKey(ideaByProjectIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(ideaByProjectIdSchema.rangeKeyName())
                                        .beginsWith(ideaByProjectIdSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(ideaByProjectIdSchema::fromItem)
                .filter(idea -> projectId.equals(idea.getProjectId()))
                .forEach(consumer);
    }

    @Override
    public IdeaAndIndexingFuture updateIdea(String projectId, String ideaId, IdeaUpdate ideaUpdate) {
        return updateIdea(projectId, ideaId, new IdeaUpdateAdmin(
                        ideaUpdate.getTitle(),
                        ideaUpdate.getDescription(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null),
                Optional.empty());
    }

    @Override
    public IdeaAndIndexingFuture updateIdea(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin, Optional<UserModel> responseAuthor) {
        UpdateItemSpec updateItemSpec = new UpdateItemSpec()
                .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "ideaId", ideaId)))
                .withReturnValues(ReturnValue.ALL_NEW);
        Map<String, Object> indexUpdatesElastic = Maps.newHashMap();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        JooqIdeaRecord indexUpdatesMysql = JooqIdea.IDEA.newRecord();
        List<Query> indexQueriesMysql = Lists.newArrayList();

        if (ideaUpdateAdmin.getCoverImg() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("coverImg")
                    .put(ideaSchema.toDynamoValue("coverImg", ideaUpdateAdmin.getCoverImg())));
        }
        if (ideaUpdateAdmin.getTitle() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("title")
                    .put(ideaSchema.toDynamoValue("title", ideaUpdateAdmin.getTitle())));
            if (searchEngine.isWriteElastic()) {
                indexUpdatesElastic.put("title", ideaUpdateAdmin.getTitle());
            }
            if (searchEngine.isWriteMysql()) {
                indexUpdatesMysql.setTitle(ideaUpdateAdmin.getTitle());
            }
        }
        if (ideaUpdateAdmin.getDescription() != null) {
            if (ideaUpdateAdmin.getDescription().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("description").delete());
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("description")
                        .put(ideaSchema.toDynamoValue("description", ideaUpdateAdmin.getDescription())));
            }
            String descriptionAsPlainText = sanitizer.richHtmlToPlaintext(ideaUpdateAdmin.getDescription());
            if (searchEngine.isWriteElastic()) {
                indexUpdatesElastic.put("description", descriptionAsPlainText);
            }
            if (searchEngine.isWriteMysql()) {
                indexUpdatesMysql.setDescription(descriptionAsPlainText);
            }
        }
        if ((ideaUpdateAdmin.getResponse() != null || ideaUpdateAdmin.getStatusId() != null)) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("responseEdited")
                    .put(ideaSchema.toDynamoValue("responseEdited", Instant.now())));
            if (responseAuthor.isPresent()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("responseAuthorUserId")
                        .put(ideaSchema.toDynamoValue("responseAuthorUserId", responseAuthor.get().getUserId())));
                if (searchEngine.isWriteElastic()) {
                    indexUpdatesElastic.put("responseAuthorUserId", responseAuthor.get().getUserId());
                }
                if (searchEngine.isWriteMysql()) {
                    indexUpdatesMysql.setResponseauthoruserid(responseAuthor.get().getUserId());
                }
                if (responseAuthor.get().getName() != null) {
                    updateItemSpec.addAttributeUpdate(new AttributeUpdate("responseAuthorName")
                            .put(ideaSchema.toDynamoValue("responseAuthorName", responseAuthor.get().getName())));
                    if (searchEngine.isWriteElastic()) {
                        indexUpdatesElastic.put("responseAuthorName", responseAuthor.get().getName());
                    }
                    if (searchEngine.isWriteMysql()) {
                        indexUpdatesMysql.setResponseauthorname(responseAuthor.get().getName());
                    }
                } else {
                    updateItemSpec.addAttributeUpdate(new AttributeUpdate("responseAuthorName").delete());
                    if (searchEngine.isWriteElastic()) {
                        indexUpdatesElastic.put("responseAuthorName", "");
                    }
                    if (searchEngine.isWriteMysql()) {
                        indexUpdatesMysql.setResponseauthorname(null);
                    }
                }
            }
        }
        if (ideaUpdateAdmin.getResponse() != null) {
            if (ideaUpdateAdmin.getResponse().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("response").delete());
                if (searchEngine.isWriteElastic()) {
                    indexUpdatesElastic.put("response", "");
                }
                if (searchEngine.isWriteMysql()) {
                    indexUpdatesMysql.setResponse(null);
                }
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("response")
                        .put(ideaSchema.toDynamoValue("response", ideaUpdateAdmin.getResponse())));
                String responseAsPlainText = sanitizer.richHtmlToPlaintext(ideaUpdateAdmin.getResponse());
                if (searchEngine.isWriteElastic()) {
                    indexUpdatesElastic.put("response", responseAsPlainText);
                }
                if (searchEngine.isWriteMysql()) {
                    indexUpdatesMysql.setResponse(responseAsPlainText);
                }
            }
        }
        if (ideaUpdateAdmin.getStatusId() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("statusId")
                    .put(ideaSchema.toDynamoValue("statusId", ideaUpdateAdmin.getStatusId())));
            if (searchEngine.isWriteElastic()) {
                indexUpdatesElastic.put("statusId", ideaUpdateAdmin.getStatusId());
            }
            if (searchEngine.isWriteMysql()) {
                indexUpdatesMysql.setStatusid(ideaUpdateAdmin.getStatusId());
            }
        }
        if (ideaUpdateAdmin.getTagIds() != null) {
            if (ideaUpdateAdmin.getTagIds().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("tagIds")
                        .delete());
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("tagIds")
                        .put(ideaSchema.toDynamoValue("tagIds", ImmutableSet.copyOf(ideaUpdateAdmin.getTagIds()))));
            }
            if (searchEngine.isWriteElastic()) {
                indexUpdatesElastic.put("tagIds", ideaUpdateAdmin.getTagIds());
            }
            if (searchEngine.isWriteMysql()) {
                indexQueriesMysql.add(mysql.get().deleteFrom(JooqIdeaTags.IDEA_TAGS)
                        .where(JooqIdeaTags.IDEA_TAGS.PROJECTID.eq(projectId)
                                .and(JooqIdeaTags.IDEA_TAGS.POSTID.eq(ideaId))
                                .and(JooqIdeaTags.IDEA_TAGS.TAGID.notIn(ideaUpdateAdmin.getTagIds()))));
                indexQueriesMysql.addAll(ideaUpdateAdmin.getTagIds().stream()
                        .map(tagId -> (Query) mysql.get().insertInto(JooqIdeaTags.IDEA_TAGS, JooqIdeaTags.IDEA_TAGS.fields())
                                .values(projectId, ideaId, tagId)
                                .onDuplicateKeyIgnore())
                        .collect(Collectors.toList()));
            }
        }
        if (ideaUpdateAdmin.getFundGoal() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("fundGoal")
                    .put(ideaSchema.toDynamoValue("fundGoal", ideaUpdateAdmin.getFundGoal())));
            if (searchEngine.isWriteElastic()) {
                indexUpdatesElastic.put("fundGoal", ideaUpdateAdmin.getFundGoal());
            }
            if (searchEngine.isWriteMysql()) {
                indexUpdatesMysql.setFundgoal(ideaUpdateAdmin.getFundGoal());
            }
        }
        if (ideaUpdateAdmin.getOrder() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("order")
                    .put(ideaSchema.toDynamoValue("order", ideaUpdateAdmin.getOrder())));
            if (searchEngine.isWriteElastic()) {
                indexUpdatesElastic.put("order", ideaUpdateAdmin.getOrder());
            }
            if (searchEngine.isWriteMysql()) {
                indexUpdatesMysql.setOrder(ideaUpdateAdmin.getOrder());
            }
        }

        IdeaModel idea = ideaSchema.fromItem(ideaSchema.table().updateItem(updateItemSpec).getItem());

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        if (searchEngine.isWriteElastic()) {
            if (indexUpdatesElastic.size() > 0) {
                elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                                .doc(gson.toJson(indexUpdatesElastic), XContentType.JSON)
                                .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                        RequestOptions.DEFAULT,
                        searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, projectId, ideaId))
                                : ActionListeners.onFailureRetry(() -> indexIdea(projectId, ideaId)));
            } else if (searchEngine.isReadElastic()) {
                indexingFuture.set(null);
            }
        }
        if (searchEngine.isWriteMysql()) {
            List<CompletionStage<?>> completionStages = Lists.newArrayList();
            if (!indexQueriesMysql.isEmpty()) {
                indexQueriesMysql.stream()
                        .map(Query::executeAsync)
                        .forEach(completionStages::add);
            }
            if (indexUpdatesMysql.changed()) {
                CompletionStage<Integer> completionStage = mysql.get().update(JooqIdea.IDEA)
                        .set(indexUpdatesMysql)
                        .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                                .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
                        .executeAsync();
                completionStages.add(completionStage);
            }
            if (searchEngine.isReadMysql()) {
                if (completionStages.isEmpty()) {
                    indexingFuture.set(null);
                } else {
                    CompletionStageUtil.toSettableFuture(indexingFuture, completionStages);
                }
            } else {
                CompletionStageUtil.logFailure(completionStages);
            }
        }

        return new IdeaAndIndexingFuture(idea, indexingFuture);
    }

    @Override
    public IdeaAndIndexingFuture voteIdea(String projectId, String ideaId, String userId, VoteValue vote) {
        VoteValue votePrev = voteStore.vote(projectId, userId, ideaId, vote);
        if (vote == votePrev) {
            return new IdeaAndIndexingFuture(getIdea(projectId, ideaId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Idea not found")), Futures.immediateFuture(null));
        }

        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, Object> valMap = Maps.newHashMap();
        valMap.put(":zero", 0);
        List<String> setUpdates = Lists.newArrayList();

        int voteDiff = vote.getValue() - votePrev.getValue();
        if (voteDiff != 0) {
            nameMap.put("#voteValue", "voteValue");
            valMap.put(":voteDiff", voteDiff);
            setUpdates.add("#voteValue = if_not_exists(#voteValue, :zero) + :voteDiff");
        }

        int votersCountDiff = Math.abs(vote.getValue()) - Math.abs((votePrev.getValue()));
        if (votersCountDiff != 0) {
            nameMap.put("#votersCount", "votersCount");
            valMap.put(":votersCountDiff", votersCountDiff);
            setUpdates.add("#votersCount = if_not_exists(#votersCount, :zero) + :votersCountDiff");
        }

        String updateExpression = "SET " + String.join(", ", setUpdates);
        log.trace("VoteIdea expression: {}", updateExpression);

        IdeaModel idea = ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .withNameMap(nameMap)
                        .withValueMap(valMap)
                        .withUpdateExpression(updateExpression))
                .getItem());

        if (!userId.equals(idea.getAuthorUserId())) {
            userStore.userVoteUpdateBloom(projectId, userId, ideaId);
        }

        boolean updateTrend = false;
        Map<String, Object> indexUpdatesElastic = Maps.newHashMap();
        Map<Object, Object> indexUpdatesMysql = Maps.newHashMap();
        if (voteDiff != 0) {
            updateTrend = true;
            indexUpdatesElastic.put("voteValue", orNull(idea.getVoteValue()));
            indexUpdatesMysql.put(JooqIdea.IDEA.VOTEVALUE, idea.getVoteValue());
            indexUpdatesMysql.put(JooqIdea.IDEA.TRENDSCORE, JooqRoutines.expDecay(
                    idea.getTrendScore(),
                    EXP_DECAY_PERIOD_MILLIS,
                    System.currentTimeMillis()));
        }
        if (votersCountDiff != 0) {
            indexUpdatesElastic.put("votersCount", orNull(idea.getVotersCount()));
            indexUpdatesMysql.put(JooqIdea.IDEA.VOTERSCOUNT, idea.getVotersCount());
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            if (!indexUpdatesElastic.isEmpty() || updateTrend) {
                UpdateRequest updateRequest = new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId());
                if (updateTrend) {
                    updateRequest.script(ElasticScript.EXP_DECAY.toScript(ImmutableMap.of(
                            "decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS,
                            "timeInMillis", System.currentTimeMillis(),
                            "extraUpdates", indexUpdatesElastic)));
                } else {
                    updateRequest.doc(gson.toJson(indexUpdatesElastic), XContentType.JSON);
                }
                elastic.get().updateAsync(updateRequest.setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                        RequestOptions.DEFAULT,
                        searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, projectId, ideaId))
                                : ActionListeners.onFailureRetry(() -> indexIdea(projectId, ideaId)));
            } else if (searchEngine.isReadElastic()) {
                indexingFuture.set(null);
            }
        }
        if (searchEngine.isWriteMysql()) {
            if (!indexUpdatesMysql.isEmpty()) {
                CompletionStage<Integer> completionStage = mysql.get().update(JooqIdea.IDEA)
                        .set(indexUpdatesMysql)
                        .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                                .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
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

        return new IdeaAndIndexingFuture(idea, indexingFuture);
    }

    @Override
    public IdeaAndExpressionsAndIndexingFuture expressIdeaSet(String projectId, String ideaId, String userId, Function<String, Double> expressionToWeightMapper, Optional<String> expressionOpt) {
        ImmutableSet<String> expressionsPrev = voteStore.express(projectId, userId, ideaId, expressionOpt);
        ImmutableSet<String> expressions = expressionOpt.map(ImmutableSet::of).orElse(ImmutableSet.of());

        if (expressionsPrev.equals(expressions)) {
            return new IdeaAndExpressionsAndIndexingFuture(expressions, getIdea(projectId, ideaId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Idea not found")), Futures.immediateFuture(null));
        }

        SetView<String> expressionsAdded = Sets.difference(expressions, expressionsPrev);
        SetView<String> expressionsRemoved = Sets.difference(expressionsPrev, expressions);

        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, Object> valMap = Maps.newHashMap();
        valMap.put(":one", 1);
        valMap.put(":zero", 0);

        double expressionsValueDiff = 0d;
        List<String> setUpdates = Lists.newArrayList();

        int expressionAddedCounter = 0;
        for (String expressionAdded : expressionsAdded) {
            String nameValue = "#exprAdd" + expressionAddedCounter++;
            nameMap.put(nameValue, expressionAdded);
            setUpdates.add("expressions." + nameValue + " = if_not_exists(expressions." + nameValue + ", :zero) + :one");
            expressionsValueDiff += expressionToWeightMapper.apply(expressionAdded);
        }

        int expressionRemovedCounter = 0;
        for (String expressionRemoved : expressionsRemoved) {
            String nameValue = "#exprRem" + expressionRemovedCounter++;
            nameMap.put(nameValue, expressionRemoved);
            setUpdates.add("expressions." + nameValue + " = if_not_exists(expressions." + nameValue + ", :zero) - :one");
            expressionsValueDiff -= expressionToWeightMapper.apply(expressionRemoved);
        }

        if (expressionsValueDiff != 0d) {
            nameMap.put("#expressionsValue", "expressionsValue");
            valMap.put(":expValDiff", Math.abs(expressionsValueDiff));
            setUpdates.add("#expressionsValue = if_not_exists(#expressionsValue, :zero) " + (expressionsValueDiff > 0 ? "+" : "-") + " :expValDiff");
        }

        String updateExpression = "SET " + String.join(", ", setUpdates);
        log.trace("ExpressIdeaSet expression: {}", updateExpression);

        IdeaModel idea = ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .withNameMap(nameMap)
                        .withValueMap(valMap)
                        .withUpdateExpression(updateExpression))
                .getItem());

        if (!userId.equals(idea.getAuthorUserId())) {
            userStore.userExpressUpdateBloom(projectId, userId, ideaId);
        }

        Map<String, Object> indexUpdatesElastic = Maps.newHashMap();
        Map<Object, Object> indexUpdatesMysql = Maps.newHashMap();
        indexUpdatesElastic.put("expressions", idea.getExpressions().keySet());
        if (expressionsValueDiff != 0d) {
            indexUpdatesElastic.put("expressionsValue", idea.getExpressionsValue());
            indexUpdatesMysql.put(JooqIdea.IDEA.EXPRESSIONSVALUE, idea.getExpressionsValue());
            indexUpdatesMysql.put(JooqIdea.IDEA.TRENDSCORE, JooqRoutines.expDecay(
                    idea.getTrendScore(),
                    EXP_DECAY_PERIOD_MILLIS,
                    System.currentTimeMillis()));
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                            .script(ElasticScript.EXP_DECAY.toScript(ImmutableMap.of(
                                    "decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS,
                                    "timeInMillis", System.currentTimeMillis(),
                                    "extraUpdates", indexUpdatesElastic)))
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, projectId, ideaId))
                            : ActionListeners.onFailureRetry(() -> indexIdea(projectId, ideaId)));
        }
        if (searchEngine.isWriteMysql()) {
            if (!indexUpdatesMysql.isEmpty()) {
                CompletionStage<Integer> completionStage = mysql.get().update(JooqIdea.IDEA)
                        .set(indexUpdatesMysql)
                        .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                                .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
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

        return new IdeaAndExpressionsAndIndexingFuture(expressions, idea, indexingFuture);
    }

    @Override
    public IdeaAndExpressionsAndIndexingFuture expressIdeaAdd(String projectId, String ideaId, String userId, Function<String, Double> expressionToWeightMapper, String expression) {
        ImmutableSet<String> expressionsPrev = voteStore.expressMultiAdd(projectId, userId, ideaId, ImmutableSet.of(expression));

        if (expressionsPrev.contains(expression)) {
            return new IdeaAndExpressionsAndIndexingFuture(expressionsPrev, getIdea(projectId, ideaId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Idea not found")), Futures.immediateFuture(null));
        }

        double expressionValueDiff = expressionToWeightMapper.apply(expression);
        IdeaModel idea = ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .withNameMap(Map.of("#exprAdd", expression))
                        .withValueMap(Map.of(":val", Math.abs(expressionValueDiff), ":one", 1, ":zero", 0))
                        .withUpdateExpression("SET expressions.#exprAdd = if_not_exists(expressions.#exprAdd, :zero) + :one, expressionsValue = if_not_exists(expressionsValue, :zero) " + (expressionValueDiff > 0 ? "+" : "-") + " :val"))
                .getItem());

        if (!userId.equals(idea.getAuthorUserId())) {
            userStore.userExpressUpdateBloom(projectId, userId, ideaId);
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            Map<String, Object> indexUpdates = Maps.newHashMap();
            indexUpdates.put("expressions", idea.getExpressions().keySet());
            indexUpdates.put("expressionsValue", idea.getExpressionsValue());
            elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                            .script(ElasticScript.EXP_DECAY.toScript(ImmutableMap.of(
                                    "decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS,
                                    "timeInMillis", System.currentTimeMillis(),
                                    "extraUpdates", indexUpdates)))
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, projectId, ideaId))
                            : ActionListeners.onFailureRetry(() -> indexIdea(projectId, ideaId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqIdea.IDEA)
                    .set(JooqIdea.IDEA.EXPRESSIONSVALUE, idea.getExpressionsValue())
                    .set(JooqIdea.IDEA.TRENDSCORE, JooqRoutines.expDecay(
                            idea.getTrendScore(),
                            EXP_DECAY_PERIOD_MILLIS,
                            System.currentTimeMillis()))
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                            .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new IdeaAndExpressionsAndIndexingFuture(
                ImmutableSet.<String>builder()
                        .addAll(expressionsPrev)
                        .add(expression)
                        .build(),
                idea, indexingFuture);
    }

    @Override
    public IdeaAndExpressionsAndIndexingFuture expressIdeaRemove(String projectId, String ideaId, String userId, Function<String, Double> expressionToWeightMapper, String expression) {
        ImmutableSet<String> expressionsPrev = voteStore.expressMultiRemove(projectId, userId, ideaId, ImmutableSet.of(expression));

        if (!expressionsPrev.contains(expression)) {
            return new IdeaAndExpressionsAndIndexingFuture(expressionsPrev, getIdea(projectId, ideaId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Idea not found")), Futures.immediateFuture(null));
        }

        double expressionValueDiff = -expressionToWeightMapper.apply(expression);
        IdeaModel idea = ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .withNameMap(Map.of("#exprRem", expression))
                        .withValueMap(Map.of(":val", Math.abs(expressionValueDiff), ":one", 1, ":zero", 0))
                        .withUpdateExpression("SET expressions.#exprRem = if_not_exists(expressions.#exprRem, :zero) - :one, expressionsValue = if_not_exists(expressionsValue, :zero) " + (expressionValueDiff > 0 ? "+" : "-") + " :val"))
                .getItem());

        if (!userId.equals(idea.getAuthorUserId())) {
            userStore.userExpressUpdateBloom(projectId, userId, ideaId);
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            Map<String, Object> indexUpdates = Maps.newHashMap();
            indexUpdates.put("expressions", idea.getExpressions().keySet());
            indexUpdates.put("expressionsValue", idea.getExpressionsValue());
            elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                            .script(ElasticScript.EXP_DECAY.toScript(ImmutableMap.of(
                                    "decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS,
                                    "timeInMillis", System.currentTimeMillis(),
                                    "extraUpdates", indexUpdates)))
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, projectId, ideaId))
                            : ActionListeners.onFailureRetry(() -> indexIdea(projectId, ideaId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqIdea.IDEA)
                    .set(JooqIdea.IDEA.EXPRESSIONSVALUE, idea.getExpressionsValue())
                    .set(JooqIdea.IDEA.TRENDSCORE, JooqRoutines.expDecay(
                            idea.getTrendScore(),
                            EXP_DECAY_PERIOD_MILLIS,
                            System.currentTimeMillis()))
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                            .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new IdeaAndExpressionsAndIndexingFuture(
                ImmutableSet.copyOf(Sets.difference(expressionsPrev, ImmutableSet.of(expression))),
                idea, indexingFuture);
    }

    @Override
    public IdeaTransactionAndIndexingFuture fundIdea(String projectId, String ideaId, String userId, long fundDiff, String transactionType, String summary) {
        if (fundDiff == 0L) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Cannot fund zero");
        }

        TransactionAndFundPrevious transactionAndFundPrevious = voteStore.fund(projectId, userId, ideaId, fundDiff, transactionType, summary);
        boolean hasFundedBefore = transactionAndFundPrevious.getFundAmountPrevious() > 0L;
        long resultingFundAmount = transactionAndFundPrevious.getFundAmountPrevious() + fundDiff;

        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, Object> valMap = Maps.newHashMap();
        valMap.put(":zero", 0);
        List<String> setUpdates = Lists.newArrayList();

        nameMap.put("#funded", "funded");
        valMap.put(":fundDiff", fundDiff);
        setUpdates.add("#funded = if_not_exists(#funded, :zero) + :fundDiff");

        if (!hasFundedBefore && resultingFundAmount != 0L) {
            nameMap.put("#fundersCount", "fundersCount");
            valMap.put(":one", 1);
            setUpdates.add("#fundersCount = if_not_exists(#fundersCount, :zero) + :one");
        } else if (hasFundedBefore && resultingFundAmount == 0L) {
            nameMap.put("#fundersCount", "fundersCount");
            valMap.put(":one", 1);
            setUpdates.add("#fundersCount = if_not_exists(#fundersCount, :zero) - :one");
        }

        String updateExpression = "SET " + String.join(", ", setUpdates);
        log.trace("FundIdea expression: {}", updateExpression);

        IdeaModel idea = ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .withNameMap(nameMap)
                        .withValueMap(valMap)
                        .withUpdateExpression(updateExpression))
                .getItem());

        Map<String, Object> indexUpdatesElastic = Maps.newHashMap();
        JooqIdeaRecord indexUpdatesMysql = JooqIdea.IDEA.newRecord();
        List<Query> indexQueriesMysql = Lists.newArrayList();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        ImmutableMap.Builder<String, Object> scriptParamsBuilder = ImmutableMap.builder();
        if (searchEngine.isWriteElastic()) {
            scriptParamsBuilder.put("extraUpdates", indexUpdatesElastic);
            scriptParamsBuilder.put("decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS);
            scriptParamsBuilder.put("timeInMillis", System.currentTimeMillis());
            indexUpdatesElastic.put("funded", orNull(idea.getFunded()));
        }
        if (searchEngine.isWriteMysql()) {
            indexUpdatesMysql.setFunded(idea.getFunded());
        }
        if (!hasFundedBefore && resultingFundAmount != 0L) {
            if (searchEngine.isWriteElastic()) {
                indexUpdatesElastic.put("fundersCount", idea.getFundersCount());
                scriptParamsBuilder.put("extraArrayAdditions",
                        ImmutableMap.of("funderUserIds", userId));
            }
            if (searchEngine.isWriteMysql()) {
                indexUpdatesMysql.setFunderscount(idea.getFundersCount());
                indexQueriesMysql.add(mysql.get().insertInto(JooqIdeaFunders.IDEA_FUNDERS, JooqIdeaFunders.IDEA_FUNDERS.fields())
                        .values(projectId, ideaId, userId)
                        .onDuplicateKeyIgnore());
            }
        } else if (hasFundedBefore && resultingFundAmount == 0L) {

            if (searchEngine.isWriteElastic()) {
                indexUpdatesElastic.put("fundersCount", idea.getFundersCount());
                scriptParamsBuilder.put("extraArrayDeletions",
                        ImmutableMap.of("funderUserIds", userId));
            }
            if (searchEngine.isWriteMysql()) {
                indexUpdatesMysql.setFunderscount(idea.getFundersCount());
                indexQueriesMysql.add(mysql.get().deleteFrom(JooqIdeaFunders.IDEA_FUNDERS)
                        .where(JooqIdeaFunders.IDEA_FUNDERS.PROJECTID.eq(projectId)
                                .and(JooqIdeaFunders.IDEA_FUNDERS.POSTID.eq(ideaId))
                                .and(JooqIdeaFunders.IDEA_FUNDERS.FUNDERUSERID.eq(userId))));
            }
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                            .script(ElasticScript.EXP_DECAY.toScript(scriptParamsBuilder.build()))
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, projectId, ideaId))
                            : ActionListeners.onFailureRetry(() -> indexIdea(projectId, ideaId)));
        }
        if (searchEngine.isWriteMysql()) {
            List<CompletionStage<?>> completionStages = Lists.newArrayList();
            completionStages.add(mysql.get().update(JooqIdea.IDEA)
                    .set(indexUpdatesMysql)
                    .set(JooqIdea.IDEA.TRENDSCORE, JooqRoutines.expDecay(
                            idea.getTrendScore(),
                            EXP_DECAY_PERIOD_MILLIS,
                            System.currentTimeMillis()))
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                            .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
                    .executeAsync());
            if (!indexQueriesMysql.isEmpty()) {
                indexQueriesMysql.stream()
                        .map(Query::executeAsync)
                        .forEach(completionStages::add);
            }
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStages);
            } else {
                CompletionStageUtil.logFailure(completionStages);
            }
        }

        return new IdeaTransactionAndIndexingFuture(
                resultingFundAmount,
                idea,
                transactionAndFundPrevious.getTransaction(),
                indexingFuture);
    }

    @Extern
    @Override
    public IdeaAndIndexingFuture incrementIdeaCommentCount(String projectId, String ideaId, boolean incrementChildCount) {
        ImmutableList.Builder<AttributeUpdate> attrUpdates = ImmutableList.builder();
        attrUpdates.add(new AttributeUpdate("commentCount").addNumeric(1));
        if (incrementChildCount) {
            attrUpdates.add(new AttributeUpdate("childCommentCount").addNumeric(1));
        }
        IdeaModel idea = ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .withAttributeUpdate(attrUpdates.build()))
                .getItem());

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            ImmutableMap.Builder<Object, Object> updates = ImmutableMap.builder();
            updates.put("commentCount", idea.getCommentCount());
            if (incrementChildCount) {
                updates.put("childCommentCount", idea.getChildCommentCount());
            }
            elastic.get().updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                            .doc(gson.toJson(updates.build()), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, projectId, ideaId))
                            : ActionListeners.onFailureRetry(() -> indexIdea(projectId, ideaId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqIdea.IDEA)
                    .set(JooqIdea.IDEA.COMMENTCOUNT, idea.getCommentCount())
                    .set(JooqIdea.IDEA.CHILDCOMMENTCOUNT, idea.getChildCommentCount())
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                            .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new IdeaAndIndexingFuture(idea, indexingFuture);
    }

    @Extern
    @Override
    public ListenableFuture<Void> deleteIdea(String projectId, String ideaId, boolean deleteMerged) {
        ExpressionBuilder expressionBuilder = ideaSchema.expressionBuilder()
                .conditionExists();
        if (!deleteMerged) {
            expressionBuilder.conditionFieldNotExists("mergedToPostId");
        }
        Expression expression = expressionBuilder.build();
        log.trace("delete idea expression {}", expression);

        try {
            ideaSchema.table().deleteItem(new DeleteItemSpec()
                    .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                            "projectId", projectId,
                            "ideaId", ideaId)))
                    .withConditionExpression(expression.conditionExpression().orElse(null))
                    .withNameMap(expression.nameMap().orElse(null)));
        } catch (ConditionalCheckFailedException ex) {
            // Already deleted
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.get().deleteAsync(new DeleteRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), ideaId)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexIdea(f, projectId, ideaId))
                            : ActionListeners.onFailureRetry(() -> indexIdea(projectId, ideaId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().delete(JooqIdea.IDEA)
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                            .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
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
    public ListenableFuture<Void> deleteIdeas(String projectId, ImmutableCollection<String> ideaIds) {
        singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(ideaSchema.tableName())
                .withPrimaryKeysToDelete(ideaIds.stream()
                        .map(ideaId -> ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .toArray(PrimaryKey[]::new))));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.get().bulkAsync(new BulkRequest()
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                            .add(ideaIds.stream()
                                    .map(ideaId -> new DeleteRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), ideaId))
                                    .collect(ImmutableList.toImmutableList())),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().delete(JooqIdea.IDEA)
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                            .and(JooqIdea.IDEA.POSTID.in(ideaIds)))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return indexingFuture;
    }

    @Extern
    @Override
    public ListenableFuture<Void> deleteAllForProject(String projectId) {
        // Delete ideas
        Iterables.partition(StreamSupport.stream(ideaByProjectIdSchema.index().query(new QuerySpec()
                                        .withHashKey(ideaByProjectIdSchema.partitionKey(Map.of(
                                                "projectId", projectId)))
                                        .withRangeKeyCondition(new RangeKeyCondition(ideaByProjectIdSchema.rangeKeyName())
                                                .beginsWith(ideaByProjectIdSchema.rangeValuePartial(Map.of()))))
                                .pages()
                                .spliterator(), false)
                        .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                        .map(ideaByProjectIdSchema::fromItem)
                        .filter(idea -> projectId.equals(idea.getProjectId()))
                        .map(IdeaModel::getIdeaId)
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(ideaIdsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(ideaSchema.tableName());
                    ideaIdsBatch.stream()
                            .map(ideaId -> ideaSchema.primaryKey(Map.of(
                                    "ideaId", ideaId,
                                    "projectId", projectId)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.get().indices().deleteAsync(new DeleteIndexRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().delete(JooqIdea.IDEA)
                    .where(JooqIdea.IDEA.PROJECTID.eq(projectId))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return indexingFuture;
    }

    private void indexIdea(String projectId, String ideaId) {
        indexIdea(SettableFuture.create(), projectId, ideaId);
    }

    private void indexIdea(SettableFuture<Void> indexingFuture, String projectId, String ideaId) {
        Optional<IdeaModel> ideaOpt = getIdea(projectId, ideaId);
        if (!ideaOpt.isPresent()) {
            SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
            if (searchEngine.isWriteElastic()) {
                elastic.get().deleteAsync(new DeleteRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), ideaId),
                        RequestOptions.DEFAULT,
                        searchEngine.isReadElastic()
                                ? ActionListeners.fromFuture(indexingFuture)
                                : ActionListeners.logFailure());
            }
            if (searchEngine.isWriteMysql()) {
                CompletionStage<Integer> completionStage = mysql.get().deleteFrom(JooqIdea.IDEA)
                        .where(JooqIdea.IDEA.PROJECTID.eq(projectId)
                                .and(JooqIdea.IDEA.POSTID.eq(ideaId)))
                        .executeAsync();
                if (searchEngine.isReadMysql()) {
                    CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
                } else {
                    CompletionStageUtil.logFailure(completionStage);
                }
            }
        } else {
            indexIdea(indexingFuture, ideaOpt.get());
        }
    }

    private void indexIdea(IdeaModel idea) {
        indexIdea(SettableFuture.create(), idea);
    }

    private void indexIdea(SettableFuture<Void> indexingFuture, IdeaModel idea) {
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(idea.getProjectId());
        if (searchEngine.isWriteElastic()) {
            elastic.get().indexAsync(ideaToEsIndexRequest(idea, true),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic()
                            ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysqlUtil.sequentialBatch(ideaToMysqlRecords(idea));
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }
    }

    private IdeaModel upgradeExpressionsProperty(IdeaModel post) {
        if (post.getExpressions() != null) {
            return post;
        }

        log.info("Updating post {} in project {} with missing expressions property",
                post.getIdeaId(), post.getProjectId());
        try {
            return ideaSchema.fromItem(ideaSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                                    "projectId", post.getProjectId(),
                                    "ideaId", post.getIdeaId())))
                            .withReturnValues(ReturnValue.ALL_NEW)
                            .withNameMap(ImmutableMap.of("#expressions", "expressions"))
                            .withValueMap(ImmutableMap.of(":expressions", ideaSchema.toDynamoValue("expressions", ImmutableMap.of())))
                            .withConditionExpression("attribute_not_exists(#expressions)")
                            .withUpdateExpression("SET #expressions = :expressions"))
                    .getItem());
        } catch (ConditionalCheckFailedException ex) {
            // Nothing to do, already fixed
            return post;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(IdeaStore.class).to(DynamoElasticIdeaStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                install(ConfigSystem.configModule(ConfigSearch.class, Names.named("idea")));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoElasticIdeaStore.class).asEagerSingleton();
            }
        };
    }
}
