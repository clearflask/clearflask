// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Page;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.common.collect.Sets;
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
import com.smotana.clearflask.api.model.CommentSearchAdmin;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramSearchAdmin;
import com.smotana.clearflask.api.model.Hits;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.ElasticScript;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.mysql.CompletionStageUtil;
import com.smotana.clearflask.store.mysql.DefaultMysqlProvider;
import com.smotana.clearflask.store.mysql.MoreSQLDataType;
import com.smotana.clearflask.store.mysql.MysqlCustomFunction;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.store.mysql.model.routines.JooqVoteWilson;
import com.smotana.clearflask.store.mysql.model.tables.JooqComment;
import com.smotana.clearflask.store.mysql.model.tables.JooqCommentParentId;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqCommentParentIdRecord;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqCommentRecord;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.util.WilsonScoreInterval;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.Expression;
import io.dataspray.singletable.IndexSchema;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.GetIndexRequest;
import org.elasticsearch.common.document.DocumentField;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.ZeroTermsQueryOption;
import org.elasticsearch.index.reindex.DeleteByQueryRequest;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.JoinType;
import org.jooq.Queries;
import org.jooq.SelectField;
import org.jooq.SortField;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import rx.Observable;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_READ_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.mysql.DefaultMysqlProvider.ID_MAX_LENGTH;
import static com.smotana.clearflask.util.ExplicitNull.orNull;
import static org.jooq.SortOrder.ASC;
import static org.jooq.SortOrder.DESC;

@Slf4j
@Singleton
public class DynamoElasticCommentStore extends ManagedService implements CommentStore {

    public interface Config {
        /**
         * Intended for tests. Force immediate index refresh after write request.
         */
        @DefaultValue("false")
        boolean elasticForceRefresh();

        @DefaultValue("3")
        int searchInitialDepthLimit();

        @DefaultValue("20")
        int searchInitialFetchMax();

        @DefaultValue("50")
        int searchSubsequentFetchMax();

        @DefaultValue("0.95")
        double scoreWilsonConfidenceLevel();

        Observable<Double> scoreWilsonConfidenceLevelObservable();

        @DefaultValue("true")
        boolean enableHistograms();
    }

    private static final String COMMENT_INDEX = "comment";
    private static final String COMMENT_PARENT_ID_INDEX = "comment_parent_id";

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    @Named("comment")
    private ElasticUtil.ConfigSearch configSearch;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private SingleTable singleTable;
    @Inject
    private RestHighLevelClient elastic;
    @Inject
    private ElasticUtil elasticUtil;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;
    @Inject
    private Gson gson;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private UserStore userStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private Sanitizer sanitizer;
    @Inject
    private DSLContext mysql;
    @Inject
    private MysqlUtil mysqlUtil;

    private TableSchema<CommentModel> commentSchema;
    private IndexSchema<CommentModel> commentByProjectIdSchema;
    private WilsonScoreInterval wilsonScoreInterval;

