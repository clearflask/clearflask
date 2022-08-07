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
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.CommentSearchAdmin;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramSearchAdmin;
import com.smotana.clearflask.api.model.Hits;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.DynamoUtil;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.Expression;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.ElasticScript;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.util.WilsonScoreInterval;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.support.WriteResponse;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.client.indices.GetIndexRequest;
import org.elasticsearch.common.document.DocumentField;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.ZeroTermsQueryOption;
import org.elasticsearch.index.reindex.BulkByScrollResponse;
import org.elasticsearch.index.reindex.DeleteByQueryRequest;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import rx.Observable;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_READ_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.util.ExplicitNull.orNull;

@Slf4j
@Singleton
public class DynamoElasticCommentStore implements CommentStore {

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

    @Inject
    private Config config;
    @Inject
    @Named("comment")
    private ElasticUtil.ConfigSearch configSearch;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    private DynamoUtil dynamoUtil;
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
    private Sanitizer sanitizer;

    private TableSchema<CommentModel> commentSchema;
    private IndexSchema<CommentModel> commentByProjectIdSchema;
    private WilsonScoreInterval wilsonScoreInterval;

    @Inject
    private void setup() {
        commentSchema = dynamoMapper.parseTableSchema(CommentModel.class);
        commentByProjectIdSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(2, CommentModel.class);

        config.scoreWilsonConfidenceLevelObservable().subscribe(scoreWilsonConfidenceLevel -> wilsonScoreInterval =
                new WilsonScoreInterval(scoreWilsonConfidenceLevel));
        wilsonScoreInterval = new WilsonScoreInterval(config.scoreWilsonConfidenceLevel());
    }

    @Override
    public ListenableFuture<Optional<CreateIndexResponse>> createIndex(String projectId) {
        SettableFuture<Optional<CreateIndexResponse>> indexingFuture = SettableFuture.create();
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
        return indexingFuture;
    }

