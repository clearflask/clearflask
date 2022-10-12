package com.smotana.clearflask.store.mysql;

import org.jooq.impl.AbstractConverter;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public class LocalDateTimeToInstantConverter extends AbstractConverter<LocalDateTime, Instant> {

    public LocalDateTimeToInstantConverter() {
        super(LocalDateTime.class, Instant.class);
    }

    @Override
    public Instant from(LocalDateTime t) {
        return t == null ? null : t.toInstant(ZoneOffset.UTC);
    }

    @Override
    public LocalDateTime to(Instant u) {
        return u == null ? null : LocalDateTime.ofInstant(u, ZoneOffset.UTC);
    }
}
