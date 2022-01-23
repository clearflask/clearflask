// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import com.google.gson.Gson;
import com.google.inject.Inject;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.HashMap;

import static org.junit.Assert.assertEquals;

@Slf4j
public class ExplicitNullTest extends AbstractTest {

    @Inject
    private Gson gson;

    @Override
    protected void configure() {
        super.configure();

        install(GsonProvider.module());
    }

    @Test(timeout = 10_000L)
    public void testOrNull() throws Exception {
        HashMap<Object, Object> mapWithNull = Maps.newHashMap();
        mapWithNull.put("a", null);
        assertEquals("{}",
                gson.toJson(mapWithNull));
        assertEquals("null",
                gson.toJson(null));
        assertEquals("null",
                gson.toJson(ExplicitNull.get()));
        assertEquals("{\"a\":null}",
                gson.toJson(ImmutableMap.of("a", ExplicitNull.get())));
        assertEquals("{\"a\":7}",
                gson.toJson(ImmutableMap.of("a", ExplicitNull.orNull(7L))));
        log.debug("asd: {}", ImmutableMap.of("a", ExplicitNull.orNull((Long) null)));
        assertEquals("{\"a\":null}",
                gson.toJson(ImmutableMap.of("a", ExplicitNull.orNull((Long) null))));
    }
}