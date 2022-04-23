// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core;

import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Service;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import java.util.Set;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
public class ServiceManagerProvider implements Provider<ServiceManager> {
    @Inject
    private Set<ManagedService> managedServices;
    @Inject
    private Set<Service> services;

    @Override
    @Singleton
    public ServiceManager get() {
        checkState(Sets.intersection(services, managedServices).isEmpty());
        Sets.SetView<Service> allServices = Sets.union(services, managedServices);
        log.trace("Adding services to ServiceManager {}", allServices);
        return new ServiceManager(allServices);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ServiceManager.class).toProvider(ServiceManagerProvider.class).asEagerSingleton();
            }
        };
    }
}
