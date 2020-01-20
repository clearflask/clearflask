package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
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
import com.amazonaws.services.dynamodbv2.model.ResourceNotFoundException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
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
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.ElasticScript;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.WilsonScoreInterval;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.DocWriteResponse;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.support.WriteRequest;
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
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import rx.Observable;

import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.util.ExplicitNull.orNull;

@Slf4j
@Singleton
public class DynamoElasticCommentStore extends ManagedService implements CommentStore {

    public interface Config {
        /** Intended for tests. Force immediate index refresh after write request. */
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
    private static final String COMMENT_TABLE = "comment";

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
    private RestHighLevelClient elastic;
    @Inject
    private ElasticUtil elasticUtil;
    @Inject
    private Gson gson;
    @Inject
    private IdeaStore ideaStore;

    private WilsonScoreInterval wilsonScoreInterval;
    private Table commentTable;

    @Inject
    private void setup() {
        config.scoreWilsonConfidenceLevelObservable().subscribe(scoreWilsonConfidenceLevel -> wilsonScoreInterval =
                new WilsonScoreInterval(scoreWilsonConfidenceLevel));
        wilsonScoreInterval = new WilsonScoreInterval(config.scoreWilsonConfidenceLevel());
    }

    @Override
    protected void serviceStart() throws Exception {
        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(COMMENT_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("id").withKeyType(KeyType.HASH),
                            new KeySchemaElement().withAttributeName("commentId").withKeyType(KeyType.RANGE)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("id").withAttributeType(ScalarAttributeType.S),
                            new AttributeDefinition().withAttributeName("commentId").withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            log.debug("Table {} created", COMMENT_TABLE);
        } catch (ResourceNotFoundException ex) {
            log.debug("Table {} already exists", COMMENT_TABLE);
        }
        commentTable = dynamoDoc.getTable(COMMENT_TABLE);
    }

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
                        .put("created", ImmutableMap.of(
                                "type", "date"))
                        .put("edited", ImmutableMap.of(
                                "type", "date"))
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

