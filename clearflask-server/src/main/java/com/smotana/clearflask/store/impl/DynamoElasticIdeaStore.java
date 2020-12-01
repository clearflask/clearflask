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
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.common.collect.Sets;
import com.google.common.collect.Sets.SetView;
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
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.TransactionAndFundPrevious;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.DynamoUtil;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.ElasticScript;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.ElasticUtil.ConfigSearch;
import com.smotana.clearflask.util.ExpDecayScore;
import com.smotana.clearflask.util.ExplicitNull;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.extern.slf4j.Slf4j;
import org.apache.lucene.search.TotalHits;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.MoreLikeThisQueryBuilder.Item;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.RangeQueryBuilder;
import org.elasticsearch.index.search.MatchQuery;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;

import javax.ws.rs.core.Response;
import java.time.Duration;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.StreamSupport;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.util.ExplicitNull.orNull;

@Slf4j
@Singleton
public class DynamoElasticIdeaStore implements IdeaStore {

    public interface Config {
        /**
         * Intended for tests. Force immediate index refresh after write request.
         */
        @DefaultValue("false")
        boolean elasticForceRefresh();

        @DefaultValue("true")
        boolean enableSimilarToIdea();
    }

    private static final String IDEA_INDEX = "idea";
    private static final long EXP_DECAY_PERIOD_MILLIS = Duration.ofDays(7).toMillis();

    @Inject
    private Config config;
    @Inject
    @Named("idea")
    private ConfigSearch configSearch;
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
    private Gson gson;
    @Inject
    private VoteStore voteStore;
    @Inject
    private UserStore userStore;
    @Inject
    private Sanitizer sanitizer;

    private TableSchema<IdeaModel> ideaSchema;
    private IndexSchema<IdeaModel> ideaByProjectIdSchema;
    private ExpDecayScore expDecayScoreWeek;

    @Inject
    private void setup() {
        ideaSchema = dynamoMapper.parseTableSchema(IdeaModel.class);
        ideaByProjectIdSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(2, IdeaModel.class);

        expDecayScoreWeek = new ExpDecayScore(EXP_DECAY_PERIOD_MILLIS);
    }

