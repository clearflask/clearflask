package com.smotana.clearflask.core;

import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.AbstractIdleService;
import com.google.common.util.concurrent.Service;
import com.google.inject.Inject;
import com.google.inject.Provider;

import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.google.common.base.Preconditions.checkState;

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

    private void awaitDependencies(boolean awaitRunning) {
        ImmutableSet<Class> dependencies = serviceDependencies();
        for (Class dependency : dependencies) {
            ImmutableSet<Service> dependantServices = Stream.concat(servicesProvider.get().stream(), managedServicesProvider.get().stream())
                    .filter(s -> {
                        Class<? extends Service> sClazz = s.getClass();
                        return dependencies.stream().anyMatch(dClazz -> dClazz.isAssignableFrom(sClazz));
                    })
                    .collect(ImmutableSet.toImmutableSet());
            checkState(!dependantServices.isEmpty(), this.getClass().getSimpleName() + " depends on " + dependency.getSimpleName() + " but no service was found");
            dependantServices.forEach(awaitRunning ? Service::awaitRunning : Service::awaitTerminated);
        }
    }

    @Override
    public String toString() {
        return super.toString() + " [" + serviceDependencies().stream().map(Class::getSimpleName).collect(Collectors.joining(", ")) + "]";
    }
}
