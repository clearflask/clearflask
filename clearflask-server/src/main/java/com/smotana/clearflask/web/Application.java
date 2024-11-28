// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web;

import com.google.inject.AbstractModule;
import com.google.inject.Injector;
import com.google.inject.Key;
import com.google.inject.Module;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.security.limiter.LimiterDynamicFeature;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.web.security.AuthenticationFilter;
import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.hk2.api.ServiceLocator;
import org.glassfish.jersey.media.sse.SseFeature;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.server.filter.RolesAllowedDynamicFeature;
import org.jvnet.hk2.guice.bridge.api.GuiceBridge;
import org.jvnet.hk2.guice.bridge.api.GuiceIntoHK2Bridge;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.ApplicationPath;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Singleton
@ApplicationPath("/")
public class Application extends ResourceConfig {
    public static final String RESOURCE_VERSION = "/v1";
    public static final String RESOURCE_NAME = "resource";

    public interface Config {
        @DefaultValue("clearflask.com")
        String domain();

        @DefaultValue("false")
        boolean startupWaitUntilDeps();

        /**
         * Create Global ElasticSearch/Mysql,Dynamo indexes/tables on app startup
         */
        @DefaultValue("false")
        boolean createIndexesOnStartup();

        /**
         * Unless otherwise override by below force config or project-specific value, this takes effect
         */
        @DefaultValue("READWRITE_ELASTICSEARCH")
        SearchEngine defaultSearchEngine();

        /**
         * Force engine regardless of default or project-specific value, this takes effect if set
         */
        @NoDefaultValue(innerType = SearchEngine.class)
        Optional<SearchEngine> forceSearchEngine();

        /**
         * Determines whether telemetry is sent back to ClearFlask for usage and support purposes.
         * Intended for self-hosted instances.
         */
        @DefaultValue("true")
        boolean enableTelemetry();
    }

    @Inject
    public Application(ServiceLocator serviceLocator) {
        super();

        Injector injector = ServiceInjector.INSTANCE.get();

        Config config = injector.getInstance(Config.class);
        ServiceInjector.Environment env = injector.getInstance(ServiceInjector.Environment.class);
        if (config.enableTelemetry()) {
            log.info("Initializing Sentry");
            Sentry.init(options -> {
                options.setEnvironment(env.name());
                options.setSampleRate(1d);
                options.setTracesSampleRate(1d);
                options.setDsn("https://600460a790e34b3e884ebe25ed26944d@o934836.ingest.sentry.io/5884409");
            });
        }

        log.info("Initializing Application");
        // Register specific resources that are enabled via Guice bindings
        injector.getInstance(new Key<Set<Object>>(Names.named(RESOURCE_NAME)) {
        }).forEach(this::register);
        register(GsonMessageBody.class);
        register(AuthenticationFilter.class);
        register(RolesAllowedDynamicFeature.class);
        register(LimiterDynamicFeature.class);
        register(SseFeature.class);

        log.info("Initializing HK2-Guice bridge");
        GuiceBridge.getGuiceBridge().initializeGuiceBridge(serviceLocator);
        serviceLocator.getService(GuiceIntoHK2Bridge.class)
                .bridgeGuiceInjector(injector);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
