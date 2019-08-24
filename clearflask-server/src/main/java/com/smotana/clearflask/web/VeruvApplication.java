package com.smotana.clearflask.web;

import com.smotana.clearflask.core.ClearFlaskInjector;
import com.smotana.clearflask.core.VeruvInjector;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.hk2.api.ServiceLocator;
import org.glassfish.jersey.server.ResourceConfig;
import org.jvnet.hk2.guice.bridge.api.GuiceBridge;
import org.jvnet.hk2.guice.bridge.api.GuiceIntoHK2Bridge;

import javax.inject.Inject;
import javax.ws.rs.ApplicationPath;

@Slf4j
@ApplicationPath("/")
public class VeruvApplication extends ResourceConfig {
    @Inject
    public VeruvApplication(ServiceLocator serviceLocator) {
        super();
        packages(getClass().getPackage().getName());

        log.info("Initializing HK2-Guice bridge");
        GuiceBridge.getGuiceBridge().initializeGuiceBridge(serviceLocator);
        serviceLocator.getService(GuiceIntoHK2Bridge.class)
                .bridgeGuiceInjector(ClearFlaskInjector.INSTANCE.get());
    }
}
