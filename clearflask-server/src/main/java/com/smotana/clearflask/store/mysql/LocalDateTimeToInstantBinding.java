package com.smotana.clearflask.store.mysql;

import org.jooq.*;
import org.jooq.impl.DefaultBinding;

import java.sql.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Calendar;
import java.util.TimeZone;

public class LocalDateTimeToInstantBinding implements Binding<LocalDateTime, Instant> {

    private static final long serialVersionUID = 1;

    private final Converter<LocalDateTime, Instant> converter;
    private final Binding<LocalDateTime, Instant> delegate;

    public LocalDateTimeToInstantBinding() {
        this.converter = new LocalDateTimeToInstantConverter();
        this.delegate = DefaultBinding.binding(this.converter);
    }

    @Override
    public final Converter<LocalDateTime, Instant> converter() {
        return converter;
    }

    @Override
    public final void sql(BindingSQLContext<Instant> ctx) throws SQLException {
        delegate.sql(ctx);
    }

    @Override
    public final void register(BindingRegisterContext<Instant> ctx) throws SQLException {
        delegate.register(ctx);
    }

    @Override
    public final void set(BindingSetStatementContext<Instant> ctx) throws SQLException {
        Instant value = ctx.value();
        PreparedStatement statement = ctx.statement();
        if (value == null) {
            statement.setNull(ctx.index(), Types.TIMESTAMP);
        } else {
            Timestamp timestamp = Timestamp.from(value);
            TimeZone utcTimeZone = TimeZone.getTimeZone(ZoneId.of(ZoneOffset.UTC.getId()));
            Calendar calendar = Calendar.getInstance(utcTimeZone);
            statement.setTimestamp(ctx.index(), timestamp, calendar);
        }
    }

    @Override
    public final void set(BindingSetSQLOutputContext<Instant> ctx) throws SQLException {
        delegate.set(ctx);
    }

    @Override
    public final void get(BindingGetResultSetContext<Instant> ctx) throws SQLException {
        ResultSet resultSet = ctx.resultSet();
        TimeZone utcTimeZone = TimeZone.getTimeZone(ZoneId.of(ZoneOffset.UTC.getId()));
        Calendar calendar = Calendar.getInstance(utcTimeZone);
        Timestamp timestampUtc = resultSet.getTimestamp(ctx.index(), calendar);

        if (timestampUtc == null) {
            ctx.value(null);
        } else {
            ctx.value(timestampUtc.toInstant());
        }
    }

    @Override
    public final void get(BindingGetStatementContext<Instant> ctx) throws SQLException {
        delegate.get(ctx);
    }

    @Override
    public final void get(BindingGetSQLInputContext<Instant> ctx) throws SQLException {
        delegate.get(ctx);
    }
}
