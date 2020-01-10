package com.smotana.clearflask.store;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.AttributeUpdate;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ResourceNotFoundException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.google.common.base.Strings;
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
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.delete.DeleteResponse;
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
import org.elasticsearch.index.query.RangeQueryBuilder;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;

import javax.ws.rs.core.Response;
import java.util.Arrays;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class DynamoElasticIdeaStore extends ManagedService implements IdeaStore {

    public interface Config {
        /** Intended for tests. Force immediate index refresh after write request. */
        @DefaultValue("false")
        boolean elasticForceRefresh();
    }

    private static final String IDEA_INDEX = "idea";
    private static final String IDEA_TABLE = "idea";

    @Inject
    private Config config;
    @Inject
    @Named("idea")
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

    private Table ideaTable;


    @Override
    protected void serviceStart() throws Exception {
        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(IDEA_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName("id").withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName("id").withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
            log.debug("Table {} created", IDEA_TABLE);
        } catch (ResourceNotFoundException ex) {
            log.debug("Table {} already exists", IDEA_TABLE);
        }
        ideaTable = dynamoDoc.getTable(IDEA_TABLE);
    }

    @Override
    public ListenableFuture<CreateIndexResponse> createIndex(String projectId) {
        SettableFuture<CreateIndexResponse> indexingFuture = SettableFuture.create();
        elastic.indices().createAsync(new CreateIndexRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)).mapping(gson.toJson(ImmutableMap.of(
                "dynamic", "false",
                "properties", ImmutableMap.builder()
                        .put("authorUserId", ImmutableMap.of(
                                "type", "keyword"))
                        .put("created", ImmutableMap.of(
                                "type", "date"))
                        .put("lastActivity", ImmutableMap.of(
                                "type", "date"))
                        .put("title", ImmutableMap.of(
                                "type", "text",
                                "index_prefixes", ImmutableMap.of()))
                        .put("description", ImmutableMap.of(
                                "type", "text",
                                "index_prefixes", ImmutableMap.of()))
                        .put("categoryId", ImmutableMap.of(
                                "type", "keyword"))
                        .put("statusId", ImmutableMap.of(
                                "type", "keyword"))
                        .put("tagIds", ImmutableMap.of(
                                "type", "keyword"))
                        .put("commentCount", ImmutableMap.of(
                                "type", "long"))
                        .put("funded", ImmutableMap.of(
                                "type", "double"))
                        .put("fundGoal", ImmutableMap.of(
                                "type", "double"))
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
                        .build())), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));
        return indexingFuture;
    }

    @Override
    public IdeaAndIndexingFuture<IndexResponse> createIdea(IdeaModel idea) {
        ideaTable.putItem(dynamoMapper.toItem(idea));

        SettableFuture<IndexResponse> indexingFuture = SettableFuture.create();
        elastic.indexAsync(new IndexRequest(elasticUtil.getIndexName(IDEA_INDEX, idea.getProjectId()))
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                        .id(idea.getIdeaId())
                        .source(gson.toJson(ImmutableMap.builder()
                                .put("authorUserId", idea.getAuthorUserId())
                                .put("created", idea.getCreated())
                                .put("lastActivity", idea.getCreated())
                                .put("title", idea.getTitle())
                                .put("description", idea.getDescription())
                                .put("categoryId", idea.getCategoryId())
                                .put("statusId", idea.getStatusId())
                                .put("tagIds", idea.getTagIds())
                                .put("commentCount", idea.getCommentCount())
                                .put("funded", idea.getFunded())
                                .put("fundGoal", idea.getFundGoal())
                                .put("funderUserIds", idea.getFunderUserIds())
                                .put("voteValue", idea.getVoteValue())
                                .put("votersCount", idea.getVotersCount())
                                .put("expressionsValue", idea.getExpressionsValue())
                                .put("expressions", idea.getExpressions().keySet())
                                .build()), XContentType.JSON),
                RequestOptions.DEFAULT,
                ActionListeners.fromFuture(indexingFuture));

        return new IdeaAndIndexingFuture<>(idea, indexingFuture);
    }

    @Override
    public Optional<IdeaModel> getIdea(String projectId, String ideaId) {
        return Optional.ofNullable(dynamoMapper.fromItem(ideaTable.getItem("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "ideaId", ideaId
        ), IdeaModel.class)), IdeaModel.class));
    }

    @Override
    public ImmutableList<IdeaModel> getIdeas(String projectId, ImmutableList<String> ideaIds) {
        return dynamoDoc.batchGetItem(new TableKeysAndAttributes(IDEA_TABLE).withHashOnlyKeys("id", ideaIds.stream()
                .map(ideaId -> dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId), IdeaModel.class))
                .toArray()))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(i -> dynamoMapper.fromItem(i, IdeaModel.class))
                .collect(ImmutableList.toImmutableList());
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
                        ideaSearch.getSearchText(),
                        ideaSearch.getFundedByMeAndActive(),
                        ideaSearch.getLimit(),
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
                    // TODO implement trending, mayeb something like hacker news https://news.ycombinator.com/item?id=1781417
                default:
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                            "Sorting by '" + ideaSearchAdmin.getSortBy() + "' not supported");
            }
        } else {
            sortFields = ImmutableList.of();
            sortOrderOpt = Optional.empty();
        }

        BoolQueryBuilder query = QueryBuilders.boolQuery();

        if (ideaSearchAdmin.getFundedByMeAndActive() == Boolean.TRUE) {
            checkArgument(requestorUserIdOpt.isPresent());
            query.must(QueryBuilders.termQuery("authorUserId", requestorUserIdOpt.get()));
            // TODO how to check for activeness??
        }

        if (!Strings.isNullOrEmpty(ideaSearchAdmin.getSearchText())) {
            query.should(QueryBuilders.multiMatchQuery(ideaSearchAdmin.getSearchText(),
                    "title", "description")
                    .field("title", 3f)
                    .fuzziness("AUTO"));
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
                createdRangeQuery.gte(ideaSearchAdmin.getFilterCreatedStart().toEpochMilli());
            }
            if (ideaSearchAdmin.getFilterCreatedEnd() != null) {
                createdRangeQuery.lte(ideaSearchAdmin.getFilterCreatedEnd().toEpochMilli());
            }
            query.filter(createdRangeQuery);
        }

        if (ideaSearchAdmin.getFilterLastActivityStart() != null || ideaSearchAdmin.getFilterLastActivityEnd() != null) {
            // TODO Decide when last activity will be updated, don't forget to update it
            RangeQueryBuilder lastActivityRangeQuery = QueryBuilders.rangeQuery("lastActivity");
            if (ideaSearchAdmin.getFilterLastActivityStart() != null) {
                lastActivityRangeQuery.gte(ideaSearchAdmin.getFilterLastActivityStart().toEpochMilli());
            }
            if (ideaSearchAdmin.getFilterLastActivityEnd() != null) {
                lastActivityRangeQuery.lte(ideaSearchAdmin.getFilterLastActivityEnd().toEpochMilli());
            }
            query.filter(lastActivityRangeQuery);
        }

        ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(
                new SearchRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId)).source(new SearchSourceBuilder()
                        .fetchSource(false)
                        .query(query)),
                cursorOpt, sortFields, sortOrderOpt, useAccurateCursor, Optional.ofNullable(ideaSearchAdmin.getLimit()), configSearch);

        SearchHit[] hits = searchResponseWithCursor.getSearchResponse().getHits().getHits();
        log.trace("searchIdeas hitsSize {} query {}", hits.length, ideaSearchAdmin);
        if (hits.length == 0) {
            return new SearchResponse(ImmutableList.of(), Optional.empty());
        }

        ImmutableList<String> ideaIds = Arrays.stream(hits)
                .map(SearchHit::getId)
                .collect(ImmutableList.toImmutableList());

        return new SearchResponse(ideaIds, searchResponseWithCursor.getCursorOpt());
    }

    @Override
    public IdeaAndIndexingFuture<UpdateResponse> updateIdea(String projectId, String ideaId, IdeaUpdate ideaUpdate) {
        return updateIdea(projectId, ideaId, new IdeaUpdateAdmin(
                ideaUpdate.getTitle(),
                ideaUpdate.getDescription(),
                null,
                null,
                null,
                null));
    }

    @Override
    public IdeaAndIndexingFuture<UpdateResponse> updateIdea(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin) {
        UpdateItemSpec updateItemSpec = new UpdateItemSpec()
                .withPrimaryKey("id", dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId), IdeaModel.class))
                .withReturnValues(ReturnValue.ALL_NEW);
        Map<String, Object> indexUpdates = Maps.newHashMap();
        if (ideaUpdateAdmin.getTitle() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("title")
                    .put(dynamoMapper.toDynamoValue(ideaUpdateAdmin.getTitle())));
            indexUpdates.put("title", ideaUpdateAdmin.getTitle());
        }
        if (ideaUpdateAdmin.getDescription() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("description")
                    .put(dynamoMapper.toDynamoValue(ideaUpdateAdmin.getDescription())));
            indexUpdates.put("description", ideaUpdateAdmin.getDescription());
        }
        if (ideaUpdateAdmin.getStatusId() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("statusId")
                    .put(dynamoMapper.toDynamoValue(ideaUpdateAdmin.getStatusId())));
            indexUpdates.put("statusId", ideaUpdateAdmin.getStatusId());
        }
        if (ideaUpdateAdmin.getCategoryId() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("categoryId")
                    .put(dynamoMapper.toDynamoValue(ideaUpdateAdmin.getCategoryId())));
            indexUpdates.put("categoryId", ideaUpdateAdmin.getCategoryId());
        }
        if (ideaUpdateAdmin.getTagIds() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("tagIds")
                    .put(dynamoMapper.toDynamoValue(ideaUpdateAdmin.getTagIds())));
            indexUpdates.put("tagIds", ideaUpdateAdmin.getTagIds());
        }
        if (ideaUpdateAdmin.getFundGoal() != null) {
            updateItemSpec.addAttributeUpdate(new AttributeUpdate("fundGoal")
                    .put(dynamoMapper.toDynamoValue(ideaUpdateAdmin.getFundGoal())));
            indexUpdates.put("fundGoal", ideaUpdateAdmin.getFundGoal());
        }

        IdeaModel idea = dynamoMapper.fromItem(ideaTable.updateItem(updateItemSpec).getItem(), IdeaModel.class);

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
    public ListenableFuture<DeleteResponse> deleteIdea(String projectId, String ideaId) {
        String ideaCompoundId = dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                "projectId", projectId,
                "ideaId", ideaId), IdeaModel.class);

        ideaTable.deleteItem("id", ideaCompoundId);

        SettableFuture<DeleteResponse> indexingFuture = SettableFuture.create();
        elastic.deleteAsync(new DeleteRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), ideaCompoundId)
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return indexingFuture;
    }

    @Override
    public ListenableFuture<BulkResponse> deleteIdeas(String projectId, ImmutableList<String> ideaIds) {
        ImmutableList<String> ideaCompoundIds = ideaIds.stream()
                .map(ideaId -> dynamoMapper.getCompoundPrimaryKey(ImmutableMap.of(
                        "projectId", projectId,
                        "ideaId", ideaId), IdeaModel.class))
                .collect(ImmutableList.toImmutableList());

        dynamoDoc.batchWriteItem(new TableWriteItems(IDEA_TABLE).withPrimaryKeysToDelete(ideaCompoundIds.stream()
                .map(ideaCompoundId -> new PrimaryKey("id", ideaCompoundId))
                .toArray(PrimaryKey[]::new)));

        SettableFuture<BulkResponse> indexingFuture = SettableFuture.create();
        elastic.bulkAsync(new BulkRequest()
                        .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                        .add(ideaIds.stream()
                                .map(ideaId -> new DeleteRequest(elasticUtil.getIndexName(IDEA_INDEX, projectId), ideaId))
                                .collect(ImmutableList.toImmutableList())),
                RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));

        return indexingFuture;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(IdeaStore.class).to(DynamoElasticIdeaStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoElasticIdeaStore.class);
                install(ConfigSystem.configModule(Config.class));
                install(ConfigSystem.configModule(ElasticUtil.ConfigSearch.class, Names.named("idea")));
            }
        };
    }
}
