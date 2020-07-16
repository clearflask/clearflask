package com.smotana.clearflask.util;

import com.google.gson.Gson;
import com.google.gson.annotations.JsonAdapter;
import com.google.inject.Inject;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.Value;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class ExplicitNullTest extends AbstractTest {

    @Inject
    private Gson gson;

    @Override
    protected void configure() {
        super.configure();

        install(GsonProvider.module());
    }

    @Value
    public static class Data {
        private final String myString;
        private final Double myDouble;
    }

    @Value
    public static class DataA {
        private final String myString;
        private final Double myDouble;
        private final Data myData;
    }

    @JsonAdapter(ExplicitNull.class)
    @Value
    public static class DataB {
        private final String myString;
        private final Double myDouble;
        private final Data myData1;
        private final Data myData2;
    }

    @Value
    public static class DataC {
        @JsonAdapter(ExplicitNull.class)
        private final String myString;
        private final Double myDouble;
        @JsonAdapter(ExplicitNull.class)
        private final Data myData1;
        @JsonAdapter(ExplicitNull.class)
        private final Data myData2;
    }

    @Value
    public static class DataD {
        private final DataB myDataB;
        private final DataC myDataC;
    }

    @Test(timeout = 10_000L)
    public void testAnnotation() throws Exception {
        assertEquals("{}",
                gson.toJson(new DataA(null, null, null)));
        assertEquals("{\"myString\":null,\"myDouble\":null,\"myData1\":null,\"myData2\":{\"myString\":null,\"myDouble\":null}}",
                gson.toJson(new DataB(null, null, null, new Data(null, null))));
        assertEquals("{\"myData2\":{\"myString\":null,\"myDouble\":null}}",
                gson.toJson(new DataC(null, null, null, new Data(null, null))));
        assertEquals("{}",
                gson.toJson(new DataD(null, null)));
        assertEquals("{\"myDataB\":{\"myString\":null,\"myDouble\":null,\"myData1\":null,\"myData2\":{\"myString\":null,\"myDouble\":null}},\"myDataC\":{\"myData2\":{\"myString\":null,\"myDouble\":null}}}",
                gson.toJson(new DataD(new DataB(null, null, null, new Data(null, null)), new DataC(null, null, null, new Data(null, null)))));
    }
}