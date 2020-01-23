package com.smotana.clearflask.util;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
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
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE_STR;

@Slf4j
@Singleton
public class ElasticUtil {

    public interface ConfigSearch {
        @DefaultValue("100")
        int pageSizeMax();

        @DefaultValue(DYNAMO_WRITE_BATCH_MAX_SIZE_STR)
        int pageSizeDefault();

        @DefaultValue(DYNAMO_WRITE_BATCH_MAX_SIZE_STR)
        int scrollSizeDefault();

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
            ImmutableList<String> sortFields,
            Optional<SortOrder> sortOrderOpt,
            boolean useAccurateCursor,
            Optional<Integer> sizeOpt,
            ConfigSearch configSearch) {
        checkArgument(searchRequest.source() != null);

        Optional<String> cursorDecryptedOpt = cursorOpt.map(serverSecretCursor::decryptString);

        int paginationSize;
        if (sizeOpt.isPresent()) {
            paginationSize = MathUtil.minmax(1, sizeOpt.get(), useAccurateCursor ? Integer.MAX_VALUE : configSearch.pageSizeMax());
        } else {
            paginationSize = useAccurateCursor ? configSearch.scrollSizeDefault() : configSearch.pageSizeDefault();
        }

        PaginationType paginationType = choosePaginationType(useAccurateCursor, sortFields);
        SearchResponse searchResponse;
        try {
            if (useAccurateCursor && cursorDecryptedOpt.isPresent()) {
                searchResponse = elastic.scroll(new SearchScrollRequest()
                                .scrollId(cursorDecryptedOpt.get())
                                .scroll(TimeValue.timeValueMillis(configSearch.elasticScrollKeepAlive().toMillis())),
                        RequestOptions.DEFAULT);
            } else {
                // Set sorting and order
                for (String sortField : sortFields) {
                    searchRequest.source().sort(SortBuilders
                            .fieldSort(sortField)
                            .order(sortOrderOpt.orElse(SortOrder.ASC)));
                }

                // Set page paginationSize
                searchRequest.source().size(paginationSize);

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
        boolean mayHaveMoreResults = hits.length >= paginationSize;
        Optional<String> cursorOptNew = Optional.empty();
        switch (paginationType) {
            case SCROLL:
                if (mayHaveMoreResults) {
                    cursorOptNew = Optional.ofNullable(searchResponse.getScrollId());
                } else {
                    ClearScrollRequest clearScrollRequest = new ClearScrollRequest();
                    clearScrollRequest.addScrollId(searchResponse.getScrollId());
                    elastic.clearScrollAsync(clearScrollRequest, RequestOptions.DEFAULT,
                            ActionListeners.onFailure(ex -> log.warn("Failed to clear scroll", ex)));
                }
                break;
            case SEARCH_AFTER:
                if (mayHaveMoreResults) {
                    cursorOptNew = Optional.of(gson.toJson(
                            hits[hits.length - 1].getSortValues()));
                }
                break;
            case FROM:
                if (mayHaveMoreResults) {
                    cursorOptNew = Optional.of(gson.toJson(
                            Math.max(searchRequest.source().from(), 0) + hits.length));
                }
                break;
        }

        log.trace("search query: {}\nresult: {}", searchRequest, hits);

        return new SearchResponseWithCursor(
                searchResponse,
                cursorOptNew.map(serverSecretCursor::encryptString));
    }

    private PaginationType choosePaginationType(
            boolean useAccurateCursor,
            ImmutableList<String> sortFields) {
        if (useAccurateCursor) {
            // Since we want accurate pagination, use scroll pagination
            return PaginationType.SCROLL;
        } else if (!sortFields.isEmpty()) {
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
            }
        };
    }
}
