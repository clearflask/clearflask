package com.smotana.clearflask.store.mysql;

import org.jooq.DataType;
import org.jooq.impl.BuiltInDataType;
import org.jooq.impl.DatetimeAutoUpdate;
import org.jooq.impl.SQLDataType;

import java.time.LocalDateTime;

public class MoreSQLDataType {
    public static DataType<LocalDateTime> DATETIME() {
        return DATETIME;
    }

    public static DataType<LocalDateTime> DATETIME(int precision) {
        return DATETIME.precision(precision);
    }

    public static DataType<LocalDateTime> DATETIME_AUTO_UPDATE() {
        return DATETIME_AUTO_UPDATE(0);
    }

    public static DataType<LocalDateTime> DATETIME_AUTO_UPDATE(int precision) {
        return DATETIME.precision(precision)
                .default_(new DatetimeAutoUpdate<>(SQLDataType.LOCALDATETIME.notNull(), precision));
    }

    public static final DataType<LocalDateTime> DATETIME = new BuiltInDataType<>(LocalDateTime.class, "datetime(p)");
}
