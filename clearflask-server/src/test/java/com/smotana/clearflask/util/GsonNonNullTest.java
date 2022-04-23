// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.inject.Inject;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import static org.junit.Assert.fail;

@Slf4j
public class GsonNonNullTest extends AbstractTest {

    @Inject
    private Gson gson;

    @Override
    protected void configure() {
        super.configure();

        install(GsonProvider.module());
    }

    @Value
    public static class Data {
        @GsonNonNull
        private final String a;
        @GsonNonNull
        private final Double b;
        @GsonNonNull
        private final double c;
        @GsonNonNull
        private final Double[] d;
        @GsonNonNull
        private final double[] e;
    }

    @Value
    public static class Data2 {
        @GsonNonNull
        private final Data a;
        private final Data b;
    }

    @Test(timeout = 10_000L)
    public void testFromJson() throws Exception {
        gson.fromJson("{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"d\":[],\"e\":[]}", Data.class);
        gson.fromJson("", Data.class);
        assertFromJsonThrows("{}", Data.class);
        assertFromJsonThrows("{\"a\":null,\"b\":0.0,\"c\":0.0,\"d\":[],\"e\":[]}", Data.class);
        assertFromJsonThrows("{\"b\":0.0,\"c\":0.0,\"d\":[],\"e\":[]}", Data.class);
        assertFromJsonThrows("{\"a\":\"\",\"b\":null,\"c\":0.0,\"d\":[],\"e\":[]}", Data.class);
        assertFromJsonThrows("{\"a\":\"\",\"c\":0.0,\"d\":[],\"e\":[]}", Data.class);
        gson.fromJson("{\"a\":\"\",\"b\":0.0,\"c\":null,\"d\":[],\"e\":[]}", Data.class);
        gson.fromJson("{\"a\":\"\",\"b\":0.0,\"d\":[],\"e\":[]}", Data.class);
        assertFromJsonThrows("{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"d\":null,\"e\":[]}", Data.class);
        assertFromJsonThrows("{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"e\":[]}", Data.class);
        assertFromJsonThrows("{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"d\":[],\"e\":null}", Data.class);
        assertFromJsonThrows("{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"d\":[]}", Data.class);

        gson.fromJson("{\"a\":{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"d\":[],\"e\":[]},\"b\":{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"d\":[],\"e\":[]}}", Data2.class);
        gson.fromJson("{\"a\":{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"d\":[],\"e\":[]}}", Data2.class);
        gson.fromJson("", Data2.class);
        assertFromJsonThrows("{\"a\":null}", Data2.class);
        assertFromJsonThrows("{}", Data2.class);
        assertFromJsonThrows("{\"a\":{\"b\":0.0,\"c\":0.0,\"d\":[],\"e\":[]}}", Data2.class);
        assertFromJsonThrows("{\"a\":{\"a\":\"\",\"c\":0.0,\"d\":[],\"e\":[]}}", Data2.class);
        gson.fromJson("{\"a\":{\"a\":\"\",\"b\":0.0,\"d\":[],\"e\":[]}}", Data2.class);
        assertFromJsonThrows("{\"a\":{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"e\":[]}}", Data2.class);
        assertFromJsonThrows("{\"a\":{\"a\":\"\",\"b\":0.0,\"c\":0.0,\"d\":[]}}", Data2.class);
    }

    @Test(timeout = 10_000L)
    public void testToJson() throws Exception {
        gson.toJson(new Data("", 0d, 0d, new Double[0], new double[0]));
        gson.toJson((Data) null);
        assertToJsonThrows(new Data(null, 1d, 1d, new Double[0], new double[0]));
        assertToJsonThrows(new Data("", null, 1d, new Double[0], new double[0]));
        assertToJsonThrows(new Data("", 1d, 1d, null, new double[0]));
        assertToJsonThrows(new Data("", 1d, 1d, new Double[0], null));

        gson.toJson(new Data2(new Data("", 0d, 0d, new Double[0], new double[0]), new Data("", 0d, 0d, new Double[0], new double[0])));
        gson.toJson(new Data2(new Data("", 0d, 0d, new Double[0], new double[0]), null));
        assertToJsonThrows(new Data2(null, null));
        assertToJsonThrows(new Data2(new Data(null, 0d, 0d, new Double[0], new double[0]), null));
        assertToJsonThrows(new Data2(new Data("", null, 0d, new Double[0], new double[0]), null));
        assertToJsonThrows(new Data2(new Data("", 0d, 0d, null, new double[0]), null));
        assertToJsonThrows(new Data2(new Data("", 0d, 0d, new Double[0], null), null));
    }

    void assertFromJsonThrows(String data, Class clazz) {
        try {
            gson.fromJson(data, clazz);
        } catch (IllegalArgumentException ex) {
            return;
        }
        fail();
    }

    void assertToJsonThrows(Object data) {
        try {
            gson.toJson(data);
        } catch (IllegalArgumentException ex) {
            return;
        }
        fail();
    }
}