    @Extern
    @Override
    public ListenableFuture<CreateIndexResponse> createIndex(String projectId) {
        SettableFuture<CreateIndexResponse> indexingFuture = SettableFuture.create();
        elastic.indices().createAsync(new CreateIndexRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)).mapping(gson.toJson(ImmutableMap.of(
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
                        .build())), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));
        return indexingFuture;
    }

    @Override
    public ListenableFuture<IndexResponse> createIdea(IdeaModel idea) {
        try {
            ideaSchema.table().putItem(new PutItemSpec()
                    .withItem(ideaSchema.toItem(idea))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(Map.of("#partitionKey", ideaSchema.partitionKeyName())));
        } catch (ConditionalCheckFailedException ex) {
            throw new ErrorWithMessageException(Response.Status.CONFLICT, "Similar title already exists, please choose another.", ex);
        }

        SettableFuture<IndexResponse> indexingFuture = SettableFuture.create();
        elastic.indexAsync(new IndexRequest(elasticUtil.getIndexName(IDEA_INDEX, idea.getProjectId()))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
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
                                .build()), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));

        return indexingFuture;
    }

    @Extern
    @Override
    public Optional<IdeaModel> getIdea(String projectId, String ideaId) {
        return Optional.ofNullable(ideaSchema.fromItem(ideaSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "ideaId", ideaId))))));
    }

    @Override
    public ImmutableMap<String, IdeaModel> getIdeas(String projectId, ImmutableCollection<String> ideaIds) {
        return dynamoUtil.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(ideaSchema.tableName()).withPrimaryKeys(ideaIds.stream()
                .map(ideaId -> ideaSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "ideaId", ideaId)))
                .toArray(PrimaryKey[]::new))))
                .map(ideaSchema::fromItem)
                .collect(ImmutableMap.toImmutableMap(
                        IdeaModel::getIdeaId,
                        i -> i));
    }

    @Override
    public SearchResponse searchIdeas(String projectId, IdeaSearch ideaSearch, Optional<String> requestorUserIdOpt, Optional<String> cursorOpt) {
        return searchIdeas(
                projectId,
                new IdeaSearchAdmin(
                        ideaSearch.getSortBy() == null ? null : IdeaSearchAdmin.SortByEnum.valueOf(ideaSearch.getSortBy().name()),
                        ideaSearch.getFilterCategoryIds(),
                        ideaSearch.getFilterStatusIds(),
                        ideaSearch.getFilterTagIds(),
                        ideaSearch.getFilterAuthorId(),
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

    private SearchResponse searchIdeas(String projectId, IdeaSearchAdmin ideaSearchAdmin, Optional<String> requestorUserIdOpt, boolean useAccurateCursor, Optional<String> cursorOpt) {
        Optional<SortOrder> sortOrderOpt;
        ImmutableList<String> sortFields;
        if (ideaSearchAdmin.getSortBy() != null) {
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
                default:
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                            "Sorting by '" + ideaSearchAdmin.getSortBy() + "' not supported");
            }
        } else if (Strings.isNullOrEmpty(ideaSearchAdmin.getSearchText())) {
            sortFields = ImmutableList.of("funded", "voteValue", "expressionsValue");
            sortOrderOpt = Optional.of(SortOrder.DESC);
        } else {
            sortFields = ImmutableList.of();
            sortOrderOpt = Optional.empty();
        }

        BoolQueryBuilder query = QueryBuilders.boolQuery();

        if (ideaSearchAdmin.getFundedByMeAndActive() == Boolean.TRUE) {
            checkArgument(requestorUserIdOpt.isPresent());
            query.must(QueryBuilders.termQuery("funderUserIds", requestorUserIdOpt.get()));
            // TODO how to check for activeness?? (Figure out which content and states allow funding and filter here)
        }

        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getSimilarToIdeaId())) {
            if (!config.enableSimilarToIdea()) {
                return new SearchResponse(
                        ImmutableList.of(),
                        Optional.empty(),
                        0L,
                        false);
            }
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
                    .zeroTermsQuery(MatchQuery.ZeroTermsQuery.ALL));
        }

        if (ideaSearchAdmin.getFilterCategoryIds() != null) {
            query.filter(QueryBuilders.termsQuery("categoryId", ideaSearchAdmin.getFilterCategoryIds().toArray()));
        }

        if (ideaSearchAdmin.getFilterStatusIds() != null) {
            query.filter(QueryBuilders.termsQuery("statusId", ideaSearchAdmin.getFilterStatusIds().toArray()));
        }

        if (ideaSearchAdmin.getFilterTagIds() != null) {
            query.filter(QueryBuilders.termsQuery("tagIds", ideaSearchAdmin.getFilterTagIds().toArray()));
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

        log.trace("Idea search query: {}", query);
        ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(
                new SearchRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)).source(new SearchSourceBuilder()
                        .fetchSource(false)
                        .query(query)),
                cursorOpt, sortFields, sortOrderOpt, useAccurateCursor, Optional.ofNullable(ideaSearchAdmin.getLimit()).map(Long::intValue), configSearch, ImmutableSet.of());

        SearchHit[] hits = searchResponseWithCursor.getSearchResponse().getHits().getHits();
        log.trace("searchIdeas hitsSize {} query {}", hits.length, ideaSearchAdmin);
        if (hits.length == 0) {
            return new SearchResponse(
                    ImmutableList.of(),
                    Optional.empty(),
                    0L,
                    false);
        }

        ImmutableList<String> ideaIds = Arrays.stream(hits)
                .map(SearchHit::getId)
                .collect(ImmutableList.toImmutableList());

        return new SearchResponse(
                ideaIds,
                searchResponseWithCursor.getCursorOpt(),
                searchResponseWithCursor.getSearchResponse().getHits().getTotalHits().value,
                searchResponseWithCursor.getSearchResponse().getHits().getTotalHits().relation == TotalHits.Relation.GREATER_THAN_OR_EQUAL_TO);
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
        Map<String, Object> indexUpdates = Maps.newHashMap();

        if (ideaUpdateAdmin.getTitle() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("title")
                    .put(ideaSchema.toDynamoValue("title", ideaUpdateAdmin.getTitle())));
            indexUpdates.put("title", ideaUpdateAdmin.getTitle());
        }
        if (ideaUpdateAdmin.getDescription() != null) {
            if (ideaUpdateAdmin.getDescription().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("description").delete());
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("description")
                        .put(ideaSchema.toDynamoValue("description", ideaUpdateAdmin.getDescription())));
            }
            indexUpdates.put("description", sanitizer.richHtmlToPlaintext(ideaUpdateAdmin.getDescription()));
        }
        if (ideaUpdateAdmin.getResponse() != null) {
            if (ideaUpdateAdmin.getResponse().isEmpty()) {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("response").delete());
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("responseAuthorUserId").delete());
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("responseAuthorName").delete());
                indexUpdates.put("responseAuthorUserId", "");
                indexUpdates.put("responseAuthorName", "");
            } else {
                updateItemSpec.addAttributeUpdate(new AttributeUpdate("response")
                        .put(ideaSchema.toDynamoValue("response", ideaUpdateAdmin.getResponse())));
                if (responseAuthor.isPresent()) {
                    updateItemSpec.addAttributeUpdate(new AttributeUpdate("responseAuthorUserId")
                            .put(ideaSchema.toDynamoValue("responseAuthorUserId", responseAuthor.get().getUserId())));
                    updateItemSpec.addAttributeUpdate(new AttributeUpdate("responseAuthorName")
                            .put(ideaSchema.toDynamoValue("responseAuthorName", responseAuthor.get().getName())));
                    indexUpdates.put("responseAuthorUserId", responseAuthor.get().getUserId());
                    indexUpdates.put("responseAuthorName", responseAuthor.get().getName());
                } else {
                    indexUpdates.put("responseAuthorUserId", "");
                    indexUpdates.put("responseAuthorName", "");
                }
            }
            indexUpdates.put("response", sanitizer.richHtmlToPlaintext(ideaUpdateAdmin.getResponse()));
        }
        if (ideaUpdateAdmin.getStatusId() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("statusId")
                    .put(ideaSchema.toDynamoValue("statusId", ideaUpdateAdmin.getStatusId())));
            indexUpdates.put("statusId", ideaUpdateAdmin.getStatusId());
        }
        if (ideaUpdateAdmin.getTagIds() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("tagIds")
                    .put(ideaSchema.toDynamoValue("tagIds", ideaUpdateAdmin.getTagIds())));
            indexUpdates.put("tagIds", ideaUpdateAdmin.getTagIds());
        }
        if (ideaUpdateAdmin.getFundGoal() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("fundGoal")
                    .put(ideaSchema.toDynamoValue("fundGoal", ideaUpdateAdmin.getFundGoal())));
            indexUpdates.put("fundGoal", ideaUpdateAdmin.getFundGoal());
        }

        IdeaModel idea = ideaSchema.fromItem(ideaSchema.table().updateItem(updateItemSpec).getItem());

        if (!indexUpdates.isEmpty()) {
            SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
            elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                            .doc(gson.toJson(indexUpdates), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
            return new IdeaAndIndexingFuture(idea, indexingFuture);
        } else {
            return new IdeaAndIndexingFuture(idea, Futures.immediateFuture(null));
        }
    }

    @Override
    public IdeaAndIndexingFuture voteIdea(String projectId, String ideaId, String userId, VoteValue vote) {
        VoteValue votePrev = voteStore.vote(projectId, userId, ideaId, vote);
        if (vote == votePrev) {
            return new IdeaAndIndexingFuture(getIdea(projectId, ideaId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found")), Futures.immediateFuture(null));
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
        Map<String, Object> indexUpdates = Maps.newHashMap();
        if (voteDiff != 0) {
            updateTrend = true;
            indexUpdates.put("voteValue", orNull(idea.getVoteValue()));
        }
        if (votersCountDiff != 0) {
            indexUpdates.put("votersCount", orNull(idea.getVotersCount()));
        }
        if (!indexUpdates.isEmpty() || updateTrend) {
            SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
            UpdateRequest updateRequest = new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId());
            if (updateTrend) {
                updateRequest.script(ElasticScript.EXP_DECAY.toScript(ImmutableMap.of(
                        "decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS,
                        "timeInMillis", System.currentTimeMillis(),
                        "extraUpdates", indexUpdates)));
            } else {
                updateRequest.doc(gson.toJson(indexUpdates), XContentType.JSON);
            }
            elastic.updateAsync(updateRequest.setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
            return new IdeaAndIndexingFuture(idea, indexingFuture);
        } else {
            return new IdeaAndIndexingFuture(idea, Futures.immediateFuture(null));
        }
    }

    @Override
    public IdeaAndExpressionsAndIndexingFuture expressIdeaSet(String projectId, String ideaId, String userId, Function<String, Double> expressionToWeightMapper, Optional<String> expressionOpt) {
        ImmutableSet<String> expressionsPrev = voteStore.express(projectId, userId, ideaId, expressionOpt);
        ImmutableSet<String> expressions = expressionOpt.map(ImmutableSet::of).orElse(ImmutableSet.of());

        if (expressionsPrev.equals(expressions)) {
            return new IdeaAndExpressionsAndIndexingFuture(expressions, getIdea(projectId, ideaId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found")), Futures.immediateFuture(null));
        }

        SetView<String> expressionsAdded = Sets.difference(expressions, expressionsPrev);
        SetView<String> expressionsRemoved = Sets.difference(expressionsPrev, expressions);

        HashMap<String, String> nameMap = Maps.newHashMap();
        HashMap<String, Object> valMap = Maps.newHashMap();
        valMap.put(":one", 1);
        valMap.put(":zero", 0);

        double expressionsValueDiff = 0;
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

        Map<String, Object> indexUpdates = Maps.newHashMap();
        indexUpdates.put("expressions", idea.getExpressions().keySet());
        if (expressionsValueDiff != 0d) {
            indexUpdates.put("expressionsValue", idea.getExpressionsValue());
        }
        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                        .script(ElasticScript.EXP_DECAY.toScript(ImmutableMap.of(
                                "decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS,
                                "timeInMillis", System.currentTimeMillis(),
                                "extraUpdates", indexUpdates)))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
        return new IdeaAndExpressionsAndIndexingFuture(expressions, idea, indexingFuture);
    }

    @Override
    public IdeaAndExpressionsAndIndexingFuture expressIdeaAdd(String projectId, String ideaId, String userId, Function<String, Double> expressionToWeightMapper, String expression) {
        ImmutableSet<String> expressionsPrev = voteStore.expressMultiAdd(projectId, userId, ideaId, ImmutableSet.of(expression));

        if (expressionsPrev.contains(expression)) {
            return new IdeaAndExpressionsAndIndexingFuture(expressionsPrev, getIdea(projectId, ideaId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found")), Futures.immediateFuture(null));
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

        Map<String, Object> indexUpdates = Maps.newHashMap();
        indexUpdates.put("expressions", idea.getExpressions().keySet());
        indexUpdates.put("expressionsValue", idea.getExpressionsValue());
        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                        .script(ElasticScript.EXP_DECAY.toScript(ImmutableMap.of(
                                "decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS,
                                "timeInMillis", System.currentTimeMillis(),
                                "extraUpdates", indexUpdates)))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
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
            return new IdeaAndExpressionsAndIndexingFuture(expressionsPrev, getIdea(projectId, ideaId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found")), Futures.immediateFuture(null));
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

        Map<String, Object> indexUpdates = Maps.newHashMap();
        indexUpdates.put("expressions", idea.getExpressions().keySet());
        indexUpdates.put("expressionsValue", idea.getExpressionsValue());
        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                        .script(ElasticScript.EXP_DECAY.toScript(ImmutableMap.of(
                                "decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS,
                                "timeInMillis", System.currentTimeMillis(),
                                "extraUpdates", indexUpdates)))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
        return new IdeaAndExpressionsAndIndexingFuture(
                ImmutableSet.copyOf(Sets.difference(expressionsPrev, ImmutableSet.of(expression))),
                idea, indexingFuture);
    }

    @Override
    public IdeaTransactionAndIndexingFuture fundIdea(String projectId, String ideaId, String userId, long fundDiff, String transactionType, String summary) {
        if (fundDiff == 0L) {
            throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Cannot fund zero");
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

        ImmutableMap.Builder<String, Object> scriptParamsBuilder = ImmutableMap.builder();
        scriptParamsBuilder.put("decayPeriodInMillis", EXP_DECAY_PERIOD_MILLIS);
        scriptParamsBuilder.put("timeInMillis", System.currentTimeMillis());
        Map<String, Object> indexUpdates = Maps.newHashMap();
        indexUpdates.put("funded", orNull(idea.getFunded()));
        if (!hasFundedBefore && resultingFundAmount != 0L) {
            indexUpdates.put("fundersCount", idea.getFundersCount());
            scriptParamsBuilder.put("extraArrayAdditions",
                    ImmutableMap.of("funderUserIds", userId));
        } else if (hasFundedBefore && resultingFundAmount == 0L) {
            indexUpdates.put("fundersCount", idea.getFundersCount());
            scriptParamsBuilder.put("extraArrayDeletions",
                    ImmutableMap.of("funderUserIds", userId));
        }
        scriptParamsBuilder.put("extraUpdates", indexUpdates);

        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                        .script(ElasticScript.EXP_DECAY.toScript(scriptParamsBuilder.build()))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
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

        ImmutableMap.Builder<Object, Object> updates = ImmutableMap.builder();
        updates.put("commentCount", idea.getCommentCount());
        if (incrementChildCount) {
            updates.put("childCommentCount", idea.getChildCommentCount());
        }
        SettableFuture<UpdateResponse> indexingFuture = SettableFuture.create();
        elastic.updateAsync(new UpdateRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), idea.getIdeaId())
                        .doc(gson.toJson(updates.build()), XContentType.JSON)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return new IdeaAndIndexingFuture(idea, indexingFuture);
    }

    @Extern
    @Override
    public ListenableFuture<DeleteResponse> deleteIdea(String projectId, String ideaId) {
        ideaSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(ideaSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "ideaId", ideaId))));

        SettableFuture<DeleteResponse> indexingFuture = SettableFuture.create();
        elastic.deleteAsync(new DeleteRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), ideaId)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return indexingFuture;
    }

    @Override
    public ListenableFuture<BulkResponse> deleteIdeas(String projectId, ImmutableCollection<String> ideaIds) {
        dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(ideaSchema.tableName())
                .withPrimaryKeysToDelete(ideaIds.stream()
                        .map(ideaId -> ideaSchema.primaryKey(Map.of(
                                "projectId", projectId,
                                "ideaId", ideaId)))
                        .toArray(PrimaryKey[]::new))));

        SettableFuture<BulkResponse> indexingFuture = SettableFuture.create();
        elastic.bulkAsync(new BulkRequest()
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                        .add(ideaIds.stream()
                                .map(ideaId -> new DeleteRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), ideaId))
                                .collect(ImmutableList.toImmutableList())),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return indexingFuture;
    }

    @Extern
    @Override
    public ListenableFuture<AcknowledgedResponse> deleteAllForProject(String projectId) {
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
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });

        // Delete idea index
        SettableFuture<AcknowledgedResponse> deleteFuture = SettableFuture.create();
        elastic.indices().deleteAsync(new DeleteIndexRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(deleteFuture));

        return deleteFuture;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(IdeaStore.class).to(DynamoElasticIdeaStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                install(ConfigSystem.configModule(ConfigSearch.class, Names.named("idea")));
            }
        };
    }
}