        commentTable.putItem(dynamoMapper.toItem(comment));
        Optional<SettableFuture<UpdateResponse>> parentIndexingFutureOpt = Optional.empty();
        if (comment.getLevel() > 0) {
            String parentCommentId = comment.getParentCommentIds().get(comment.getParentCommentIds().size() - 1);
            commentTable.updateItem(new UpdateItemSpec()
                    .withPrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                            "projectId", comment.getProjectId(),
                            "ideaId", comment.getIdeaId()), CommentModel.class),
                            "commentId", parentCommentId)
                    .addAttributeUpdate(new AttributeUpdate("content")
                            .addNumeric(1)));

            SettableFuture<UpdateResponse> parentIndexingFuture = SettableFuture.create();
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, comment.getProjectId()), comment.getIdeaId())
                            .doc(gson.toJson(ImmutableMap.of(
                                    "content", comment.getContent()
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT, ActionListeners.fromFuture(parentIndexingFuture));

            parentIndexingFutureOpt = Optional.of(parentIndexingFuture);
        }

        IdeaStore.IdeaAndIndexingFuture<UpdateResponse> incrementResponse = ideaStore.incrementIdeaCommentCount(comment.getProjectId(), comment.getIdeaId());

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
                                .put("created", comment.getCreated())
                                .put("edited", orNull(comment.getEdited()))
                                .put("content", orNull(comment.getContent()))
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

    @Override
    public Optional<CommentModel> getComment(String projectId, String ideaId, String commentId) {
        return Optional.ofNullable(dynamoMapper.fromItem(commentTable.getItem("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "ideaId", ideaId
        ), CommentModel.class), "commentId", commentId), CommentModel.class));
    }

    @Override
    public ImmutableMap<String, CommentModel> getComments(String projectId, String ideaId, ImmutableCollection<String> commentIds) {
        return dynamoDoc.batchGetItem(new TableKeysAndAttributes(COMMENT_TABLE).withHashAndRangeKeys("id", "commentId", commentIds.stream()
                .flatMap(commentId -> Stream.of(
                        dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "ideaId", ideaId), CommentModel.class),
                        commentId))
                .toArray()))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(i -> dynamoMapper.fromItem(i, CommentModel.class))
                .collect(ImmutableMap.toImmutableMap(
                        CommentModel::getCommentId,
                        i -> i));
    }

    @Override
    public ImmutableSet<CommentModel> searchComments(String projectId, String ideaId, Optional<String> parentCommentIdOpt, ImmutableSet<String> excludeChildrenCommentIds) {
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
                        .termQuery("level", searchInitialDepthLimit));
            }
            SearchRequest searchRequest = new SearchRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId))
                    .source(new SearchSourceBuilder()
                            // TODO verify fetchSource is actually working
                            .fetchSource(new String[]{"parentCommentIds"}, null)
                            .size(fetchMax)
                            .sort("bestScore", SortOrder.DESC)
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

            return ImmutableSet.copyOf(getComments(projectId, ideaId, commentIdsToFetch).values());
        } else {
            Optional<String> latestCommentIdOpt = Streams.concat(parentCommentIdOpt.stream(), excludeChildrenCommentIds.stream())
                    .max(String::compareTo);
            QuerySpec querySpec = new QuerySpec()
                    .withMaxResultSize(fetchMax)
                    .withScanIndexForward(false);
            latestCommentIdOpt.ifPresent(latestCommentId -> querySpec
                    .withRangeKeyCondition(new RangeKeyCondition("commentId")
                            .ge(latestCommentId)));
            ItemCollection<QueryOutcome> items = commentTable.query(querySpec);
            return StreamSupport.stream(items.pages().spliterator(), false)
                    .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                    .map(item -> dynamoMapper.fromItem(item, CommentModel.class))
                    .collect(ImmutableSet.toImmutableSet());
        }
    }

    @Override
    public CommentAndIndexingFuture<UpdateResponse> updateComment(String projectId, String ideaId, String commentId, Instant updated, CommentUpdate commentUpdate) {
        CommentModel comment = dynamoMapper.fromItem(commentTable.updateItem(new UpdateItemSpec()
                .withPrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId), CommentModel.class),
                        "commentId", commentId)
                .withReturnValues(ReturnValue.ALL_NEW)
                .addAttributeUpdate(new AttributeUpdate("content")
                        .put(dynamoMapper.toDynamoValue(commentUpdate.getContent()))))
                .getItem(), CommentModel.class);

        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), comment.getIdeaId())
                        .doc(gson.toJson(ImmutableMap.of(
                                "content", comment.getContent()
                        )), XContentType.JSON)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Override
    public CommentAndIndexingFuture<UpdateResponse> voteComment(String projectId, String ideaId, String commentId, Vote votePrev, Vote vote) {
        checkArgument(vote != votePrev);


        ImmutableList.Builder<AttributeUpdate> attrUpdatesBuilder = ImmutableList.builder();
        int upvoteDiff = 0;
        int downvoteDiff = 0;
        switch (votePrev) {
            case Upvote:
                attrUpdatesBuilder.add(new AttributeUpdate("upvote").addNumeric(-1));
                upvoteDiff--;
                break;
            case Downvote:
                attrUpdatesBuilder.add(new AttributeUpdate("downvote").addNumeric(-1));
                downvoteDiff--;
                break;
            default:
                throw new RuntimeException("Unknown vote type: " + vote);
        }
        switch (vote) {
            case Upvote:
                attrUpdatesBuilder.add(new AttributeUpdate("upvote").addNumeric(1));
                upvoteDiff++;
                break;
            case Downvote:
                attrUpdatesBuilder.add(new AttributeUpdate("downvote").addNumeric(1));
                downvoteDiff++;
                break;
            default:
                throw new RuntimeException("Unknown vote type: " + vote);
        }
        CommentModel comment = dynamoMapper.fromItem(commentTable.updateItem(new UpdateItemSpec()
                .withPrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId), CommentModel.class),
                        "commentId", commentId)
                .withReturnValues(ReturnValue.ALL_NEW)
                .withAttributeUpdate(attrUpdatesBuilder.build()))
                .getItem(), CommentModel.class);

        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), comment.getIdeaId())
                        .script(ElasticScript.WILSON.toScript(ImmutableMap.of(
                                "upvoteDiff", upvoteDiff,
                                "downvoteDiff", downvoteDiff,
                                "z", wilsonScoreInterval.getZ())))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Override
    public CommentAndIndexingFuture<UpdateResponse> markAsDeletedComment(String projectId, String ideaId, String commentId) {
        CommentModel comment = dynamoMapper.fromItem(commentTable.updateItem(new UpdateItemSpec()
                .withPrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId), CommentModel.class),
                        "commentId", commentId)
                .withReturnValues(ReturnValue.ALL_NEW)
                .addAttributeUpdate(new AttributeUpdate("authorUserId").delete())
                .addAttributeUpdate(new AttributeUpdate("content").delete()))
                .getItem(), CommentModel.class);

        HashMap<String, Object> updates = Maps.newHashMap();
        updates.put("authorUserId", null);
        updates.put("content", null);
        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), comment.getIdeaId())
                        .doc(gson.toJson(updates), XContentType.JSON)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return new CommentAndIndexingFuture<>(comment, indexingFuture);
    }

    @Override
    public ListenableFuture<DeleteResponse> deleteComment(String projectId, String ideaId, String commentId) {
        String id = dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "ideaId", ideaId), CommentModel.class);

        commentTable.deleteItem("id", id);

        SettableFuture<DeleteResponse> indexingFuture = SettableFuture.create();
        elastic.deleteAsync(new DeleteRequest(elasticUtil.getIndexName(COMMENT_INDEX, projectId), id)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return indexingFuture;
    }

    @Override
    public ListenableFuture<BulkByScrollResponse> deleteCommentsForIdea(String projectId, String ideaId) {
        String id = dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "ideaId", ideaId), CommentModel.class);
        ItemCollection<QueryOutcome> items = commentTable.query(new QuerySpec()
                .withMaxPageSize(25)
                .withKeyConditionExpression("#i = :i")
                .withNameMap(ImmutableMap.of("#i", "id"))
                .withValueMap(ImmutableMap.of(":i", id)));
        items.pages().forEach(page -> {
            TableWriteItems tableWriteItems = new TableWriteItems(COMMENT_TABLE);
            page.forEach(item -> {
                CommentModel comment = dynamoMapper.fromItem(item, CommentModel.class);
                tableWriteItems.addHashAndRangePrimaryKeyToDelete("id", id, "commentId", comment.getCommentId());
            });
            if (tableWriteItems.getPrimaryKeysToDelete() == null || tableWriteItems.getPrimaryKeysToDelete().size() <= 0) {
                return;
            }
            dynamoDoc.batchWriteItem(tableWriteItems);
        });

        SettableFuture<BulkByScrollResponse> indexingFuture = SettableFuture.create();
        elastic.deleteByQueryAsync(new DeleteByQueryRequest()
                        .setQuery(QueryBuilders.termQuery("ideaId", ideaId)),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
        return indexingFuture;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(CommentStore.class).to(DynamoElasticCommentStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoElasticCommentStore.class);
                install(ConfigSystem.configModule(Config.class));
                install(ConfigSystem.configModule(ElasticUtil.ConfigSearch.class, Names.named("comment")));
            }
        };
    }
}
