package com.smotana.clearflask.core;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Service;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import java.util.Set;
import java.util.stream.Collectors;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Singleton
public class ManagedServiceManager {
    private final ImmutableList<Service> allServices;
    private final ServiceManager serviceManager;

    private ManagedServiceManager(@Inject Set<ManagedService> managedServices, @Inject Set<Service> services) {
        checkState(Sets.intersection(services, managedServices).isEmpty());
        allServices = ImmutableList.<Service>builder()
                .addAll(services)
                .addAll(managedServices.stream().sorted().collect(Collectors.toList()))
                .build();
        log.trace("Adding services to ServiceManager {}", allServices);
        serviceManager = new ServiceManager((allServices));
    }

    public void startAndAwaitHealthy() {
        allServices.forEach(Service::startAsync);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ManagedServiceManager.class).asEagerSingleton();
            }
        };
    }
}
