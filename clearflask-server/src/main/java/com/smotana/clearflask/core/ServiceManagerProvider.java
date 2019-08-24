package com.smotana.clearflask.core;

import com.google.common.util.concurrent.Service;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.*;
import com.google.inject.Module;
import lombok.extern.slf4j.Slf4j;

import java.util.Set;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
public class ServiceManagerProvider implements Provider<ServiceManager> {
    @Inject
    private Set<Service> services;

    @Override
    @Singleton
    public ServiceManager get() {
        log.trace("Adding services to ServiceManager {}", services);
        checkState(services != null, "Services are empty, make sure you inject Provider<ServiceManager> instead of injecting ServiceManager directly");
        return new ServiceManager(services);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ServiceManager.class).toProvider(ServiceManagerProvider.class).in(Singleton.class);
            }
        };
    }
}