    @Inject
    private void setup() {
        commentSchema = singleTable.parseTableSchema(CommentModel.class);
        commentByProjectIdSchema = singleTable.parseGlobalSecondaryIndexSchema(2, CommentModel.class);

        config.scoreWilsonConfidenceLevelObservable().subscribe(scoreWilsonConfidenceLevel -> wilsonScoreInterval =
                new WilsonScoreInterval(scoreWilsonConfidenceLevel));
        wilsonScoreInterval = new WilsonScoreInterval(config.scoreWilsonConfidenceLevel());
    }

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(DefaultMysqlProvider.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        if (configApp.createIndexesOnStartup()) {
            SearchEngine searchEngine = configApp.defaultSearchEngine();
            if (searchEngine.isWriteMysql()) {
                createIndexMysql();
            }
        }
    }

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
        log.info("Creating Mysql table {}", COMMENT_INDEX);
        mysql.createTableIfNotExists(COMMENT_INDEX)
                .column("projectId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("postId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("commentId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("level", SQLDataType.BIGINT.notNull())
                .column("childCommentCount", SQLDataType.BIGINT.notNull())
                .column("authorUserId", SQLDataType.VARCHAR(ID_MAX_LENGTH))
                .column("authorName", SQLDataType.VARCHAR(255))
                .column("authorIsMod", SQLDataType.BOOLEAN)
                .column("created", MoreSQLDataType.DATETIME(6).notNull())
                .column("edited", MoreSQLDataType.DATETIME(6))
                .column("content", SQLDataType.CLOB(Math.max(255, (int) Sanitizer.CONTENT_MAX_LENGTH)))
                .column("upvotes", SQLDataType.BIGINT.notNull())
                .column("downvotes", SQLDataType.BIGINT.notNull())
                .column("score", SQLDataType.DOUBLE.notNull())
                .primaryKey("projectId", "postId", "commentId")
                .execute();
        mysqlUtil.createIndexIfNotExists(mysql.createIndex().on(JooqComment.COMMENT, JooqComment.COMMENT.PROJECTID));
        mysqlUtil.createIndexIfNotExists(mysql.createIndex().on(JooqComment.COMMENT, JooqComment.COMMENT.PROJECTID, JooqComment.COMMENT.POSTID));
        mysqlUtil.createIndexIfNotExists(mysql.createIndex().on(JooqComment.COMMENT, JooqComment.COMMENT.AUTHORUSERID));
        mysql.createTableIfNotExists(COMMENT_PARENT_ID_INDEX)
                .column("projectId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("postId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("commentId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("parentCommentId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .primaryKey("projectId", "postId", "commentId", "parentCommentId")
                .constraints(DSL.foreignKey(JooqCommentParentId.COMMENT_PARENT_ID.PROJECTID, JooqCommentParentId.COMMENT_PARENT_ID.POSTID, JooqCommentParentId.COMMENT_PARENT_ID.COMMENTID)
                        .references(JooqComment.COMMENT, JooqComment.COMMENT.PROJECTID, JooqComment.COMMENT.POSTID, JooqComment.COMMENT.COMMENTID)
                        .onDeleteCascade())
                .execute();
        mysqlUtil.createIndexIfNotExists(mysql.createIndex().on(JooqCommentParentId.COMMENT_PARENT_ID, JooqCommentParentId.COMMENT_PARENT_ID.PROJECTID, JooqCommentParentId.COMMENT_PARENT_ID.POSTID));
        mysqlUtil.createFunctionIfNotExists(MysqlCustomFunction.WILSON);
    }

    @Extern
    public ListenableFuture<Void> createIndexElasticSearch(String projectId) {
        SettableFuture<Void> indexingFuture = SettableFuture.create();
        if (projectStore.getSearchEngineForProject(projectId).isWriteElastic()) {
            elastic.indices().createAsync(new CreateIndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId)).mapping(gson.toJson(ImmutableMap.of(
                            "dynamic", "false",
                            "properties", ImmutableMap.builder()
                                    .put("ideaId", ImmutableMap.of(
                                            "type", "keyword"))
                                    .put("parentCommentIds", ImmutableMap.of(
                                            "type", "keyword"))
                                    .put("level", ImmutableMap.of(
                                            "type", "integer"))
                                    .put("childCommentCount", ImmutableMap.of(
                                            "type", "integer"))
                                    .put("authorUserId", ImmutableMap.of(
                                            "type", "keyword"))
                                    .put("authorName", ImmutableMap.of(
                                            "type", "keyword"))
                                    .put("authorIsMod", ImmutableMap.of(
                                            "type", "boolean"))
                                    .put("created", ImmutableMap.of(
                                            "type", "date",
                                            "format", "epoch_second"))
                                    .put("edited", ImmutableMap.of(
                                            "type", "date",
                                            "format", "epoch_second"))
                                    .put("content", ImmutableMap.of(
                                            "type", "text",
                                            "index_prefixes", ImmutableMap.of()))
                                    .put("upvotes", ImmutableMap.of(
                                            "type", "integer"))
                                    .put("downvotes", ImmutableMap.of(
                                            "type", "integer"))
                                    .put("score", ImmutableMap.of(
                                            "type", "double"))
                                    .build())), XContentType.JSON),
                    RequestOptions.DEFAULT,
                    ActionListeners.fromFuture(indexingFuture, elasticUtil::isIndexAlreadyExistsException));
        } else {
            indexingFuture.set(null); // Nothing to do here
        }
        return indexingFuture;
    }

    @Extern
    @Override
    public void repopulateIndex(String projectId, boolean deleteExistingIndex, boolean repopulateElasticSearch, boolean repopulateMysql) throws Exception {
        log.info("Repopulating index for project {} deleteExistingIndex {} repopulateElasticSearch {} repopulateMysql {}",
                projectId, deleteExistingIndex, repopulateElasticSearch, repopulateMysql);
        if (repopulateElasticSearch) {
            boolean indexAlreadyExists = elastic.indices().exists(
                    new GetIndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId)),
                    RequestOptions.DEFAULT);
            if (indexAlreadyExists && deleteExistingIndex) {
                elastic.indices().delete(
                        new DeleteIndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId)),
                        RequestOptions.DEFAULT);
            }
            if (!indexAlreadyExists || deleteExistingIndex) {
                createIndexElasticSearch(projectId).get();
            }
        }
        if (repopulateMysql && deleteExistingIndex) {
            mysql.deleteFrom(JooqComment.COMMENT)
                    .where(JooqComment.COMMENT.PROJECTID.eq(projectId))
                    .execute();
        }

        StreamSupport.stream(commentByProjectIdSchema.index().query(new QuerySpec()
                                .withHashKey(commentByProjectIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(commentByProjectIdSchema.rangeKeyName())
                                        .beginsWith(commentByProjectIdSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(commentByProjectIdSchema::fromItem)
                .filter(comment -> projectId.equals(comment.getProjectId()))
                .forEach(comment -> {
                    if (repopulateElasticSearch) {
                        try {
                            elastic.index(commentToEsIndexRequest(comment), RequestOptions.DEFAULT);
                        } catch (IOException ex) {
                            if (LogUtil.rateLimitAllowLog("dynamoelasticcommentstore-reindex-failure")) {
                                log.warn("Failed to re-index comment id {} projectId {}", comment.getCommentId(), projectId, ex);
                            }
                        }
                    }
                    if (repopulateMysql) {
                        commentToMysqlQuery(comment).fetchMany();
                    }
                });
    }

    @Extern
    @Override
    public double computeCommentScore(int upvotes, int downvotes) {
        // https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
        return wilsonScoreInterval.lowerBound(
                upvotes + downvotes,
                upvotes);
    }

    @Override
    public CommentAndIndexingFuture<List<Void>> createCommentAndUpvote(CommentModel comment) {
        checkArgument(comment.getParentCommentIds().size() == comment.getLevel());

        VoteValue votePrev = voteStore.vote(comment.getProjectId(), comment.getAuthorUserId(), comment.getCommentId(), VoteValue.Upvote);
        CommentModel commentWithVote = comment.toBuilder()
                .upvotes(comment.getUpvotes() + 1).build();

        commentSchema.table().putItem(commentSchema.toItem(commentWithVote));
        Optional<SettableFuture<Void>> parentIndexingFutureOpt = Optional.empty();
        if (commentWithVote.getLevel() > 0) {
            String parentCommentId = commentWithVote.getParentCommentIds().get(commentWithVote.getParentCommentIds().size() - 1);
            long parentChildCommentCount = commentSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(commentSchema.primaryKey(ImmutableMap.of(
                                    "projectId", commentWithVote.getProjectId(),
                                    "ideaId", commentWithVote.getIdeaId(),
                                    "commentId", parentCommentId)))
                            .addAttributeUpdate(new AttributeUpdate("childCommentCount")
                                    .addNumeric(1))
                            .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem()
                    .getLong("childCommentCount");

            SettableFuture<Void> parentIndexingFuture = SettableFuture.create();
            SearchEngine searchEngine = projectStore.getSearchEngineForProject(commentWithVote.getProjectId());
            if (searchEngine.isWriteElastic()) {
                elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, commentWithVote.getProjectId()), parentCommentId)
                                .doc(gson.toJson(ImmutableMap.of(
                                        "childCommentCount", parentChildCommentCount
                                )), XContentType.JSON)
                                .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                        RequestOptions.DEFAULT,
                        searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(parentIndexingFuture, f -> indexComment(f, commentWithVote.getProjectId(), commentWithVote.getIdeaId(), commentWithVote.getCommentId()))
                                : ActionListeners.onFailureRetry(() -> indexComment(commentWithVote.getProjectId(), commentWithVote.getIdeaId(), commentWithVote.getCommentId())));
            }
            if (searchEngine.isWriteMysql()) {
                CompletionStage<Integer> completionStage = mysql.update(JooqComment.COMMENT)
                        .set(JooqComment.COMMENT.CHILDCOMMENTCOUNT, parentChildCommentCount)
                        .where(JooqComment.COMMENT.PROJECTID.eq(commentWithVote.getProjectId())
                                .and(JooqComment.COMMENT.POSTID.eq(commentWithVote.getIdeaId()))
                                .and(JooqComment.COMMENT.COMMENTID.eq(commentWithVote.getCommentId())))
                        .executeAsync();
                if (searchEngine.isReadMysql()) {
                    CompletionStageUtil.toSettableFuture(parentIndexingFuture, completionStage);
                } else {
                    CompletionStageUtil.logFailure(completionStage);
                }
            }

            parentIndexingFutureOpt = Optional.of(parentIndexingFuture);
        }

        IdeaAndIndexingFuture incrementResponse = ideaStore.incrementIdeaCommentCount(commentWithVote.getProjectId(), commentWithVote.getIdeaId(), commentWithVote.getLevel() == 0);

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        indexComment(indexingFuture, commentWithVote);

        ImmutableList.Builder<ListenableFuture<Void>> builder = ImmutableList.builder();
        builder.add(indexingFuture);
        builder.add(incrementResponse.getIndexingFuture());
        parentIndexingFutureOpt.ifPresent(builder::add);
        return new CommentAndIndexingFuture<>(commentWithVote, Futures.allAsList(builder.build()));
    }

    @Extern
    @Override
    public Optional<CommentModel> getComment(String projectId, String ideaId, String commentId) {
        return Optional.ofNullable(commentSchema.fromItem(commentSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(commentSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "ideaId", ideaId,
                        "commentId", commentId))))));
    }

    @Override
    public ImmutableMap<String, CommentModel> getComments(String projectId, String ideaId, Collection<String> commentIds) {
        if (commentIds.isEmpty()) {
            return ImmutableMap.of();
        }
        return singleTable.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(commentSchema.tableName())
                        .withPrimaryKeys(commentIds.stream()
                                .map(commentId -> commentSchema.primaryKey(ImmutableMap.of(
                                        "projectId", projectId,
                                        "ideaId", ideaId,
                                        "commentId", commentId)))
                                .toArray(PrimaryKey[]::new))))
                .map(i -> commentSchema.fromItem(i))
                .collect(ImmutableMap.toImmutableMap(
                        CommentModel::getCommentId,
                        i -> i));
    }

    @Override
    public HistogramResponse histogram(String projectId, HistogramSearchAdmin searchAdmin) {
        if (!config.enableHistograms()) {
            return new HistogramResponse(ImmutableList.of(), new Hits(0L, null));
        }

        if (projectStore.getSearchEngineForProject(projectId).isReadElastic()) {
            return elasticUtil.histogram(
                    elasticUtil.getIndexName(COMMENT_INDEX, projectId),
                    "created",
                    Optional.ofNullable(searchAdmin.getFilterCreatedStart()),
                    Optional.ofNullable(searchAdmin.getFilterCreatedEnd()),
                    Optional.ofNullable(searchAdmin.getInterval()),
                    Optional.empty());
        } else {
            return mysqlUtil.histogram(
                    JooqComment.COMMENT,
                    JooqComment.COMMENT.CREATED,
                    Optional.ofNullable(searchAdmin.getFilterCreatedStart()),
                    Optional.ofNullable(searchAdmin.getFilterCreatedEnd()),
                    Optional.ofNullable(searchAdmin.getInterval()),
                    Optional.empty());
        }
    }

    @Override
    public SearchCommentsResponse searchComments(String projectId, CommentSearchAdmin commentSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt) {
        Optional<SortOrder> sortOrderElasticOpt;
        org.jooq.SortOrder sortOrderMysql;
        if (commentSearchAdmin.getSortBy() != null) {
            switch (commentSearchAdmin.getSortOrder()) {
                case ASC:
                    sortOrderElasticOpt = Optional.of(SortOrder.ASC);
                    sortOrderMysql = org.jooq.SortOrder.ASC;
                    break;
                case DESC:
                    sortOrderElasticOpt = Optional.of(SortOrder.DESC);
                    sortOrderMysql = DESC;
                    break;
                default:
                    throw new ApiException(Response.Status.BAD_REQUEST,
                            "Sort order '" + commentSearchAdmin.getSortOrder() + "' not supported");
            }
        } else {
            sortOrderElasticOpt = Optional.empty();
            sortOrderMysql = org.jooq.SortOrder.DEFAULT;
        }

        final ImmutableList<String> sortFieldsElastic;
        final ImmutableList<SortField<?>> sortFieldsMysql;
        if (commentSearchAdmin.getSortBy() != null) {
            switch (commentSearchAdmin.getSortBy()) {
                case CREATED:
                    sortFieldsElastic = ImmutableList.of("created");
                    sortFieldsMysql = ImmutableList.of(JooqComment.COMMENT.CREATED.sort(sortOrderMysql));
                    break;
                case EDITED:
                    sortFieldsElastic = ImmutableList.of("edited");
                    sortFieldsMysql = ImmutableList.of(JooqComment.COMMENT.EDITED.sort(sortOrderMysql));
                    break;
                case TOP:
                    sortFieldsElastic = ImmutableList.of("score");
                    sortFieldsMysql = ImmutableList.of(JooqComment.COMMENT.SCORE.sort(sortOrderMysql));
                    break;
                default:
                    throw new ApiException(Response.Status.BAD_REQUEST,
                            "Sorting by '" + commentSearchAdmin.getSortBy() + "' not supported");
            }
        } else {
            sortFieldsElastic = ImmutableList.of();
            sortFieldsMysql = ImmutableList.of();
        }

        int pageSize = Math.max(1, Math.min(Math.min(Optional.ofNullable(commentSearchAdmin.getLimit()).orElse(10L).intValue(), DYNAMO_READ_BATCH_MAX_SIZE), 50));
        if (Strings.isNullOrEmpty(commentSearchAdmin.getSearchText())
                && Strings.isNullOrEmpty(commentSearchAdmin.getFilterAuthorId())
                && sortFieldsElastic.isEmpty()) {
            // If no search term, do a simple dynamo query
            Page<Item, QueryOutcome> page = commentByProjectIdSchema.index().query(new QuerySpec()
                            .withHashKey(commentByProjectIdSchema.partitionKey(Map.of(
                                    "projectId", projectId)))
                            .withRangeKeyCondition(new RangeKeyCondition(commentByProjectIdSchema.rangeKeyName())
                                    .beginsWith(commentByProjectIdSchema.rangeValuePartial(Map.of())))
                            .withMaxPageSize(pageSize)
                            .withScanIndexForward(SortOrder.DESC.equals(sortOrderElasticOpt.orElse(SortOrder.DESC)))
                            .withExclusiveStartKey(cursorOpt
                                    .map(serverSecretCursor::decryptString)
                                    .map(commentByProjectIdSchema::toExclusiveStartKey)
                                    .orElse(null)))
                    .firstPage();

            return new SearchCommentsResponse(
                    page.getLowLevelResult()
                            .getItems()
                            .stream()
                            .map(item -> commentByProjectIdSchema.fromItem(item))
                            .collect(ImmutableList.toImmutableList()),
                    Optional.ofNullable(page.getLowLevelResult()
                                    .getQueryResult()
                                    .getLastEvaluatedKey())
                            .map(commentByProjectIdSchema::serializeLastEvaluatedKey)
                            .map(serverSecretCursor::encryptString));
        } else {
            // For complex searches, fallback to elasticsearch/mysql
            final PrimaryKey[] primaryKeys;
            final Optional<String> nextCursorOpt;
            if (projectStore.getSearchEngineForProject(projectId).isReadElastic()) {
                BoolQueryBuilder queryBuilder = QueryBuilders.boolQuery();
                if (!Strings.isNullOrEmpty(commentSearchAdmin.getFilterAuthorId())) {
                    queryBuilder.must(QueryBuilders.termQuery("authorUserId", commentSearchAdmin.getFilterAuthorId()));
                }
                if (!Strings.isNullOrEmpty(commentSearchAdmin.getSearchText())) {
                    queryBuilder.must(QueryBuilders.multiMatchQuery(commentSearchAdmin.getSearchText(), "content", "authorName")
                            .fuzziness("AUTO").zeroTermsQuery(ZeroTermsQueryOption.ALL));
                }
                log.trace("Comment search query: {}", queryBuilder);
                ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(
                        new SearchRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId))
                                .source(new SearchSourceBuilder()
                                        .fetchSource(true)
                                        .query(queryBuilder)),
                        cursorOpt, sortFieldsElastic, sortOrderElasticOpt, useAccurateCursor, Optional.of(pageSize), configSearch, ImmutableSet.of("ideaId"));

                SearchHit[] hits = searchResponseWithCursor.getSearchResponse().getHits().getHits();
                primaryKeys = Arrays.stream(hits)
                        .map(hit -> commentSchema.primaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "ideaId", hit.getSourceAsMap().get("ideaId"),
                                "commentId", hit.getId())))
                        .toArray(PrimaryKey[]::new);
                nextCursorOpt = searchResponseWithCursor.getCursorOpt();
            } else {
                Optional<Condition> conditionFilterAuthorIdOpt = Optional.ofNullable(Strings.emptyToNull(commentSearchAdmin.getFilterAuthorId()))
                        .map(JooqComment.COMMENT.AUTHORUSERID::eq);

                Optional<Condition> conditionSearchTextOpt = Optional.ofNullable(Strings.emptyToNull(commentSearchAdmin.getSearchText()))
                        .map(searchText -> JooqComment.COMMENT.CONTENT.like("%" + searchText + "%")
                                .or(JooqComment.COMMENT.AUTHORNAME.like("%" + searchText + "%")));
                primaryKeys = mysql.select(JooqComment.COMMENT.POSTID, JooqComment.COMMENT.COMMENTID)
                        .from(JooqComment.COMMENT)
                        .where(mysqlUtil.and(mysqlUtil.and(
                                        conditionSearchTextOpt,
                                        conditionFilterAuthorIdOpt),
                                JooqComment.COMMENT.PROJECTID.eq(projectId)))
                        .orderBy(sortFieldsMysql)
                        .offset(mysqlUtil.offset(cursorOpt))
                        .limit(mysqlUtil.limit(configSearch, Optional.empty()))
                        .stream()
                        .map(hit -> commentSchema.primaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "ideaId", hit.component1(),
                                "commentId", hit.component2())))
                        .toArray(PrimaryKey[]::new);
                nextCursorOpt = mysqlUtil.nextCursor(configSearch, cursorOpt, Optional.empty(), primaryKeys.length);
            }

            if (primaryKeys.length == 0) {
                return new SearchCommentsResponse(ImmutableList.of(), cursorOpt);
            }

            ImmutableList<CommentModel> comments = singleTable.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(commentSchema.tableName())
                            .withPrimaryKeys(primaryKeys)))
                    .map(i -> commentSchema.fromItem(i))
                    .collect(ImmutableList.toImmutableList());

            return new SearchCommentsResponse(comments, nextCursorOpt);
        }
    }

    @Override
    public ImmutableSet<CommentModel> getCommentsForPost(String projectId, String ideaId, ImmutableSet<String> mergedPostIds, Optional<String> parentCommentIdOpt, ImmutableSet<String> excludeChildrenCommentIds) {
        // If we have a post with merged posts, we need to query them individually
        Map<String, Set<String>> postIdToCommentIds = Maps.newHashMap();

        boolean isInitial = !parentCommentIdOpt.isPresent() && excludeChildrenCommentIds.isEmpty();
        int fetchMax = isInitial
                ? config.searchInitialFetchMax()
                : config.searchSubsequentFetchMax();

        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isReadElastic()) {
            BoolQueryBuilder queryBuilder = QueryBuilders.boolQuery();
            if (parentCommentIdOpt.isPresent() && mergedPostIds.contains(parentCommentIdOpt.get())) {
                // parent comment id is actually a merged post
                queryBuilder.must(QueryBuilders.termQuery("ideaId", parentCommentIdOpt.get()));
            } else {
                if (mergedPostIds.isEmpty()) {
                    queryBuilder.must(QueryBuilders.termQuery("ideaId", ideaId));
                } else {
                    queryBuilder.must(QueryBuilders.termsQuery("ideaId", Stream.concat(Stream.of(ideaId), mergedPostIds.stream()).toArray()));
                }
                parentCommentIdOpt.ifPresent(parentCommentId -> queryBuilder.must(QueryBuilders
                        .termQuery("parentCommentIds", parentCommentId)));
            }
            excludeChildrenCommentIds.forEach(excludeChildrenCommentId -> {
                if (mergedPostIds.contains(excludeChildrenCommentId)) {
                    return; // comment id is actually a merged post id
                }
                queryBuilder.mustNot(QueryBuilders
                        .termQuery("commentId", excludeChildrenCommentId));
            });
            int searchInitialDepthLimit = config.searchInitialDepthLimit();
            if (isInitial && searchInitialDepthLimit >= 0) {
                queryBuilder.must(QueryBuilders
                        .rangeQuery("level").lt(searchInitialDepthLimit));
            }
            log.trace("Comment search query: {}", queryBuilder);
            SearchRequest searchRequest = new SearchRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId))
                    .source(new SearchSourceBuilder()
                            .fetchSource(false)
                            .fetchField("parentCommentIds")
                            .fetchField("ideaId")
                            .size(fetchMax)
                            .sort("score", SortOrder.DESC)
                            .sort("upvotes", SortOrder.DESC)
                            .sort("downvotes", SortOrder.ASC)
                            .sort("created", SortOrder.ASC)
                            .query(queryBuilder));

            SearchResponse searchResponse;
            searchResponse = elasticUtil.retry(() -> elastic.search(searchRequest, RequestOptions.DEFAULT));

            for (SearchHit hit : searchResponse.getHits().getHits()) {
                String postId = hit.field("ideaId").getValue();

                Set<String> commentIds = postIdToCommentIds.computeIfAbsent(postId, k -> Sets.newHashSet());

                // Add our comment to the corresponding post
                commentIds.add(hit.getId());

                // Include all parent comments as well
                DocumentField parentCommentIds = hit.field("parentCommentIds");
                if (parentCommentIds != null && !parentCommentIds.getValues().isEmpty()) {
                    // parentCommentIds must be a list of Strings
                    List<String> values = (List<String>) (Object) parentCommentIds.getValues();
                    commentIds.addAll(values);
                }
            }
        } else {
            Condition conditions = DSL.noCondition();
            Table table = JooqComment.COMMENT;
            List<SelectField> selectFields = Lists.newArrayList(JooqComment.COMMENT.POSTID, JooqComment.COMMENT.COMMENTID);
            if (parentCommentIdOpt.isPresent() && mergedPostIds.contains(parentCommentIdOpt.get())) {
                // parent comment id is actually a merged post
                conditions = conditions.and(JooqComment.COMMENT.POSTID.eq(parentCommentIdOpt.get()));
            } else {
                if (mergedPostIds.isEmpty()) {
                    conditions = conditions.and(JooqComment.COMMENT.POSTID.eq(ideaId));
                } else {
                    conditions = conditions.and(JooqComment.COMMENT.POSTID.in(Stream.concat(Stream.of(ideaId), mergedPostIds.stream()).toArray(String[]::new)));
                }
                if (parentCommentIdOpt.isPresent()) {
                    table = JooqComment.COMMENT.join(JooqCommentParentId.COMMENT_PARENT_ID, JoinType.JOIN);
                    selectFields.add(JooqCommentParentId.COMMENT_PARENT_ID.PARENTCOMMENTID);
                    conditions = conditions.and(JooqCommentParentId.COMMENT_PARENT_ID.PARENTCOMMENTID.eq(parentCommentIdOpt.get()));
                }
            }
            if (!excludeChildrenCommentIds.isEmpty()) {
                conditions = conditions.and(JooqComment.COMMENT.COMMENTID.notIn(excludeChildrenCommentIds.stream()
                        // Filter out comments which are actually merged post ids
                        .filter(Predicate.not(mergedPostIds::contains))
                        .toArray(String[]::new)));
            }
            int searchInitialDepthLimit = config.searchInitialDepthLimit();
            if (isInitial && searchInitialDepthLimit >= 0) {
                conditions = conditions.and(JooqComment.COMMENT.LEVEL.lt((long) searchInitialDepthLimit));
            }

            mysql.selectDistinct(selectFields)
                    .from(table)
                    .where(conditions)
                    .orderBy(
                            JooqComment.COMMENT.SCORE.sort(DESC),
                            JooqComment.COMMENT.UPVOTES.sort(DESC),
                            JooqComment.COMMENT.DOWNVOTES.sort(ASC),
                            JooqComment.COMMENT.CREATED.sort(DESC))
                    .limit(fetchMax)
                    .forEach(record -> {
                        String postId = record.get(0, String.class);
                        Set<String> commentIds = postIdToCommentIds.computeIfAbsent(postId, Sets::newHashSet);
                        record.intoStream()
                                .skip(1) // First record is post id
                                .filter(Objects::nonNull)
                                .map(val -> (String) val)
                                .forEach(commentIds::add);
                    });
        }

        return postIdToCommentIds.entrySet().stream()
                .flatMap(e -> getComments(projectId, e.getKey(), e.getValue()).values().stream())
                .collect(ImmutableSet.toImmutableSet());
    }

    @Override
    public void exportAllForProject(String projectId, Consumer<CommentModel> consumer) {
        StreamSupport.stream(commentByProjectIdSchema.index().query(new QuerySpec()
                                .withHashKey(commentByProjectIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(commentByProjectIdSchema.rangeKeyName())
                                        .beginsWith(commentByProjectIdSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(commentByProjectIdSchema::fromItem)
                .filter(comment -> projectId.equals(comment.getProjectId()))
                .forEach(consumer);
    }

    @Override
    public CommentAndIndexingFuture<Void> updateComment(String projectId, String ideaId, String commentId, Instant updated, CommentUpdate commentUpdate) {
        CommentModel comment = commentSchema.fromItem(commentSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(commentSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId,
                                "commentId", commentId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .addAttributeUpdate(new AttributeUpdate("edited")
                                .put(commentSchema.toDynamoValue("edited", updated)))
                        .addAttributeUpdate(new AttributeUpdate("content")
                                .put(commentSchema.toDynamoValue("content", commentUpdate.getContent()))))
                .getItem());

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "edited", comment.getEdited().getEpochSecond(),
                                    "content", comment.getContentAsText(sanitizer)
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexComment(f, comment.getProjectId(), comment.getIdeaId(), comment.getCommentId()))
                            : ActionListeners.onFailureRetry(() -> indexComment(comment.getProjectId(), comment.getIdeaId(), comment.getCommentId())));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.update(JooqComment.COMMENT)
                    .set(JooqComment.COMMENT.EDITED, comment.getEdited())
                    .set(JooqComment.COMMENT.CONTENT, comment.getContentAsText(sanitizer))
                    .where(JooqComment.COMMENT.PROJECTID.eq(comment.getProjectId())
                            .and(JooqComment.COMMENT.POSTID.eq(comment.getIdeaId()))
                            .and(JooqComment.COMMENT.COMMENTID.eq(comment.getCommentId())))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Override
    public CommentAndIndexingFuture<Void> voteComment(String projectId, String ideaId, String commentId, String userId, VoteValue vote) {
        VoteValue votePrev = voteStore.vote(projectId, userId, commentId, vote);
        if (vote == votePrev) {
            return new CommentAndIndexingFuture<>(getComment(projectId, ideaId, commentId).orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Comment not found")), Futures.immediateFuture(null));
        }

        ImmutableList.Builder<AttributeUpdate> attrUpdatesBuilder = ImmutableList.builder();
        ImmutableList.Builder<String> updateExpressionBuilder = ImmutableList.builder();
        int upvoteDiff = 0;
        int downvoteDiff = 0;
        switch (votePrev) {
            case Upvote:
                attrUpdatesBuilder.add(new AttributeUpdate("upvotes").addNumeric(-1));
                upvoteDiff--;
                break;
            case Downvote:
                attrUpdatesBuilder.add(new AttributeUpdate("downvotes").addNumeric(-1));
                downvoteDiff--;
                break;
            case None:
                break;
            default:
                throw new RuntimeException("Unknown vote type: " + votePrev);
        }
        switch (vote) {
            case Upvote:
                attrUpdatesBuilder.add(new AttributeUpdate("upvotes").addNumeric(1));
                upvoteDiff++;
                break;
            case Downvote:
                attrUpdatesBuilder.add(new AttributeUpdate("downvotes").addNumeric(1));
                downvoteDiff++;
                break;
            case None:
                break;
            default:
                throw new RuntimeException("Unknown vote type: " + vote);
        }
        CommentModel comment = commentSchema.fromItem(commentSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(commentSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId,
                                "commentId", commentId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .withAttributeUpdate(attrUpdatesBuilder.build()))
                .getItem());

        if (!userId.equals(comment.getAuthorUserId())) {
            userStore.userCommentVoteUpdateBloom(projectId, userId, commentId);
        }

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                            .script(ElasticScript.WILSON.toScript(ImmutableMap.of(
                                    "upvoteDiff", upvoteDiff,
                                    "downvoteDiff", downvoteDiff,
                                    "z", wilsonScoreInterval.getZ())))
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexComment(f, comment.getProjectId(), comment.getIdeaId(), comment.getCommentId()))
                            : ActionListeners.onFailureRetry(() -> indexComment(comment.getProjectId(), comment.getIdeaId(), comment.getCommentId())));
        }
        if (searchEngine.isWriteMysql()) {
            JooqVoteWilson voteWilsonRoutine = new JooqVoteWilson();
            voteWilsonRoutine.setUpvotes(JooqComment.COMMENT.UPVOTES.plus(upvoteDiff));
            voteWilsonRoutine.setDownvotes(JooqComment.COMMENT.DOWNVOTES.plus(downvoteDiff));
            voteWilsonRoutine.setZ(wilsonScoreInterval.getZ());
            voteWilsonRoutine.setZsquared(wilsonScoreInterval.getZSquared());

            CompletionStage<Integer> completionStage = mysql.update(JooqComment.COMMENT)
                    .set(JooqComment.COMMENT.SCORE, voteWilsonRoutine.asField())
                    .where(JooqComment.COMMENT.PROJECTID.eq(comment.getProjectId())
                            .and(JooqComment.COMMENT.POSTID.eq(comment.getIdeaId()))
                            .and(JooqComment.COMMENT.COMMENTID.eq(comment.getCommentId())))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Extern
    @Override
    public CommentAndIndexingFuture<Void> markAsDeletedComment(String projectId, String ideaId, String commentId) {
        Expression expression = commentSchema.expressionBuilder()
                .conditionExists()
                .remove("authorUserId")
                .remove("authorName")
                .remove("content")
                .set("edited", Instant.now())
                .build();
        CommentModel comment = commentSchema.fromItem(commentSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(commentSchema.primaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "ideaId", ideaId,
                                "commentId", commentId)))
                        .withReturnValues(ReturnValue.ALL_NEW)
                        .withUpdateExpression(expression.updateExpression().orElse(null))
                        .withConditionExpression(expression.conditionExpression().orElse(null))
                        .withNameMap(expression.nameMap().orElse(null))
                        .withValueMap(expression.valMap().orElse(null)))
                .getItem());

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            // Use a hashmap to allow null values
            Map<String, Object> updates = Maps.newHashMap();
            updates.put("authorUserId", null);
            updates.put("authorName", null);
            updates.put("content", null);
            updates.put("edited", comment.getEdited().getEpochSecond());
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                            .doc(gson.toJson(updates), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexComment(f, comment.getProjectId(), comment.getIdeaId(), comment.getCommentId()))
                            : ActionListeners.onFailureRetry(() -> indexComment(comment.getProjectId(), comment.getIdeaId(), comment.getCommentId())));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.update(JooqComment.COMMENT)
                    .set(JooqComment.COMMENT.AUTHORUSERID, (String) null)
                    .set(JooqComment.COMMENT.AUTHORNAME, (String) null)
                    .set(JooqComment.COMMENT.AUTHORISMOD, (Boolean) null)
                    .set(JooqComment.COMMENT.CONTENT, (String) null)
                    .set(JooqComment.COMMENT.EDITED, comment.getEdited())
                    .where(JooqComment.COMMENT.PROJECTID.eq(comment.getProjectId())
                            .and(JooqComment.COMMENT.POSTID.eq(comment.getIdeaId()))
                            .and(JooqComment.COMMENT.COMMENTID.eq(comment.getCommentId())))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Extern
    @Override
    public ListenableFuture<Void> deleteComment(String projectId, String ideaId, String commentId) {
        // TODO update childCommentCount for all parents
        commentSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(commentSchema.primaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId,
                        "commentId", commentId))));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.deleteAsync(new DeleteRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexComment(f, projectId, ideaId, commentId))
                            : ActionListeners.onFailureRetry(() -> indexComment(projectId, ideaId, commentId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.delete(JooqComment.COMMENT)
                    .where(JooqComment.COMMENT.PROJECTID.eq(projectId)
                            .and(JooqComment.COMMENT.POSTID.eq(ideaId))
                            .and(JooqComment.COMMENT.COMMENTID.eq(commentId)))
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
    public ListenableFuture<Void> deleteCommentsForIdea(String projectId, String ideaId) {
        Iterables.partition(StreamSupport.stream(commentSchema.table().query(new QuerySpec()
                                        .withHashKey(commentSchema.partitionKey(Map.of(
                                                "ideaId", ideaId,
                                                "projectId", projectId)))
                                        .withRangeKeyCondition(new RangeKeyCondition(commentSchema.rangeKeyName())
                                                .beginsWith(commentSchema.rangeValuePartial(Map.of()))))
                                .pages()
                                .spliterator(), false)
                        .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                        .map(commentSchema::fromItem)
                        .map(CommentModel::getCommentId)
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(commentIdsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(commentSchema.tableName());
                    commentIdsBatch.stream()
                            .map(commentId -> commentSchema.primaryKey(Map.of(
                                    "ideaId", ideaId,
                                    "projectId", projectId,
                                    "commentId", commentId)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.deleteByQueryAsync(new DeleteByQueryRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId))
                            .setQuery(QueryBuilders.termQuery("ideaId", ideaId)),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.delete(JooqComment.COMMENT)
                    .where(JooqComment.COMMENT.PROJECTID.eq(projectId)
                            .and(JooqComment.COMMENT.POSTID.eq(ideaId)))
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
        // Delete comments
        Iterables.partition(StreamSupport.stream(commentByProjectIdSchema.index().query(new QuerySpec()
                                        .withHashKey(commentByProjectIdSchema.partitionKey(Map.of(
                                                "projectId", projectId)))
                                        .withRangeKeyCondition(new RangeKeyCondition(commentByProjectIdSchema.rangeKeyName())
                                                .beginsWith(commentByProjectIdSchema.rangeValuePartial(Map.of()))))
                                .pages()
                                .spliterator(), false)
                        .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                        .map(commentByProjectIdSchema::fromItem)
                        .filter(comment -> projectId.equals(comment.getProjectId()))
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(commentsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(commentSchema.tableName());
                    commentsBatch.stream()
                            .map(comment -> commentSchema.primaryKey(Map.of(
                                    "ideaId", comment.getIdeaId(),
                                    "projectId", projectId,
                                    "commentId", comment.getCommentId())))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete idea index
        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        if (searchEngine.isWriteElastic()) {
            elastic.indices().deleteAsync(new DeleteIndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId)),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.delete(JooqComment.COMMENT)
                    .where(JooqComment.COMMENT.PROJECTID.eq(projectId))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return indexingFuture;
    }

    private void indexComment(String projectId, String ideaId, String commentId) {
        indexComment(SettableFuture.create(), projectId, ideaId, commentId);
    }

    private void indexComment(SettableFuture<Void> indexingFuture, String projectId, String ideaId, String commentId) {
        Optional<CommentModel> commentOpt = getComment(projectId, ideaId, commentId);
        if (!commentOpt.isPresent()) {
            SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
            if (searchEngine.isWriteElastic()) {
                elastic.deleteAsync(new DeleteRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId),
                        RequestOptions.DEFAULT,
                        searchEngine.isReadElastic()
                                ? ActionListeners.fromFuture(indexingFuture)
                                : ActionListeners.logFailure());
            }
            if (searchEngine.isWriteMysql()) {
                CompletionStage<Integer> completionStage = mysql.deleteFrom(JooqComment.COMMENT)
                        .where(JooqComment.COMMENT.PROJECTID.eq(projectId)
                                .and(JooqComment.COMMENT.POSTID.eq(ideaId))
                                .and(JooqComment.COMMENT.COMMENTID.eq(commentId)))
                        .executeAsync();
                if (searchEngine.isReadMysql()) {
                    CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
                } else {
                    CompletionStageUtil.logFailure(completionStage);
                }
            }
        } else {
            indexComment(indexingFuture, commentOpt.get());
        }
    }

    private void indexComment(CommentModel comment) {
        indexComment(SettableFuture.create(), comment);
    }

    private void indexComment(SettableFuture<Void> indexingFuture, CommentModel comment) {
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(comment.getProjectId());
        if (searchEngine.isWriteElastic()) {
            elastic.indexAsync(commentToEsIndexRequest(comment),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic()
                            ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysqlUtil.sequentialBatch(commentToMysqlQuery(comment));
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }
    }

    private Queries commentToMysqlQuery(CommentModel comment) {
        JooqCommentRecord commentRecord = JooqComment.COMMENT.newRecord().values(
                comment.getProjectId(),
                comment.getIdeaId(),
                comment.getCommentId(),
                (long) comment.getLevel(),
                comment.getChildCommentCount(),
                comment.getAuthorUserId(),
                comment.getAuthorName(),
                comment.getAuthorIsMod(),
                comment.getCreated(),
                comment.getEdited(),
                comment.getContentAsText(sanitizer),
                (long) comment.getUpvotes(),
                (long) comment.getDownvotes(),
                computeCommentScore(comment.getUpvotes(), comment.getDownvotes()));

        Stream<JooqCommentParentIdRecord> parentCommentIdRecords = comment.getParentCommentIds().stream()
                .map(commentParentId -> JooqCommentParentId.COMMENT_PARENT_ID.newRecord().values(
                        comment.getProjectId(),
                        comment.getIdeaId(),
                        comment.getCommentId(),
                        commentParentId));

        return mysql.queries(Stream.concat(Stream.of(mysql.insertInto(JooqComment.COMMENT, JooqComment.COMMENT.fields())
                                .values(commentRecord)
                                .onDuplicateKeyUpdate()
                                .set(commentRecord)),
                        parentCommentIdRecords.map(parentCommentIdRecord -> mysql.insertInto(JooqCommentParentId.COMMENT_PARENT_ID, JooqCommentParentId.COMMENT_PARENT_ID.fields())
                                .values(parentCommentIdRecord)
                                .onDuplicateKeyUpdate()
                                .set(parentCommentIdRecord)))
                .collect(Collectors.toList()));
    }

    private IndexRequest commentToEsIndexRequest(CommentModel comment) {
        return new IndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, comment.getProjectId()))
                .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                .id(comment.getCommentId())
                .source(gson.toJson(ImmutableMap.builder()
                        .put("ideaId", comment.getIdeaId())
                        .put("parentCommentIds", comment.getParentCommentIds())
                        .put("level", comment.getLevel())
                        .put("childCommentCount", comment.getChildCommentCount())
                        .put("authorUserId", orNull(comment.getAuthorUserId()))
                        .put("authorName", orNull(comment.getAuthorName()))
                        .put("authorIsMod", orNull(comment.getAuthorIsMod()))
                        .put("created", comment.getCreated().getEpochSecond())
                        .put("edited", orNull(comment.getEdited() == null ? null : comment.getEdited().getEpochSecond()))
                        .put("content", orNull(comment.getContentAsText(sanitizer)))
                        .put("upvotes", comment.getUpvotes())
                        .put("downvotes", comment.getDownvotes())
                        .put("score", computeCommentScore(comment.getUpvotes(), comment.getDownvotes()))
                        .build()), XContentType.JSON);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(CommentStore.class).to(DynamoElasticCommentStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                install(ConfigSystem.configModule(ElasticUtil.ConfigSearch.class, Names.named("comment")));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoElasticCommentStore.class).asEagerSingleton();
            }
        };
    }
}