    @Extern
    @Override
    public void reindex(String projectId, boolean deleteExistingIndex) throws Exception {
        boolean indexAlreadyExists = elastic.indices().exists(
                new GetIndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId)),
                RequestOptions.DEFAULT);
        if (indexAlreadyExists && deleteExistingIndex) {
            elastic.indices().delete(
                    new DeleteIndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId)),
                    RequestOptions.DEFAULT);
        }
        if (!indexAlreadyExists || deleteExistingIndex) {
            createIndex(projectId).get();
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
                .forEach(comment -> elastic.indexAsync(commentToEsIndexRequest(comment),
                        RequestOptions.DEFAULT, ActionListeners.onFailure(ex -> {
                            if (LogUtil.rateLimitAllowLog("dynamoelasticcommentstore-reindex-failure")) {
                                log.warn("Failed to re-index comment {}", comment.getCommentId(), ex);
                            }
                        })));
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
    public CommentAndIndexingFuture<List<WriteResponse>> createCommentAndUpvote(CommentModel comment) {
        checkArgument(comment.getParentCommentIds().size() == comment.getLevel());

        VoteValue votePrev = voteStore.vote(comment.getProjectId(), comment.getAuthorUserId(), comment.getCommentId(), VoteValue.Upvote);
        CommentModel commentWithVote = comment.toBuilder()
                .upvotes(comment.getUpvotes() + 1).build();

        commentSchema.table().putItem(commentSchema.toItem(commentWithVote));
        Optional<SettableFuture<WriteResponse>> parentIndexingFutureOpt = Optional.empty();
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

            SettableFuture<WriteResponse> parentIndexingFuture = SettableFuture.create();
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, commentWithVote.getProjectId()), parentCommentId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "childCommentCount", parentChildCommentCount
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    ActionListeners.onFailureRetry(parentIndexingFuture, f -> indexComment(f, commentWithVote.getProjectId(), commentWithVote.getIdeaId(), commentWithVote.getCommentId())));

            parentIndexingFutureOpt = Optional.of(parentIndexingFuture);
        }

        IdeaAndIndexingFuture incrementResponse = ideaStore.incrementIdeaCommentCount(commentWithVote.getProjectId(), commentWithVote.getIdeaId(), commentWithVote.getLevel() == 0);

        SettableFuture<WriteResponse> indexingFuture = SettableFuture.create();
        indexComment(indexingFuture, commentWithVote);

        ImmutableList.Builder<ListenableFuture<? extends WriteResponse>> builder = ImmutableList.builder();
        builder.add(indexingFuture);
        builder.add(incrementResponse.getIndexingFuture());
        parentIndexingFutureOpt.ifPresent(builder::add);
        return new CommentAndIndexingFuture(commentWithVote, Futures.allAsList(builder.build()));
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
        return dynamoUtil.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(commentSchema.tableName())
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

        return elasticUtil.histogram(
                elasticUtil.getIndexName(COMMENT_INDEX, projectId),
                "created",
                Optional.ofNullable(searchAdmin.getFilterCreatedStart()),
                Optional.ofNullable(searchAdmin.getFilterCreatedEnd()),
                Optional.ofNullable(searchAdmin.getInterval()),
                Optional.empty());
    }

    @Override
    public SearchCommentsResponse searchComments(String projectId, CommentSearchAdmin commentSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt) {
        Optional<SortOrder> sortOrderOpt;
        if (commentSearchAdmin.getSortBy() != null) {
            switch (commentSearchAdmin.getSortOrder()) {
                case ASC:
                    sortOrderOpt = Optional.of(SortOrder.ASC);
                    break;
                case DESC:
                    sortOrderOpt = Optional.of(SortOrder.DESC);
                    break;
                default:
                    throw new ApiException(Response.Status.BAD_REQUEST,
                            "Sort order '" + commentSearchAdmin.getSortOrder() + "' not supported");
            }
        } else {
            sortOrderOpt = Optional.empty();
        }

        ImmutableList<String> sortFields;
        if (commentSearchAdmin.getSortBy() != null) {
            switch (commentSearchAdmin.getSortBy()) {
                case CREATED:
                    sortFields = ImmutableList.of("created");
                    break;
                case EDITED:
                    sortFields = ImmutableList.of("edited");
                    break;
                case TOP:
                    sortFields = ImmutableList.of("score");
                    break;
                default:
                    throw new ApiException(Response.Status.BAD_REQUEST,
                            "Sorting by '" + commentSearchAdmin.getSortBy() + "' not supported");
            }
        } else {
            sortFields = ImmutableList.of();
        }

        int pageSize = Math.max(1, Math.min(Math.min(Optional.ofNullable(commentSearchAdmin.getLimit()).orElse(10L).intValue(), DYNAMO_READ_BATCH_MAX_SIZE), 50));
        if (Strings.isNullOrEmpty(commentSearchAdmin.getSearchText())
                && Strings.isNullOrEmpty(commentSearchAdmin.getFilterAuthorId())
                && sortFields.isEmpty()) {
            // If no search term, do a simple dynamo query
            Page<Item, QueryOutcome> page = commentByProjectIdSchema.index().query(new QuerySpec()
                            .withHashKey(commentByProjectIdSchema.partitionKey(Map.of(
                                    "projectId", projectId)))
                            .withRangeKeyCondition(new RangeKeyCondition(commentByProjectIdSchema.rangeKeyName())
                                    .beginsWith(commentByProjectIdSchema.rangeValuePartial(Map.of())))
                            .withMaxPageSize(pageSize)
                            .withScanIndexForward(SortOrder.DESC.equals(sortOrderOpt.orElse(SortOrder.DESC)))
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
            // For complex searches, fallback to elasticsearch
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
                    cursorOpt, sortFields, sortOrderOpt, useAccurateCursor, Optional.of(pageSize), configSearch, ImmutableSet.of("ideaId"));

            SearchHit[] hits = searchResponseWithCursor.getSearchResponse().getHits().getHits();
            if (hits.length == 0) {
                return new SearchCommentsResponse(ImmutableList.of(), Optional.empty());
            }

            ImmutableList<CommentModel> comments = dynamoUtil.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(commentSchema.tableName())
                            .withPrimaryKeys(Arrays.stream(hits)
                                    .map(hit -> commentSchema.primaryKey(ImmutableMap.of(
                                            "projectId", projectId,
                                            "ideaId", hit.getSourceAsMap().get("ideaId"),
                                            "commentId", hit.getId())))
                                    .toArray(PrimaryKey[]::new))))
                    .map(i -> commentSchema.fromItem(i))
                    .collect(ImmutableList.toImmutableList());

            return new SearchCommentsResponse(comments, searchResponseWithCursor.getCursorOpt());
        }
    }

    @Override
    public ImmutableSet<CommentModel> getCommentsForPost(String projectId, String ideaId, ImmutableSet<String> mergedPostIds, Optional<String> parentCommentIdOpt, ImmutableSet<String> excludeChildrenCommentIds) {
        boolean isInitial = !parentCommentIdOpt.isPresent() && excludeChildrenCommentIds.isEmpty();
        int fetchMax = isInitial
                ? config.searchInitialFetchMax()
                : config.searchSubsequentFetchMax();
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
                        .sort("created", SortOrder.ASC)
                        .query(queryBuilder));

        SearchResponse searchResponse;
        try {
            searchResponse = elastic.search(searchRequest, RequestOptions.DEFAULT);
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }

        // If we have a post with merged posts, we need to query them individually
        Map<String, Set<String>> postIdToCommentIds = Maps.newHashMap();

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
    public CommentAndIndexingFuture<WriteResponse> updateComment(String projectId, String ideaId, String commentId, Instant updated, CommentUpdate commentUpdate) {
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

        SettableFuture<WriteResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                        .doc(gson.toJson(ImmutableMap.of(
                                "edited", comment.getEdited().getEpochSecond(),
                                "content", sanitizer.richHtmlToPlaintext(comment.getContentAsText(sanitizer))
                        )), XContentType.JSON)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT,
                ActionListeners.onFailureRetry(indexingFuture, f -> indexComment(f, comment.getProjectId(), comment.getIdeaId(), comment.getCommentId())));

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Override
    public CommentAndIndexingFuture<WriteResponse> voteComment(String projectId, String ideaId, String commentId, String userId, VoteValue vote) {
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

        SettableFuture<WriteResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                        .script(ElasticScript.WILSON.toScript(ImmutableMap.of(
                                "upvoteDiff", upvoteDiff,
                                "downvoteDiff", downvoteDiff,
                                "z", wilsonScoreInterval.getZ())))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT,
                ActionListeners.onFailureRetry(indexingFuture, f -> indexComment(f, comment.getProjectId(), comment.getIdeaId(), comment.getCommentId())));

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Extern
    @Override
    public CommentAndIndexingFuture<WriteResponse> markAsDeletedComment(String projectId, String ideaId, String commentId) {
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

        HashMap<String, Object> updates = Maps.newHashMap();
        updates.put("authorUserId", null);
        updates.put("authorName", null);
        updates.put("content", null);
        updates.put("edited", comment.getEdited().getEpochSecond());
        SettableFuture<WriteResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                        .doc(gson.toJson(updates), XContentType.JSON)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT,
                ActionListeners.onFailureRetry(indexingFuture, f -> indexComment(f, comment.getProjectId(), comment.getIdeaId(), comment.getCommentId())));

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Extern
    @Override
    public ListenableFuture<DeleteResponse> deleteComment(String projectId, String ideaId, String commentId) {
        // TODO update childCommentCount for all parents
        commentSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(commentSchema.primaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId,
                        "commentId", commentId))));

        SettableFuture<DeleteResponse> indexingFuture = SettableFuture.create();
        elastic.deleteAsync(new DeleteRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return indexingFuture;
    }

    @Extern
    @Override
    public ListenableFuture<BulkByScrollResponse> deleteCommentsForIdea(String projectId, String ideaId) {
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
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        SettableFuture<BulkByScrollResponse> indexingFuture = SettableFuture.create();
        elastic.deleteByQueryAsync(new DeleteByQueryRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId))
                        .setQuery(QueryBuilders.termQuery("ideaId", ideaId)),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
        return indexingFuture;
    }

    @Extern
    @Override
    public ListenableFuture<AcknowledgedResponse> deleteAllForProject(String projectId) {
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
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete idea index
        SettableFuture<AcknowledgedResponse> deleteFuture = SettableFuture.create();
        elastic.indices().deleteAsync(new DeleteIndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId)),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(deleteFuture));

        return deleteFuture;
    }


    private void indexComment(SettableFuture<WriteResponse> indexingFuture, String projectId, String ideaId, String commentId) {
        Optional<CommentModel> commentOpt = getComment(projectId, ideaId, commentId);
        if (!commentOpt.isPresent()) {
            elastic.deleteAsync(new DeleteRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId),
                    RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
        } else {
            indexComment(indexingFuture, commentOpt.get());
        }
    }

    private void indexComment(SettableFuture<WriteResponse> indexingFuture, CommentModel comment) {
        elastic.indexAsync(commentToEsIndexRequest(comment),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
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
            }
        };
    }
}
