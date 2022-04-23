// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.gson.Gson;
import com.google.gson.TypeAdapter;
import com.google.gson.TypeAdapterFactory;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;

/**
 * A way to force serializing an explicit null value using Gson.
 * Usage:
 * - ImmutableMap.of("a", ExplicitNull.get())
 * - ImmutableMap.of("a", ExplicitNull.orNull(varThatMayBeNull))
 */
public class ExplicitNull implements TypeAdapterFactory {

    private static final ExplicitNull instance = new ExplicitNull();

    private ExplicitNull() {
        // disable ctor
    }

    public static final ExplicitNull get() {
        return instance;
    }

    public static final Object orNull(Object o) {
        return o == null ? instance : o;
    }

    @Override
    public <T> TypeAdapter<T> create(Gson gson, TypeToken<T> type) {
        if (gson.serializeNulls() || !(type.getRawType().isAssignableFrom(ExplicitNull.class))) {
            return null;
        }
        return new TypeAdapter<T>() {
            @Override
            public void write(JsonWriter out, T value) throws IOException {
                out.jsonValue("null");
            }

            @Override
            public T read(JsonReader reader) throws IOException {
                return null;
            }
        };
    }

    @Override
    public String toString() {
        return "null";
    }
}
