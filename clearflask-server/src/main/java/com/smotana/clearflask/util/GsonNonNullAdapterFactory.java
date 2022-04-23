// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.gson.TypeAdapter;
import com.google.gson.TypeAdapterFactory;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;
import java.lang.reflect.Field;
import java.util.Arrays;

/**
 * Force Gson to abide by Lombok's @NonNull annotation.
 */
public class GsonNonNullAdapterFactory implements TypeAdapterFactory {
    public <T> TypeAdapter<T> create(Gson gson, TypeToken<T> type) {
        final TypeAdapter<T> delegate = gson.getDelegateAdapter(this, type);
//        if (type.getRawType().isPrimitive()) {
//            return delegate;
//        }
        boolean parentHasNonNull = type.getRawType().isAnnotationPresent(GsonNonNull.class);
        ImmutableList<Field> nonNullFields = Arrays.stream(type.getRawType().getDeclaredFields())
//                .filter(field -> !field.getType().isPrimitive())
                .filter(field -> field.isAnnotationPresent(GsonNonNull.class))
                .collect(ImmutableList.toImmutableList());
        if (nonNullFields.isEmpty()) {
            return delegate;
        }
        nonNullFields.forEach(field -> field.setAccessible(true));
        return new TypeAdapter<T>() {
            @Override
            public void write(JsonWriter out, T value) throws IOException {
                assertNonNull(value);
                delegate.write(out, value);
            }

            @Override
            public T read(JsonReader in) throws IOException {
                T instance = delegate.read(in);
                assertNonNull(instance);
                return instance;
            }

            private void assertNonNull(T instance) {
                if (instance == null) {
                    if (parentHasNonNull) {
                        throw new IllegalArgumentException("Json missing class " + type.getRawType());
                    } else {
                        return;
                    }
                }
                for (Field field : nonNullFields) {
                    Object o;
                    try {
                        o = field.get(instance);
                    } catch (IllegalAccessException ex) {
                        throw new IllegalStateException(ex);
                    }
                    if (o == null) {
                        throw new IllegalArgumentException("Json missing non null field " + field.getName() + " in class " + instance.getClass());
                    }
                }
            }
        };
    }
}
