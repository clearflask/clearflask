package com.kik.config.ice.convert;

import com.google.common.util.concurrent.Service;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.multibindings.MapBinder;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.source.DynamicConfigSource;
import com.kik.config.ice.source.FileDynamicConfigSource;
import com.smotana.clearflask.core.ManagedService;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;

public class FileDynamicConfigSourceManagedService extends ManagedService {
    private static final int CONFIG_SOURCE_PRIORITY_DEFAULT = 100;

    @Inject
    private FileDynamicConfigSource fileDynamicConfigSource;

    private Object fileDynamicConfigSourceService;

    @Inject
    private void setup() throws Exception {
        Class<?> innerClass = FileDynamicConfigSource.class.getDeclaredClasses()[0];
        Constructor<?> constructor = innerClass.getDeclaredConstructors()[0];
        constructor.setAccessible(true);
        fileDynamicConfigSourceService = constructor.newInstance(fileDynamicConfigSource);
    }

    @Override
    protected boolean serviceStartFirstStopLast() {
        return true;
    }

    @Override
    protected void serviceStart() throws Exception {
        Method startUpMethod = fileDynamicConfigSourceService.getClass().getDeclaredMethod("startUp");
        startUpMethod.setAccessible(true);
        startUpMethod.invoke(fileDynamicConfigSourceService);
    }

    @Override
    protected void serviceStop() throws Exception {
        Method shutDownMethod = fileDynamicConfigSourceService.getClass().getDeclaredMethod("shutDown");
        shutDownMethod.setAccessible(true);
        shutDownMethod.invoke(fileDynamicConfigSourceService);
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
                Multibinder.newSetBinder(binder(), Service.class).addBinding().to(FileDynamicConfigSourceManagedService.FileDynamicConfigSourceService.class);
            }
        };
    }
}
