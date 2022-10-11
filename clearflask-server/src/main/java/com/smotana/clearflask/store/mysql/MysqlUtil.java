// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.mysql;

import com.google.common.collect.ImmutableList;
import com.google.common.primitives.Ints;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.HistogramInterval;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramResponsePoints;
import com.smotana.clearflask.api.model.Hits;
import com.smotana.clearflask.store.elastic.ElasticUtil.ConfigSearch;
import com.smotana.clearflask.store.impl.DynamoElasticMysqlIdeaStore.SearchIdeasConditions;
import com.smotana.clearflask.util.MathUtil;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.jooq.Condition;
import org.jooq.CreateIndexIncludeStep;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.JoinType;
import org.jooq.Queries;
import org.jooq.Query;
import org.jooq.Record;
import org.jooq.Record4;
import org.jooq.Table;
import org.jooq.TableField;
import org.jooq.exception.DataAccessException;
import org.jooq.exception.SQLStateClass;
import org.jooq.impl.DSL;

import java.io.Reader;
import java.io.StringReader;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collection;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class MysqlUtil {
    @Inject
    private DSLContext mysql;

    private final Pattern similarTextExtractor = Pattern.compile("(\\w{4,})");

    @SafeVarargs
    public final Condition similarToCondition(String text, TableField<?, String>... fields) {
        Matcher matcher = similarTextExtractor.matcher(text);
        Condition condition = DSL.noCondition();
        int words = 0;
        while (matcher.find() && ++words < 3) {
            for (TableField<?, String> field : fields) {
                condition = condition.or(field.like("%" + matcher.group(1) + "%"));
            }
        }
        return condition;
    }

    public CompletionStage<Integer> sequentialBatch(Queries queries) {
        @NotNull Query[] qs = queries.queries();
        if (qs.length <= 0) {
            return CompletableFuture.completedFuture(0);
        }
        CompletionStage<Integer> completionStage = qs[0].executeAsync();
        for (int i = 1; i < qs.length; i++) {
            Query nextQuery = qs[i];
            completionStage = completionStage.thenCompose(count -> nextQuery.executeAsync());
        }
        return completionStage;
    }

    public void createIndexIfNotExists(CreateIndexIncludeStep query) {
        try {
            query.execute();
        } catch (DataAccessException ex) {
            if (SQLStateClass.C42_SYNTAX_ERROR_OR_ACCESS_RULE_VIOLATION.equals(ex.sqlStateClass())
                    && ex.getMessage().contains("Duplicate key name")) {
                log.debug("Index already exists: {}", ex.getMessage());
            } else {
                throw ex;
            }
        }
    }

    public void createFunctionIfNotExists(MysqlCustomFunction fun) {
        try {
            mysql.connection(connection -> {
                try (Reader sourceReader = new StringReader(fun.getSource())) {
                    new ScriptRunner(connection, false, true)
                            .runScript(sourceReader);
                }
            });
        } catch (DataAccessException ex) {
            if (SQLStateClass.NONE.equals(ex.sqlStateClass())
                    && ex.getMessage().contains("already exists")) {
                log.debug("Function already exists: {}", ex.getMessage());
            } else {
                throw ex;
            }
        }
    }

    @Value
    public static class Join {
        Table table;
        JoinType type;
        Condition on;
    }

    public <R extends Record> Table<R> join(Table<R> table, ImmutableList<Join> joins) {
        Table returnTable = table;
        for (Join join : joins) {
            returnTable = returnTable.join(join.getTable(), join.getType())
                    .on(join.getOn());
        }
        return (Table<R>) returnTable;
    }

    public <R extends Record> HistogramResponse histogram(
            Table<R> table,
            Field<Instant> aggregateFieldName,
            Optional<LocalDate> startOpt,
            Optional<LocalDate> endOpt,
            Optional<HistogramInterval> intervalOpt,
            Optional<SearchIdeasConditions> searchIdeasOpt) {
        Field<Integer> intervalField;
        switch (intervalOpt.orElse(HistogramInterval.DAY)) {
            case YEAR:
                intervalField = DSL.year(aggregateFieldName);
                break;
            case QUARTER:
                intervalField = DSL.quarter(aggregateFieldName);
                break;
            case MONTH:
                intervalField = DSL.month(aggregateFieldName);
                break;
            case WEEK:
                intervalField = DSL.week(aggregateFieldName);
                break;
            case DAY:
            default:
                intervalField = DSL.day(aggregateFieldName);
                break;
        }

        Optional<Condition> startBoundOpt = startOpt.map(start -> start
                        .atStartOfDay(ZoneOffset.UTC)
                        .toInstant())
                .map(aggregateFieldName::greaterOrEqual);
        Optional<Condition> endBoundOpt = endOpt.map(end -> end
                        .plusDays(1)
                        .atStartOfDay(ZoneOffset.UTC)
                        .toInstant())
                .map(aggregateFieldName::lessThan);
        HistogramResponse.HistogramResponseBuilder histogramBuilder = HistogramResponse.builder();
        try (Stream<Record4<Integer, Integer, Integer, Integer>> stream = mysql.select(
                        DSL.year(aggregateFieldName),
                        DSL.month(aggregateFieldName),
                        DSL.day(aggregateFieldName),
                        DSL.countDistinct(table.getPrimaryKey().getFieldsArray()))
                .from(join(table, searchIdeasOpt.map(SearchIdeasConditions::getJoins).orElse(ImmutableList.of())))
                .where(and(searchIdeasOpt.map(SearchIdeasConditions::getConditions), startBoundOpt, endBoundOpt))
                .groupBy(intervalField)
                .stream()) {
            AtomicLong count = new AtomicLong(0);
            histogramBuilder.points(stream.map(record -> {
                        count.addAndGet(record.component4());
                        return new HistogramResponsePoints(
                                LocalDate.of(record.component1(), record.component2(), record.component3()),
                                record.component4().longValue());
                    })
                    .collect(ImmutableList.toImmutableList()));
            histogramBuilder.hits(new Hits(count.get(), true));
        }
        return histogramBuilder.build();
    }

    @SafeVarargs
    public final Condition and(Optional<Condition>... conditions) {
        return Arrays.stream(conditions)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .reduce(DSL.noCondition(), Condition::and);
    }

    public Condition and(Condition... conditions) {
        return Arrays.stream(conditions)
                .reduce(DSL.noCondition(), Condition::and);
    }

    public Condition and(Collection<Condition> conditions) {
        return conditions.stream()
                .reduce(DSL.noCondition(), Condition::and);
    }

    public int offset(Optional<String> cursorOpt) {
        return cursorOpt.map(Ints::tryParse)
                .filter(Objects::nonNull)
                .orElse(0);
    }

    public int limit(ConfigSearch configSearch, Optional<Integer> sizeOpt) {
        if (sizeOpt.isPresent()) {
            return MathUtil.minmax(1, sizeOpt.get(), configSearch.pageSizeMax());
        } else {
            return configSearch.pageSizeDefault();
        }
    }

    public Optional<String> nextCursor(ConfigSearch configSearch, Optional<String> cursorOpt, Optional<Integer> sizeOpt, int resultSize) {
        int limit = limit(configSearch, sizeOpt);
        int offset = offset(cursorOpt);
        return resultSize < limit ? Optional.empty() : Optional.of(String.valueOf(offset + limit));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(MysqlUtil.class).asEagerSingleton();
            }
        };
    }
}
