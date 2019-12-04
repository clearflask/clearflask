package com.smotana.clearflask.testutil;

import com.google.common.util.concurrent.AbstractService;
import com.google.common.util.concurrent.Service;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.AbstractModule;
import com.google.inject.Guice;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.Stage;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigConfigurator;
import com.kik.config.ice.exception.ConfigException;
import com.kik.config.ice.naming.ConfigNamingStrategy;
import com.kik.config.ice.source.DebugDynamicConfigSource;
import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.core.ServiceManagerProvider;
import com.smotana.clearflask.util.GsonProvider;
import lombok.extern.slf4j.Slf4j;
import org.junit.After;
import org.junit.Before;

import java.util.Optional;

@Slf4j
public abstract class AbstractTest extends AbstractModule {

    @Inject
    protected Injector injector;
    @Inject
    protected DebugDynamicConfigSource configSource;
    @Inject
    private ServiceManager serviceManager;
    @Inject
    private ConfigNamingStrategy configNamingStrategy;

    @Before
    public void setup() {
        injector = Guice.createInjector(Stage.DEVELOPMENT, new AbstractModule() {
            @Override
            protected void configure() {
                install(Modules.override(
                        new AbstractModule() {
                            @Override
                            protected void configure() {
                                bind(ServiceInjector.Environment.class).toInstance(ServiceInjector.Environment.UNIT_TEST);
                                install(ServiceManagerProvider.module());
                                install(GsonProvider.module());
                                Multibinder.newSetBinder(binder(), Service.class).addBinding().to(NoOpService.class);
                                install(ConfigConfigurator.testModules());
                            }
                        }
                ).with(AbstractTest.this));
            }
        });
        injector.injectMembers(this);

        log.info("starting services");
        serviceManager.startAsync().awaitHealthy();
        log.info("started services");
    }

    @After
    public void cleanup() {
        if (serviceManager != null) {
            log.info("stopping services");
            serviceManager.stopAsync().awaitStopped();
            log.info("stopped services");
        }
    }

    protected void configure() {
    }

    protected void configUnset(Class configClass, String methodName) throws NoSuchMethodException, ConfigException {
        configSet(configClass, methodName, Optional.empty());
    }

    protected void configSet(Class configClass, String methodName, String value) throws NoSuchMethodException, ConfigException {
        configSet(configClass, methodName, Optional.of(value));
    }

    private void configSet(Class configClass, String methodName, Optional<String> valueOpt) throws NoSuchMethodException, ConfigException {
        // TODO support scope as well
        String configName = configNamingStrategy.methodToFlatName(configClass.getMethod(methodName), Optional.empty());
        configSource.fireEvent(configName, valueOpt);
    }

    private static final class NoOpService extends AbstractService {
        @Override
        protected void doStart() {
            notifyStarted();
        }

        @Override
        protected void doStop() {
            notifyStopped();
        }
    }
}
