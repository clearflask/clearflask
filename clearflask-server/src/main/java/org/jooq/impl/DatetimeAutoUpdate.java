package org.jooq.impl;

import org.jooq.Context;
import org.jooq.DataType;

import static org.jooq.impl.Names.N_CURRENT_TIMESTAMP;

/**
 * Appends on update current_timestamp via default injection
 */
public final class DatetimeAutoUpdate<T> extends AbstractField<T> implements QOM.CurrentTimestamp<T> {

    private final int precision;

    public DatetimeAutoUpdate(DataType<T> type) {
        this(type, 0);
    }

    public DatetimeAutoUpdate(DataType<T> type, int precision) {
        super(N_CURRENT_TIMESTAMP, type);

        this.precision = precision;
    }

    @Override
    public void accept(Context<?> ctx) {
        switch (ctx.family()) {
            case MYSQL:
                ctx.visit(N_CURRENT_TIMESTAMP)
                        .sql('(')
                        .sql(precision)
                        .sql(')')
                        .sql(" on update ")
                        .visit(N_CURRENT_TIMESTAMP)
                        .sql('(')
                        .sql(precision)
                        .sql(')');
                break;
            default:
                throw new RuntimeException("Family not supported: " + ctx.family());
        }
    }
}
