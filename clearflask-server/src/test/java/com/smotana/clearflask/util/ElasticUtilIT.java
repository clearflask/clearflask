package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableMap;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.ElasticUtil.ConfigSearch;
import com.smotana.clearflask.util.ElasticUtil.PaginationType;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameters;

import java.util.Optional;

import static org.junit.Assert.*;

@Slf4j
@RunWith(Parameterized.class)
public class ElasticUtilIT extends AbstractIT {

    @Inject
    private ElasticUtil elasticUtil;
    @Inject
    private Gson gson;
    @Inject
    @Named("ElasticUtilIT")
    private ConfigSearch configSearch;


    @Parameterized.Parameter(0)
    public PaginationType paginationType;

    @Parameters(name = "{0}")
    public static PaginationType[] data() {
        return PaginationType.values();
    }

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                ElasticUtil.module(),
                GsonProvider.module(),
                ConfigSystem.configModule(ConfigSearch.class, Names.named("ElasticUtilIT"))
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(ConfigSearch.class, Names.named("ElasticUtilIT"), om -> {
                    om.override(om.id().elasticPageSize()).withValue(2);
                    om.override(om.id().elasticScrollSize()).withValue(2);
                }));
            }
        }));
    }

    @Test(timeout = 5_000L)
    public void testSearchUsers() throws Exception {
        String indexName = elasticUtil.getIndexName("test-elastic-util", IdUtil.randomId());
        elastic.indices().create(new CreateIndexRequest(indexName).mapping(gson.toJson(ImmutableMap.of(
                "dynamic", "false",
                "properties", ImmutableMap.builder()
                        .put("name", ImmutableMap.of(
                                "type", "text",
                                "fielddata", "true"))
                        .put("color", ImmutableMap.of(
                                "type", "text"))
                        .build())), XContentType.JSON), RequestOptions.DEFAULT);
        elastic.index(new IndexRequest(indexName).setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE)
                .id(IdUtil.randomId()).source(gson.toJson(ImmutableMap.of(
                        "name", "bob",
                        "color", "green"
                )), XContentType.JSON), RequestOptions.DEFAULT);
        elastic.index(new IndexRequest(indexName).setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE)
                .id(IdUtil.randomId()).source(gson.toJson(ImmutableMap.of(
                        "name", "joe",
                        "color", "green"
                )), XContentType.JSON), RequestOptions.DEFAULT);
        elastic.index(new IndexRequest(indexName).setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE)
                .id(IdUtil.randomId()).source(gson.toJson(ImmutableMap.of(
                        "name", "matt",
                        "color", "green"
                )), XContentType.JSON), RequestOptions.DEFAULT);
        elastic.index(new IndexRequest(indexName).setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE)
                .id(IdUtil.randomId()).source(gson.toJson(ImmutableMap.of(
                        "name", "arya",
                        "color", "green"
                )), XContentType.JSON), RequestOptions.DEFAULT);
        elastic.index(new IndexRequest(indexName).setRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE)
                .id(IdUtil.randomId()).source(gson.toJson(ImmutableMap.of(
                        "name", "ema",
                        "color", "green"
                )), XContentType.JSON), RequestOptions.DEFAULT);

        boolean useAccurateCursor;
        Optional<String> sortFieldOpt;
        switch (paginationType) {
            case SCROLL:
                useAccurateCursor = true;
                sortFieldOpt = Optional.empty();
                break;
            case SEARCH_AFTER:
                useAccurateCursor = false;
                sortFieldOpt = Optional.of("name");
                break;
            case FROM:
                useAccurateCursor = false;
                sortFieldOpt = Optional.empty();
                break;
            default:
                throw new Exception();
        }

        ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(new SearchRequest(indexName)
                        .source(new SearchSourceBuilder()
                                .query(QueryBuilders.matchAllQuery())),
                Optional.empty(), sortFieldOpt, Optional.empty(), useAccurateCursor, configSearch);
        log.info("Pagination cursor for {}: {}", paginationType.name(), searchResponseWithCursor.getCursorOpt());
        log.info("Search results: {}", (Object) searchResponseWithCursor.getSearchResponse().getHits().getHits());
        assertEquals(2, searchResponseWithCursor.getSearchResponse().getHits().getHits().length);
        assertTrue(searchResponseWithCursor.getCursorOpt().isPresent());

        ElasticUtil.SearchResponseWithCursor searchResponseWithCursor2 = elasticUtil.searchWithCursor(new SearchRequest(indexName)
                        .source(new SearchSourceBuilder()
                                .query(QueryBuilders.matchAllQuery())),
                searchResponseWithCursor.getCursorOpt(), sortFieldOpt, Optional.empty(), useAccurateCursor, configSearch);
        log.info("Search results: {}", (Object) searchResponseWithCursor2.getSearchResponse().getHits().getHits());
        assertEquals(2, searchResponseWithCursor2.getSearchResponse().getHits().getHits().length);
        assertTrue(searchResponseWithCursor2.getCursorOpt().isPresent());

        ElasticUtil.SearchResponseWithCursor searchResponseWithCursor3 = elasticUtil.searchWithCursor(new SearchRequest(indexName)
                        .source(new SearchSourceBuilder()
                                .query(QueryBuilders.matchAllQuery())),
                searchResponseWithCursor2.getCursorOpt(), sortFieldOpt, Optional.empty(), useAccurateCursor, configSearch);
        log.info("Search results: {}", (Object) searchResponseWithCursor3.getSearchResponse().getHits().getHits());
        assertEquals(1, searchResponseWithCursor3.getSearchResponse().getHits().getHits().length);
        assertFalse(searchResponseWithCursor3.getCursorOpt().isPresent());
    }
}