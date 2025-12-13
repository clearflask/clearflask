package com.kik.config.ice.convert;

import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.multibindings.MapBinder;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.source.DynamicConfigSource;
import com.kik.config.ice.source.FileDynamicConfigSource;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;

import java.lang.reflect.Method;
import java.util.Optional;

@Slf4j
@Singleton
public class FileDynamicConfigSourceManagedService extends ManagedService {
    private static final int CONFIG_SOURCE_PRIORITY_DEFAULT = 100;

    @Inject
    private Injector injector;

    private volatile Optional<Object> serviceCacheOpt = Optional.empty();

    private Object getService() throws Exception {
        if (serviceCacheOpt.isEmpty()) {
            synchronized (FileDynamicConfigSourceManagedService.class) {
                if (serviceCacheOpt.isEmpty()) {
                    serviceCacheOpt = Optional.of(injector.getInstance(FileDynamicConfigSource.class.getDeclaredClasses()[0]));
                }
            }
        }
        return serviceCacheOpt.get();
    }

    @Override
    protected boolean serviceStartFirstStopLast() {
        return true;
    }

    @Override
    protected void serviceStart() throws Exception {
        Method startUpMethod = getService().getClass().getDeclaredMethod("startUp");
        startUpMethod.setAccessible(true);
        startUpMethod.invoke(getService());
    }

    @Override
    protected void serviceStop() throws Exception {
        Method shutDownMethod = getService().getClass().getDeclaredMethod("shutDown");
        shutDownMethod.setAccessible(true);
        shutDownMethod.invoke(getService());
    }

    public static Module module() {
        return module(CONFIG_SOURCE_PRIORITY_DEFAULT);
    }

    public static Module module(final int configSourcePriority) {
        return new AbstractModule() {
            @Override
            protected void configure() {
                MapBinder<Integer, DynamicConfigSource> mapBinder = MapBinder.newMapBinder(binder(), Integer.class, DynamicConfigSource.class);
                mapBinder.addBinding(configSourcePriority).to(FileDynamicConfigSource.class);
                bind(FileDynamicConfigSource.class);

                // Bind inner class as a service to ensure resource cleanup
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(FileDynamicConfigSourceManagedService.class);
            }
        };
    }
}
