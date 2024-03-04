// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.testutil;

import com.google.common.io.Resources;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.*;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigConfigurator;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.convert.FileDynamicConfigSourceManagedService;
import com.kik.config.ice.convert.MoreConfigValueConverters;
import com.kik.config.ice.exception.ConfigException;
import com.kik.config.ice.naming.ConfigNamingStrategy;
import com.kik.config.ice.source.DebugDynamicConfigSource;
import com.kik.config.ice.source.FileDynamicConfigSource;
import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.core.ServiceManagerProvider;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.util.GsonProvider;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.junit.After;
import org.junit.Before;
import org.mockito.Mockito;

import javax.annotation.Nullable;
import java.util.Optional;

import static org.junit.Assert.assertTrue;

@Slf4j
public abstract class AbstractTest extends AbstractModule {

    public interface Config {
        @DefaultValue("false")
        boolean testConfigInjectionAndOverridePassed();
    }

    @Inject
    protected Injector injector;
    @Inject
    protected DebugDynamicConfigSource configSource;

    @Inject
    private Config config;
    @Inject
    private ServiceManager serviceManager;
    @Inject
    private ConfigNamingStrategy configNamingStrategy;

    @Nullable
    protected SearchEngine overrideSearchEngine = null;

    @Before
    public void setup() throws Exception {
        injector = Guice.createInjector(Stage.DEVELOPMENT, new AbstractModule() {
            @Override
            protected void configure() {
                install(Modules.override(
                        new AbstractModule() {
                            @Override
                            protected void configure() {
                                bind(ServiceInjector.Environment.class).toInstance(ServiceInjector.Environment.TEST);
                                install(ServiceManagerProvider.module());
                                install(GsonProvider.module());
                                install(ConfigConfigurator.testModules());
                                install(MoreConfigValueConverters.module());
                            }
                        }
                ).with(AbstractTest.this));
            }
        });
        injector.injectMembers(this);

        assertTrue(config.testConfigInjectionAndOverridePassed());

        log.info("starting services");
        serviceManager.startAsync().awaitHealthy();
        log.info("started services");
    }

    @After
    public void cleanup() throws Exception {
        if (serviceManager != null) {
            log.info("stopping services");
            serviceManager.stopAsync().awaitStopped();
            log.info("stopped services");
        }
    }

    protected void bindMock(Class clazz) {
        bind(clazz).toInstance(Mockito.mock(clazz));
    }

    protected void configure() {
        super.configure();

        install(ConfigSystem.configModule(Config.class));
        install(FileDynamicConfigSourceManagedService.module());
        bind(String.class).annotatedWith(Names.named(FileDynamicConfigSource.FILENAME_NAME))
                .toInstance(Resources.getResource("config-test.cfg").getFile());

        install(Modules.override(
                Application.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(Application.Config.class, om -> {
                    Optional.ofNullable(overrideSearchEngine).ifPresent(searchEngine -> om.override(om.id().defaultSearchEngine()).withValue(searchEngine));
                    om.override(om.id().startupWaitUntilDeps()).withValue(Boolean.TRUE);
                    om.override(om.id().domain()).withValue("localhost:8080");
                    om.override(om.id().createIndexesOnStartup()).withValue(true);
                }));
            }
        }));
    }

    protected void configUnset(Class configClass, String methodName) throws NoSuchMethodException, ConfigException {
        configSet(configClass, methodName, Optional.empty(), Optional.empty());
    }

    protected void configUnset(Class configClass, String methodName, String scope) throws NoSuchMethodException, ConfigException {
        configSet(configClass, methodName, Optional.empty(), Optional.of(scope));
    }

    protected void configSet(Class configClass, String methodName, String value) throws NoSuchMethodException, ConfigException {
        configSet(configClass, methodName, Optional.of(value), Optional.empty());
    }

    protected void configSet(Class configClass, String methodName, String value, String scope) throws NoSuchMethodException, ConfigException {
        configSet(configClass, methodName, Optional.of(value), Optional.of(scope));
    }

    private void configSet(Class configClass, String methodName, Optional<String> valueOpt, Optional<String> scopeOpt) throws NoSuchMethodException, ConfigException {
        // TODO support scope as well
        String configName = configNamingStrategy.methodToFlatName(configClass.getMethod(methodName), scopeOpt);
        configSource.fireEvent(configName, valueOpt);
    }
}
