// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.elastic;

import com.github.rholder.retry.RetryException;
import com.github.rholder.retry.RetryerBuilder;
import com.github.rholder.retry.StopStrategies;
import com.github.rholder.retry.WaitStrategies;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.HistogramInterval;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramResponsePoints;
import com.smotana.clearflask.api.model.Hits;
import com.smotana.clearflask.util.MathUtil;
import com.smotana.clearflask.util.ServerSecret;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.ConnectionClosedException;
import org.apache.lucene.search.TotalHits;
import org.elasticsearch.ElasticsearchStatusException;
import org.elasticsearch.action.search.ClearScrollRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.search.SearchScrollRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.ResponseException;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.aggregations.Aggregation;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import org.elasticsearch.search.aggregations.bucket.histogram.Histogram;
import org.elasticsearch.search.aggregations.bucket.histogram.LongBounds;
import org.elasticsearch.search.aggregations.bucket.histogram.ParsedDateHistogram;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortBuilders;
import org.elasticsearch.search.sort.SortOrder;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.Iterator;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE_STR;

@Slf4j
@Singleton
public class ElasticUtil {

    public static String AUTOCOMPLETE_TOKENIZER_NAME = "autocomplete_tokenizer";
    public static ImmutableMap<String, Object> AUTOCOMPLETE_TOKENIZER = ImmutableMap.of(
            "type", "edge_ngram",
            "min_gram", 3,
            "max_gram", 10,
            "token_chars", ImmutableList.of(
                    "letter",
                    "digit"));
    public static String AUTOCOMPLETE_ANALYZER_NAME = "autocomplete_analyzer";
    public static ImmutableMap<String, Object> AUTOCOMPLETE_ANALYZER = ImmutableMap.of(
            "type", "custom",
            "tokenizer", AUTOCOMPLETE_TOKENIZER_NAME);

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
    private Provider<RestHighLevelClient> elastic;

    public String getIndexName(String indexName, String projectId) {
        return indexName + "-" + projectId;
    }

    public <T> T retry(Callable<T> callable) {
        try {
            return RetryerBuilder.<T>newBuilder()
                    .retryIfException(th -> {
                        if (th.getClass().isAssignableFrom(ElasticsearchStatusException.class)) {
                            ElasticsearchStatusException ex = (ElasticsearchStatusException) th;
                            return ex.status().getStatus() == 429
                                    || ex.status().getStatus() == 502;
                        } else if (th.getClass().isAssignableFrom(ConnectionClosedException.class)) {
                            return true;
                        }
                        return false;
                    })
                    .withStopStrategy(StopStrategies.stopAfterDelay(3, TimeUnit.MINUTES))
                    .withWaitStrategy(WaitStrategies.exponentialWait(5, 20, TimeUnit.SECONDS))
                    .build()
                    .call(callable);
        } catch (ExecutionException | RetryException ex) {
            throw new RuntimeException("Failed all retry attempts", ex);
        }
    }

    public SearchResponseWithCursor searchWithCursor(
            SearchRequest searchRequest,
            Optional<String> cursorOpt,
            ImmutableList<String> sortFields,
            Optional<SortOrder> sortOrderOpt,
            boolean useAccurateCursor,
            Optional<Integer> sizeOpt,
            ConfigSearch configSearch,
            ImmutableSet<String> sourceIncludes) {
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
                searchResponse = elastic.get().scroll(new SearchScrollRequest()
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

                // Set source includes
                if (sourceIncludes.isEmpty()) {
                    searchRequest.source().fetchSource(false);
                } else {
                    searchRequest.source().fetchSource(sourceIncludes.toArray(new String[]{}), null);
                }

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
                searchResponse = retry(() -> elastic.get().search(searchRequest, RequestOptions.DEFAULT));
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
                    elastic.get().clearScrollAsync(clearScrollRequest, RequestOptions.DEFAULT,
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

    public HistogramResponse histogram(
            String indexName,
            String aggregateFieldName,
            Optional<LocalDate> startOpt,
            Optional<LocalDate> endOpt,
            Optional<HistogramInterval> intervalOpt,
            Optional<QueryBuilder> queryOpt) {
        DateHistogramInterval interval;
        if (intervalOpt.isPresent()) {
            switch (intervalOpt.get()) {
                case YEAR:
                    interval = DateHistogramInterval.YEAR;
                    break;
                case QUARTER:
                    interval = DateHistogramInterval.QUARTER;
                    break;
                case MONTH:
                    interval = DateHistogramInterval.MONTH;
                    break;
                case WEEK:
                    interval = DateHistogramInterval.WEEK;
                    break;
                case DAY:
                default:
                    interval = DateHistogramInterval.DAY;
                    break;
            }
        } else {
            interval = DateHistogramInterval.DAY;
        }

        Optional<Long> startBound = startOpt.map(start -> start
                .atStartOfDay(ZoneOffset.UTC)
                .toInstant()
                .toEpochMilli());
        Optional<Long> endBound = endOpt.map(end -> end
                .plusDays(1)
                .atStartOfDay(ZoneOffset.UTC)
                .toInstant()
                .toEpochMilli());

        DateHistogramAggregationBuilder histogramAggregation = AggregationBuilders.dateHistogram("h1")
                .field(aggregateFieldName)
                .minDocCount(1L)
                .calendarInterval(interval);
        if (startBound.isPresent() || endBound.isPresent()) {
            histogramAggregation.hardBounds(new LongBounds(startBound.orElse(null), endBound.orElse(null)));
        }
        SearchRequest searchRequest = new SearchRequest(indexName).source(new SearchSourceBuilder()
                .fetchSource(false)
                .query(queryOpt.orElse(null))
                .size(0)
                .aggregation(histogramAggregation));

        log.trace("Histogram query: {}", searchRequest);

        org.elasticsearch.action.search.SearchResponse search = retry(() -> elastic.get().search(searchRequest, RequestOptions.DEFAULT));

        ImmutableList<HistogramResponsePoints> points = Optional.ofNullable(search.getAggregations())
                .flatMap(ags -> {
                    Iterator<Aggregation> iter = ags.iterator();
                    if (!iter.hasNext()) {
                        return Optional.empty();
                    }
                    Aggregation aggregation = iter.next();
                    if (!(aggregation instanceof ParsedDateHistogram)) {
                        return Optional.empty();
                    }
                    return Optional.of((ParsedDateHistogram) aggregation);
                })
                .map(ParsedDateHistogram::getBuckets)
                .stream()
                .flatMap(Collection::stream)
                .map((Histogram.Bucket b) -> new HistogramResponsePoints(
                        ((ZonedDateTime) b.getKey()).toLocalDate(),
                        b.getDocCount()))
                .sorted(Comparator.comparing(HistogramResponsePoints::getTs))
                .collect(ImmutableList.toImmutableList());

        return new HistogramResponse(points,
                new Hits(
                        search.getHits().getTotalHits().value,
                        search.getHits().getTotalHits().relation == TotalHits.Relation.GREATER_THAN_OR_EQUAL_TO
                                ? true : null));
    }

    /**
     * Based on: https://github.com/elastic/elasticsearch/issues/19862#issuecomment-238263267
     */
    public boolean isIndexAlreadyExistsException(Throwable th) {
        return ResponseException.class.isAssignableFrom(th.getClass())
                && ((ResponseException) th).getResponse().getStatusLine().getStatusCode() == 400
                && (th.getMessage().contains("index_already_exists_exception")
                || th.getMessage().contains("IndexAlreadyExistsException"));
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
