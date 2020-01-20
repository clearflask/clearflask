package com.smotana.clearflask.util;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import com.google.gson.TypeAdapter;
import com.google.gson.TypeAdapterFactory;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonWriter;

import java.io.IOException;
import java.lang.reflect.Type;

/**
 * A way to force serializing an explicit null value using Gson.
 * There are two ways to use this:
 * - Inline serialization of an instance of this class such as ImmutableList.of(ExplicitNull.get())
 * - Annotate a model class or field with @JsonAdapter(ExplicitNull.class)
 * Note: If you annotate a field, the field itself won't be explicitly null, just the fields of that class will be.
 */
public class ExplicitNull implements TypeAdapterFactory, JsonSerializer<ExplicitNull> {

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
    public JsonElement serialize(ExplicitNull src, Type typeOfSrc, JsonSerializationContext context) {
        return JsonNull.INSTANCE;
    }

    @Override
    public <T> TypeAdapter<T> create(Gson gson, TypeToken<T> type) {
        final TypeAdapter<T> delegate = gson.getDelegateAdapter(this, type);
        return new TypeAdapter<T>() {
            @Override
            public void write(JsonWriter out, T value) throws IOException {
                boolean serializeNullsPrev = out.getSerializeNulls();
                out.setSerializeNulls(true);
                delegate.write(out, value);
                out.setSerializeNulls(serializeNullsPrev);
            }

            @Override
            public T read(JsonReader reader) throws IOException {
                return delegate.read(reader);
            }
        };
    }
}
