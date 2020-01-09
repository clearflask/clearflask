package com.smotana.clearflask.util;

import com.google.common.annotations.VisibleForTesting;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.elastic.ActionListeners;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.search.ClearScrollRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.search.SearchScrollRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.sort.SortBuilders;
import org.elasticsearch.search.sort.SortOrder;

import java.io.IOException;
import java.time.Duration;
import java.util.Optional;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class ElasticUtil {

    public interface ConfigSearch {
        @DefaultValue("10")
        int elasticPageSize();

        @DefaultValue("25")
        int elasticScrollSize();

        @DefaultValue("PT1M")
        Duration elasticScrollKeepAlive();
    }

    @Value
    public static class SearchResponseWithCursor {
        private final SearchResponse searchResponse;
        private final Optional<String> cursorOpt;
    }

    @VisibleForTesting
    enum PaginationType {
        SCROLL,
        SEARCH_AFTER,
        FROM
    }

    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;
    @Inject
    private Gson gson;
    @Inject
    private RestHighLevelClient elastic;

    public String getIndexName(String indexName, String projectId) {
        return indexName + "-" + projectId;
    }

    public SearchResponseWithCursor searchWithCursor(
            SearchRequest searchRequest,
            Optional<String> cursorOpt,
            Optional<String> sortFieldOpt,
            Optional<SortOrder> sortOrderOpt,
            boolean useAccurateCursor,
            ConfigSearch configSearch) {
        checkArgument(searchRequest.source() != null);

        Optional<String> cursorDecryptedOpt = cursorOpt.map(serverSecretCursor::decryptString);

        PaginationType paginationType = choosePaginationType(useAccurateCursor, sortFieldOpt);
        SearchResponse searchResponse;
        try {
            if (useAccurateCursor && cursorDecryptedOpt.isPresent()) {
                searchResponse = elastic.scroll(new SearchScrollRequest()
                                .scrollId(cursorDecryptedOpt.get())
                                .scroll(TimeValue.timeValueMillis(configSearch.elasticScrollKeepAlive().toMillis())),
                        RequestOptions.DEFAULT);
            } else {
                // Set sorting and order
                sortFieldOpt.ifPresent(sortField -> searchRequest.source().sort(SortBuilders
                        .fieldSort(sortField)
                        .order(sortOrderOpt.orElse(SortOrder.ASC))));

                // Set page size
                searchRequest.source().size(useAccurateCursor ? configSearch.elasticScrollSize() : configSearch.elasticPageSize());

                // Set cursor
                switch (paginationType) {
                    case SCROLL:
                        searchRequest.scroll(TimeValue.timeValueMillis(configSearch.elasticScrollKeepAlive().toMillis()));
                        break;
                    case SEARCH_AFTER:
                        cursorDecryptedOpt.ifPresent(cursorDecrypted -> searchRequest.source().searchAfter(gson.fromJson(cursorDecrypted, Object[].class)));
                        break;
                    case FROM:
                        cursorDecryptedOpt.ifPresent(cursorDecrypted -> searchRequest.source().from(gson.fromJson(cursorDecrypted, int.class)));
                        break;
                }

                // Finally run the search
                searchResponse = elastic.search(searchRequest, RequestOptions.DEFAULT);
            }
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }


        SearchHit[] hits = searchResponse.getHits().getHits();

        // Get new cursor
        Optional<String> cursorOptNew = Optional.empty();
        switch (paginationType) {
            case SCROLL:
                if (hits.length >= configSearch.elasticPageSize()) {
                    cursorOptNew = Optional.ofNullable(searchResponse.getScrollId());
                } else {
                    elastic.clearScrollAsync(new ClearScrollRequest(), RequestOptions.DEFAULT,
                            ActionListeners.onFailure(ex -> log.warn("Failed to clear scroll", ex)));
                }
                break;
            case SEARCH_AFTER:
                if (hits.length >= configSearch.elasticPageSize()) {
                    cursorOptNew = Optional.of(gson.toJson(
                            hits[hits.length - 1].getSortValues()));
                }
                break;
            case FROM:
                if (hits.length >= configSearch.elasticPageSize()) {
                    cursorOptNew = Optional.of(gson.toJson(
                            Math.max(searchRequest.source().from(), 0) + hits.length));
                }
                break;
        }

        return new SearchResponseWithCursor(
                searchResponse,
                cursorOptNew.map(serverSecretCursor::encryptString));
    }

    private PaginationType choosePaginationType(
            boolean useAccurateCursor,
            Optional<String> sortFieldOpt) {
        if (useAccurateCursor) {
            // Since we want accurate pagination, use scroll pagination
            return PaginationType.SCROLL;
        } else if (sortFieldOpt.isPresent()) {
            // Since sort fields are present, use search_after pagination
            return PaginationType.SEARCH_AFTER;
        } else {
            // Since no sort fields are present, fall back to using 'from' pagination.
            // The alternative is to use score with 'search after', but it is not recommended
            // as the score may differ between shards.
            return PaginationType.FROM;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ElasticUtil.class).asEagerSingleton();
                install(DefaultServerSecret.module(Names.named("cursor")));
            }
        };
    }
}
