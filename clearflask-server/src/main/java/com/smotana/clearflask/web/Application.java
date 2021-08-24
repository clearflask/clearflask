// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.security.limiter.LimiterDynamicFeature;
import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.hk2.api.ServiceLocator;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.server.filter.RolesAllowedDynamicFeature;
import org.jvnet.hk2.guice.bridge.api.GuiceBridge;
import org.jvnet.hk2.guice.bridge.api.GuiceIntoHK2Bridge;

import javax.inject.Inject;
import javax.ws.rs.ApplicationPath;

@Slf4j
@ApplicationPath("/")
public class Application extends ResourceConfig {
    public static final String RESOURCE_VERSION = "/v1";

    public interface Config {
        @DefaultValue("clearflask.com")
        String domain();
    }

    @Inject
    public Application(ServiceLocator serviceLocator) {
        super();
        log.info("Initializing Sentry");
        Sentry.init(options -> {
            ServiceInjector.Environment env = ServiceInjector.detectEnvironment();
            options.setEnvironment(env.name());
            options.setTracesSampleRate(env.isProduction() ? 0.1d : 1d);
            options.setDsn("https://600460a790e34b3e884ebe25ed26944d@o934836.ingest.sentry.io/5884409");
        });

        log.info("Initializing Application");
        packages(getClass().getPackage().getName());

        register(RolesAllowedDynamicFeature.class);
        register(LimiterDynamicFeature.class);

        log.info("Initializing HK2-Guice bridge");
        GuiceBridge.getGuiceBridge().initializeGuiceBridge(serviceLocator);
        serviceLocator.getService(GuiceIntoHK2Bridge.class)
                .bridgeGuiceInjector(ServiceInjector.INSTANCE.get());
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
