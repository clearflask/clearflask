package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
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
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.collect.Maps;
import com.google.common.collect.Streams;
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
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.DynamoUtil;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.ElasticScript;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.util.WilsonScoreInterval;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.DocWriteResponse;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.common.document.DocumentField;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.reindex.BulkByScrollResponse;
import org.elasticsearch.index.reindex.DeleteByQueryRequest;
import org.elasticsearch.index.search.MatchQuery;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import rx.Observable;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

        @DefaultValue("true")
        boolean useElasticForSearch();

        @DefaultValue("5")
        int searchInitialDepthLimit();

        @DefaultValue("20")
        int searchInitialFetchMax();

        @DefaultValue("50")
        int searchSubsequentFetchMax();

        @DefaultValue("0.95")
        double scoreWilsonConfidenceLevel();

        Observable<Double> scoreWilsonConfidenceLevelObservable();
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

    @Extern
    @Override
    public ListenableFuture<CreateIndexResponse> createIndex(String projectId) {
        SettableFuture<CreateIndexResponse> indexingFuture = SettableFuture.create();
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
                ActionListeners.fromFuture(indexingFuture));
        return indexingFuture;
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
    public CommentAndIndexingFuture<List<DocWriteResponse>> createComment(CommentModel comment) {
        checkArgument(comment.getParentCommentIds().size() == comment.getLevel());

        commentSchema.table().putItem(commentSchema.toItem(comment));
        Optional<SettableFuture<UpdateResponse>> parentIndexingFutureOpt = Optional.empty();
        if (comment.getLevel() > 0) {
            String parentCommentId = comment.getParentCommentIds().get(comment.getParentCommentIds().size() - 1);
            long parentChildCommentCount = commentSchema.table().updateItem(new UpdateItemSpec()
                    .withPrimaryKey(commentSchema.primaryKey(ImmutableMap.of(
                            "projectId", comment.getProjectId(),
                            "ideaId", comment.getIdeaId(),
                            "commentId", parentCommentId)))
                    .addAttributeUpdate(new AttributeUpdate("childCommentCount")
                            .addNumeric(1))
                    .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem()
                    .getLong("childCommentCount");

            SettableFuture<UpdateResponse> parentIndexingFuture = SettableFuture.create();
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, comment.getProjectId()), parentCommentId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "childCommentCount", parentChildCommentCount
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT, ActionListeners.fromFuture(parentIndexingFuture));

            parentIndexingFutureOpt = Optional.of(parentIndexingFuture);
        }

        IdeaAndIndexingFuture incrementResponse = ideaStore.incrementIdeaCommentCount(comment.getProjectId(), comment.getIdeaId(), comment.getLevel() == 0);

        SettableFuture<IndexResponse> indexingFuture = SettableFuture.create();
        elastic.indexAsync(new IndexRequest(elasticUtil.getIndexName(COMMENT_INDEX, comment.getProjectId()))
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
                                .put("content", orNull(elasticUtil.draftjsToPlaintext(comment.getContent())))
                                .put("upvotes", comment.getUpvotes())
                                .put("downvotes", comment.getDownvotes())
                                .put("score", computeCommentScore(comment.getUpvotes(), comment.getDownvotes()))
                                .build()), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));

        ImmutableList.Builder<ListenableFuture<? extends DocWriteResponse>> builder = ImmutableList.builder();
        builder.add(indexingFuture);
        builder.add(incrementResponse.getIndexingFuture());
        parentIndexingFutureOpt.ifPresent(builder::add);
        return new CommentAndIndexingFuture<>(comment, Futures.allAsList(builder.build()));
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
    public ImmutableMap<String, CommentModel> getComments(String projectId, String ideaId, ImmutableCollection<String> commentIds) {
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
    public SearchCommentsResponse searchComments(String projectId, CommentSearchAdmin commentSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt) {
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
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
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
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                            "Sorting by '" + commentSearchAdmin.getSortBy() + "' not supported");
            }
        } else {
            sortFields = ImmutableList.of();
        }

        int pageSize = Math.min(pageSizeOpt.orElse(10), DYNAMO_READ_BATCH_MAX_SIZE);
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
                        .fuzziness("AUTO").zeroTermsQuery(MatchQuery.ZeroTermsQuery.ALL));
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
    public ImmutableSet<CommentModel> listComments(String projectId, String ideaId, Optional<String> parentCommentIdOpt, ImmutableSet<String> excludeChildrenCommentIds) {
        boolean isInitial = !parentCommentIdOpt.isPresent() && excludeChildrenCommentIds.isEmpty();
        int fetchMax = isInitial
                ? config.searchInitialFetchMax()
                : config.searchSubsequentFetchMax();
        if (config.useElasticForSearch()) {
            BoolQueryBuilder queryBuilder = QueryBuilders.boolQuery()
                    .must(QueryBuilders.termQuery("ideaId", ideaId));
            parentCommentIdOpt.ifPresent(parentCommentId -> queryBuilder.must(QueryBuilders
                    .termQuery("parentCommentIds", parentCommentId)));
            excludeChildrenCommentIds.forEach(excludeChildrenCommentId -> queryBuilder.mustNot(QueryBuilders
                    .termQuery("commentId", excludeChildrenCommentId)));
            int searchInitialDepthLimit = config.searchInitialDepthLimit();
            if (isInitial && searchInitialDepthLimit >= 0) {
                queryBuilder.must(QueryBuilders
                        .rangeQuery("level").lt(searchInitialDepthLimit));
            }
            log.trace("Comment search query: {}", queryBuilder);
            SearchRequest searchRequest = new SearchRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId))
                    .source(new SearchSourceBuilder()
                            // TODO verify fetchSource is actually working
                            .fetchSource(new String[]{"parentCommentIds"}, null)
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

            ImmutableSet<String> commentIdsToFetch = Arrays.stream(searchResponse.getHits().getHits())
                    .flatMap(hit -> {
                        DocumentField parentCommentIds = hit.field("parentCommentIds");
                        if (parentCommentIds != null && !parentCommentIds.getValues().isEmpty()) {
                            // parentCommentIds must be a list of Strings
                            List<String> values = (List<String>) (Object) parentCommentIds.getValues();
                            // Include all parent comments as well
                            return Streams.concat(Stream.of(hit.getId()), values.stream());
                        } else {
                            return Stream.of(hit.getId());
                        }
                    })
                    .collect(ImmutableSet.toImmutableSet());

            if (commentIdsToFetch.isEmpty()) {
                return ImmutableSet.of();
            }
            return ImmutableSet.copyOf(getComments(projectId, ideaId, commentIdsToFetch).values());
        } else {
            Optional<String> latestCommentIdOpt = Streams.concat(parentCommentIdOpt.stream(), excludeChildrenCommentIds.stream())
                    .max(String::compareTo);
            ItemCollection<QueryOutcome> items = commentSchema.table().query(new QuerySpec()
                    .withMaxResultSize(fetchMax)
                    .withScanIndexForward(false)
                    .withRangeKeyCondition(new RangeKeyCondition(commentSchema.rangeKeyName())
                            .ge(commentSchema.rangeKeyPartial(latestCommentIdOpt
                                    .map(latestCommentId -> Map.of("commentId", (Object) latestCommentId))
                                    .orElseGet(Map::of)).getValue())));
            return StreamSupport.stream(items.pages().spliterator(), false)
                    .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                    .map(item -> commentSchema.fromItem(item))
                    .collect(ImmutableSet.toImmutableSet());
        }
    }

    @Override
    public CommentAndIndexingFuture<UpdateResponse> updateComment(String projectId, String ideaId, String commentId, Instant updated, CommentUpdate commentUpdate) {
        CommentModel comment = commentSchema.fromItem(commentSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(commentSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "ideaId", ideaId,
                        "commentId", commentId)))
                .withReturnValues(ReturnValue.ALL_NEW)
                .addAttributeUpdate(new AttributeUpdate("content")
                        .put(commentSchema.toDynamoValue("content", commentUpdate.getContent()))))
                .getItem());

        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                        .doc(gson.toJson(ImmutableMap.of(
                                "content", elasticUtil.draftjsToPlaintext(comment.getContent())
                        )), XContentType.JSON)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Override
    public CommentAndIndexingFuture<UpdateResponse> voteComment(String projectId, String ideaId, String commentId, String userId, VoteValue vote) {
        userStore.userVoteUpdateBloom(projectId, userId, ideaId);
        VoteValue votePrev = voteStore.vote(projectId, userId, commentId, vote);
        if (vote == votePrev) {
            return new CommentAndIndexingFuture<>(getComment(projectId, ideaId, commentId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Comment not found")), Futures.immediateFuture(null));
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

        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                        .script(ElasticScript.WILSON.toScript(ImmutableMap.of(
                                "upvoteDiff", upvoteDiff,
                                "downvoteDiff", downvoteDiff,
                                "z", wilsonScoreInterval.getZ())))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Extern
    @Override
    public CommentAndIndexingFuture<UpdateResponse> markAsDeletedComment(String projectId, String ideaId, String commentId) {
        CommentModel comment = commentSchema.fromItem(commentSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(commentSchema.primaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId,
                        "commentId", commentId)))
                .withReturnValues(ReturnValue.ALL_NEW)
                .addAttributeUpdate(new AttributeUpdate("authorUserId").delete())
                .addAttributeUpdate(new AttributeUpdate("authorName").delete())
                .addAttributeUpdate(new AttributeUpdate("content").delete())
                .addAttributeUpdate(new AttributeUpdate("edited")
                        .put(commentSchema.toDynamoValue("edited", Instant.now()))))
                .getItem());

        HashMap<String, Object> updates = Maps.newHashMap();
        updates.put("authorUserId", null);
        updates.put("authorName", null);
        updates.put("content", null);
        updates.put("edited", comment.getEdited().getEpochSecond());
        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), commentId)
                        .doc(gson.toJson(updates), XContentType.JSON)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

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
