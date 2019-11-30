package com.smotana.clearflask.core;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.AbstractModule;
import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.Module;
import com.google.inject.Stage;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.convert.ConfigValueConverters;
import com.kik.config.ice.interceptor.NoopConfigValueInterceptor;
import com.kik.config.ice.internal.ConfigDescriptorHolder;
import com.kik.config.ice.naming.SimpleConfigNamingStrategy;
import com.kik.config.ice.source.FileDynamicConfigSource;
import com.kik.config.ice.source.JmxDynamicConfigSource;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.ProductionDynamoDbProvider;
import com.smotana.clearflask.store.elastic.InMemoryElasticSearchProvider;
import com.smotana.clearflask.store.elastic.ProductionElasticSearchProvider;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.util.BeanUtil;
import com.smotana.clearflask.util.GsonProvider;
import com.smotana.clearflask.web.resource.PingResource;
import com.smotana.clearflask.web.resource.api.AccountResource;
import com.smotana.clearflask.web.resource.api.PlanResource;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import javax.management.MBeanServer;
import java.lang.management.ManagementFactory;
import java.time.Duration;

@Slf4j
@NoArgsConstructor
public enum ServiceInjector {
    INSTANCE;

    public enum Environment {
        UNIT_TEST(false),
        DEVELOPMENT_LOCAL(false),
        PRODUCTION_AWS(true);

        private boolean isProduction;

        Environment(boolean isProduction) {
            this.isProduction = isProduction;
        }

        public boolean isProduction() {
            return isProduction;
        }
    }

    private static volatile Injector injector = null;

    public Injector get() {
        if (injector == null) {
            synchronized (ServiceInjector.class) {
                if (injector == null) {
                    Environment env = detectEnvironment();
                    log.info("Detected environment {}", env.name());
                    Injector newInjector = create(env, Stage.DEVELOPMENT);
                    injector = newInjector;
                }
            }
        }
        return injector;
    }

    @VisibleForTesting
    protected Injector create(Environment env, Stage stage) {
        return Guice.createInjector(stage, module(env));
    }

    public void startServices() {
        log.info("Starting services");
        get().getInstance(ServiceManager.class).startAsync().awaitHealthy();
    }

    public void shutdownServices() {
        log.info("Stopping services");
        get().getInstance(ServiceManager.class).stopAsync().awaitStopped();
    }

    private static Module module(Environment env) {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Environment.class).toInstance(env);

                install(ServiceManagerProvider.module());
                install(GsonProvider.module());

                // Stores
                install(DynamoProjectStore.module());

                // Configuration
                install(ConfigSystem.module());
                install(SimpleConfigNamingStrategy.module());
                install(ConfigValueConverters.module());
                install(NoopConfigValueInterceptor.module());
                bind(ConfigDescriptorHolder.class);
                // Need to handle re-registering beans if tomcat doesn't restart between loading app again
                MBeanServer mBeanServer = BeanUtil.wrapOverwriteRegister(ManagementFactory.getPlatformMBeanServer());
                bind(MBeanServer.class).toInstance(mBeanServer);
                install(JmxDynamicConfigSource.module());
                install(FileDynamicConfigSource.module());
                bind(Duration.class).annotatedWith(Names.named(FileDynamicConfigSource.POLL_INTERVAL_NAME)).toInstance(Duration.ofSeconds(10));

                // API endpoints
                bind(PingResource.class);
                bind(AccountResource.class);
                bind(PlanResource.class);

                switch (env) {
                    case UNIT_TEST:
                    case DEVELOPMENT_LOCAL:
                        install(InMemoryDynamoDbProvider.module());
                        install(InMemoryElasticSearchProvider.module());
                        bind(String.class).annotatedWith(Names.named(FileDynamicConfigSource.FILENAME_NAME)).toInstance(
                                getClass().getClassLoader().getResource("config-local.cfg").getPath());
                        break;
                    case PRODUCTION_AWS:
                        install(ProductionDynamoDbProvider.module());
                        install(ProductionElasticSearchProvider.module());
                        bind(String.class).annotatedWith(Names.named(FileDynamicConfigSource.FILENAME_NAME)).toInstance(
                                "/opt/clearflask/config-prod.cfg");
                        break;
                    default:
                        throw new RuntimeException("Unknown environment: " + env);
                }

            }
        };
    }

    private static Environment detectEnvironment() {
        String envEnvironment = System.getenv("CLEARFLASK_ENVIRONMENT");
        if (envEnvironment != null) {
            return Environment.valueOf(envEnvironment);
        }
        throw new RuntimeException("Could not determine environment. Did you forget to set env var CLEARFLASK_ENVIRONMENT?");
    }
}
