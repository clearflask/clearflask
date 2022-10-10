// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core;

import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.AbstractIdleService;
import com.google.common.util.concurrent.Service;
import com.google.inject.Inject;
import com.google.inject.Provider;

import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static java.util.function.Predicate.not;

public abstract class ManagedService extends AbstractIdleService {

    @Inject
    private Provider<Set<ManagedService>> managedServicesProvider;
    @Inject
    private Provider<Set<Service>> servicesProvider;

    /** Override to supply set of dependencies */
    protected ImmutableSet<Class> serviceDependencies() {
        // Default no dependencies
        return ImmutableSet.of();
    }

    /**
     * Start this service first blocking all other services
     * and don't stop this service until all other services stopped.
     */
    protected boolean serviceStartFirstStopLast() {
        return false;
    }

    /** Override to start service */
    protected void serviceStart() throws Exception {
        // Default noop
    }

    /** Override to stop service */
    protected void serviceStop() throws Exception {
        // Default noop
    }

    @Override
    protected final void startUp() throws Exception {
        awaitDependencies(true);
        serviceStart();
    }

    @Override
    protected final void shutDown() throws Exception {
        awaitDependencies(false);
        serviceStop();
    }

    private void awaitDependencies(boolean isStarting) {
        // Wait for core services to start this non-core service
        if (isStarting && !serviceStartFirstStopLast()) {
            ImmutableSet<ManagedService> dependantServices = managedServicesProvider.get().stream()
                    .filter(ManagedService::serviceStartFirstStopLast)
                    .collect(ImmutableSet.toImmutableSet());
            dependantServices.forEach(Service::awaitRunning);
        }

        // Wait for non-core services to stop before this core service
        if (!isStarting && serviceStartFirstStopLast()) {
            ImmutableSet<ManagedService> dependantServices = managedServicesProvider.get().stream()
                    .filter(not(ManagedService::serviceStartFirstStopLast))
                    .collect(ImmutableSet.toImmutableSet());
            dependantServices.forEach(Service::awaitTerminated);
        }

        // Wait for dependencies
        ImmutableSet<Class> dependencies = serviceDependencies();
        if (!dependencies.isEmpty()) {
            ImmutableSet<Service> dependantServices = Stream.concat(servicesProvider.get().stream(), managedServicesProvider.get().stream())
                    .filter(s -> {
                        Class<? extends Service> sClazz = s.getClass();
                        return dependencies.stream().anyMatch(dClazz -> dClazz.isAssignableFrom(sClazz));
                    })
                    .collect(ImmutableSet.toImmutableSet());
            if (dependencies.size() != dependantServices.size()) {
                throw new RuntimeException(this.getClass().getSimpleName() + " depends on " + dependencies + " but only found bindings for " + dependantServices);
            }
            dependantServices.forEach(isStarting ? Service::awaitRunning : Service::awaitTerminated);
        }
    }

    @Override
    public String toString() {
        return super.toString() + " [" + serviceDependencies().stream().map(Class::getSimpleName).collect(Collectors.joining(", ")) + "]";
    }
}
