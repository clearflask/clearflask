package com.smotana.clearflask.util;

import com.dampcake.gson.immutable.ImmutableAdapterFactory;
import com.google.gson.FieldNamingPolicy;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;

@Singleton
public class GsonProvider implements Provider<Gson> {
    public static final Gson GSON = new GsonBuilder()
            .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
            .disableHtmlEscaping()
            .registerTypeAdapterFactory(ImmutableAdapterFactory.forGuava())
            .create();

    @Override
    public Gson get() {
        return GSON;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Gson.class).toProvider(GsonProvider.class).asEagerSingleton();
            }
        };
    }
}
