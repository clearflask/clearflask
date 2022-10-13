// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.mysql;

import com.google.common.collect.ImmutableList;
import com.google.common.primitives.Ints;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.smotana.clearflask.api.model.HistogramInterval;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramResponsePoints;
import com.smotana.clearflask.api.model.Hits;
import com.smotana.clearflask.store.elastic.ElasticUtil.ConfigSearch;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore.SearchIdeasConditions;
import com.smotana.clearflask.util.MathUtil;
import com.smotana.clearflask.util.ServerSecret;
import lombok.SneakyThrows;
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
import org.jooq.Table;
import org.jooq.TableField;
import org.jooq.exception.DataAccessException;
import org.jooq.exception.SQLStateClass;
import org.jooq.impl.DSL;

import javax.annotation.Nullable;
import java.io.Reader;
import java.io.StringReader;
import java.sql.SQLException;
import java.sql.SQLSyntaxErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Collection;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Singleton
public class MysqlUtil {
    @Inject
    private Provider<DSLContext> mysql;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;

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
            completionStage = completionStage.thenComposeAsync(count -> nextQuery.executeAsync());
        }
        return completionStage;
    }

    public void createIndexIfNotExists(CreateIndexIncludeStep query) {
        try {
            query.execute();
        } catch (DataAccessException ex) {
            Optional<String> causeSqlExMessageOpt = Optional.ofNullable(ex.getCause(SQLSyntaxErrorException.class))
                    .map(SQLException::getMessage);
            @Nullable SQLStateClass sqlStateClass = ex.sqlStateClass();
            if (SQLStateClass.C42_SYNTAX_ERROR_OR_ACCESS_RULE_VIOLATION.equals(sqlStateClass)
                    && causeSqlExMessageOpt.filter(msg -> msg.contains("Duplicate key name")).isPresent()) {
                log.debug("Index already exists: {}", ex.getMessage());
            } else {
                throw new RuntimeException("Failed to create index with SQL cause " + Optional.ofNullable(sqlStateClass) + " msg " + causeSqlExMessageOpt, ex);
            }
        }
    }

    public void createFunctionIfNotExists(MysqlCustomFunction fun) {
        try {
            mysql.get().connection(connection -> {
                try (Reader sourceReader = new StringReader(fun.getSource())) {
                    new ScriptRunner(connection, false, true)
                            .runScript(sourceReader);
                }
            });
        } catch (DataAccessException ex) {
            Optional<String> causeSqlSyntaxExMessageOpt = Optional.ofNullable(ex.getCause(SQLSyntaxErrorException.class))
                    .map(SQLException::getMessage);
            @Nullable SQLStateClass sqlStateClass = ex.sqlStateClass();
            if ((SQLStateClass.C42_SYNTAX_ERROR_OR_ACCESS_RULE_VIOLATION.equals(sqlStateClass)
                    || SQLStateClass.NONE.equals(sqlStateClass))
                    && causeSqlSyntaxExMessageOpt.filter(msg -> msg.contains("already exists")).isPresent()) {
                log.debug("Function already exists: {}", ex.getMessage());
            } else {
                throw new RuntimeException("Failed to create function with SQL cause " + Optional.ofNullable(sqlStateClass) + " msg " + causeSqlSyntaxExMessageOpt, ex);
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

    @SneakyThrows
    public <R extends Record> HistogramResponse histogram(
            Table<R> table,
            Condition projectIdCondition,
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


        CompletionStage<Void> pointsCompletionStage = mysql.get().select(
                        DSL.year(aggregateFieldName),
                        DSL.month(aggregateFieldName),
                        DSL.day(aggregateFieldName),
                        DSL.countDistinct(table.getPrimaryKey().getFieldsArray()))
                .from(join(table, searchIdeasOpt.map(SearchIdeasConditions::getJoins).orElse(ImmutableList.of())))
                .where(projectIdCondition, and(
                        searchIdeasOpt.map(SearchIdeasConditions::getConditions),
                        searchIdeasOpt.map(SearchIdeasConditions::getConditionsRange),
                        startBoundOpt,
                        endBoundOpt))
                .groupBy(intervalField)
                .fetchAsync()
                .thenAcceptAsync(result -> histogramBuilder.points(result.stream()
                        .map(record -> new HistogramResponsePoints(
                                LocalDate.of(record.component1(), record.component2(), record.component3()),
                                record.component4().longValue()))
                        .collect(ImmutableList.toImmutableList())));

        CompletionStage<Void> hitsCompletionStage = mysql.get().select(
                        DSL.countDistinct(table.getPrimaryKey().getFieldsArray()))
                .from(join(table, searchIdeasOpt.map(SearchIdeasConditions::getJoins).orElse(ImmutableList.of())))
                .where(projectIdCondition, and(searchIdeasOpt.map(SearchIdeasConditions::getConditions)))
                .fetchAsync()
                .thenAcceptAsync(result -> histogramBuilder.hits(
                        new Hits(result.get(0).component1().longValue(), null)));

        CompletionStageUtil.toSettableFuture(pointsCompletionStage, hitsCompletionStage).get();
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
        return cursorOpt
                .map(serverSecretCursor::decryptString)
                .map(Ints::tryParse)
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
        return resultSize < limit
                ? Optional.empty()
                : Optional.of(String.valueOf(offset + limit))
                .map(serverSecretCursor::encryptString);
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
