package com.smotana.clearflask.core;

import com.google.auth.Credentials;
import com.google.cloud.NoCredentials;
import com.google.cloud.storage.InMemoryStorageClient;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.*;
import com.google.inject.Module;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.convert.ConfigValueConverters;
import com.kik.config.ice.interceptor.NoopConfigValueInterceptor;
import com.kik.config.ice.internal.ConfigDescriptorHolder;
import com.kik.config.ice.naming.SimpleConfigNamingStrategy;
import com.kik.config.ice.source.FileDynamicConfigSource;
import com.kik.config.ice.source.JmxDynamicConfigSource;
import com.smotana.clearflask.docker.BrowserCapabilitiesFactory;
import com.smotana.clearflask.docker.DockerClientProvider;
import com.smotana.clearflask.docker.DockerManagerImpl;
import com.smotana.clearflask.gcloud.CachedMetadataConfig;
import com.smotana.clearflask.image.ImageEditorImpl;
import com.smotana.clearflask.image.VideoEncoderImpl;
import com.smotana.clearflask.monitor.gcloud.ConsoleMetricsClient;
import com.smotana.clearflask.monitor.gcloud.GCloudMetrics;
import com.smotana.clearflask.monitor.gcloud.GCloudMetricsClientProvider;
import com.smotana.clearflask.payment.MenuImpl;
import com.smotana.clearflask.payment.StripePaymentImpl;
import com.smotana.clearflask.resources.BrowserExpiry;
import com.smotana.clearflask.resources.BrowserImpl;
import com.smotana.clearflask.resources.BrowserResourceManagerImpl;
import com.smotana.clearflask.resources.InMemoryResourceQueue;
import com.smotana.clearflask.store.gcloud.DatastoreClientProvider;
import com.smotana.clearflask.store.gcloud.GCloudCredentialsProvider;
import com.smotana.clearflask.store.gcloud.GCloudStore;
import com.smotana.clearflask.store.gcloud.StorageClientProvider;
import com.smotana.clearflask.util.BeanUtil;
import com.smotana.clearflask.util.GsonProvider;
import com.smotana.clearflask.util.TimingAttackUtil;
import com.smotana.clearflask.web.api.BrowserEndpoint;
import com.smotana.clearflask.web.api.PingResource;
import com.smotana.clearflask.web.api.ShutdownResource;
import com.smotana.clearflask.web.api.VerificationResource;
import com.smotana.clearflask.web.guard.*;
import com.smotana.clearflask.web.guard.challenge.RecaptchaChallenger;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import javax.management.MBeanServer;
import java.lang.management.ManagementFactory;
import java.time.Duration;

@Slf4j
@NoArgsConstructor
public enum ClearFlaskInjector {
    INSTANCE;

    public enum Environment {
        UNIT_TEST(false),
        DEVELOPMENT_LOCAL(false),
        PRODUCTION_GOOGLE_CLOUD(true);

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
            synchronized (VeruvInjector.class) {
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

                // TODO add some modules here...

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
                install(BrowserEndpoint.module());
                bind(PingResource.class);
                bind(VerificationResource.class);
                bind(ShutdownResource.class);
                install(ShutdownResource.module());

                // Common GCloud dependencies
                install(GCloudStore.module());
                install(CachedMetadataConfig.module());
                install(DatastoreClientProvider.module());
                install(GCloudMetrics.module());

                switch (env) {
                    case UNIT_TEST:
                    case DEVELOPMENT_LOCAL:
                        bind(Credentials.class).toInstance(NoCredentials.getInstance());
                        install(InMemoryStorageClient.module());
                        install(ConsoleMetricsClient.module());
                        bind(String.class).annotatedWith(Names.named(FileDynamicConfigSource.FILENAME_NAME)).toInstance(
                                getClass().getClassLoader().getResource("config-local.cfg").getPath());
                        break;
                    case PRODUCTION_GOOGLE_CLOUD:
                        install(GCloudCredentialsProvider.module());
                        install(GCloudMetricsClientProvider.module());
                        install(StorageClientProvider.module());
                        bind(String.class).annotatedWith(Names.named(FileDynamicConfigSource.FILENAME_NAME)).toInstance(
                                "/opt/veruv/config-prod.cfg");
                        break;
                    default:
                        throw new RuntimeException("Unknown environment: " + env);
                }

            }
        };
    }

    private static Environment detectEnvironment() {
        String envEnvironment = System.getenv("VERUV_ENVIRONMENT");
        if (envEnvironment != null) {
            return Environment.valueOf(envEnvironment);
        }
        throw new RuntimeException("Could not determine environment. Did you forget to set env var VERUV_ENVIRONMENT?");
    }
}
