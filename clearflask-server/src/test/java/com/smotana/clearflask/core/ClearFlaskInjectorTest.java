package com.smotana.clearflask.core;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ServiceManager;
import com.google.gson.Gson;
import com.google.inject.Injector;
import com.google.inject.Stage;
import com.smotana.clearflask.core.VeruvInjector.Environment;
import com.smotana.clearflask.docker.DockerManager;
import com.smotana.clearflask.store.SnapshotStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.api.BrowserEndpoint;
import com.smotana.clearflask.web.api.PingResource;
import com.smotana.clearflask.web.api.ShutdownResource;
import com.smotana.clearflask.web.api.VerificationResource;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

@Slf4j
@RunWith(Parameterized.class)
public class VeruvInjectorTest {

    private final Environment env;

    public VeruvInjectorTest(Environment env) {
        this.env = env;
    }

    @Parameterized.Parameters(name = "{0}")
    public static Iterable<Object> data() {
        return ImmutableList.copyOf(Environment.values());
    }

    @Test(timeout = 5_000L)
    public void testBindings() throws Exception {
        Injector injector = VeruvInjector.INSTANCE.create(env, Stage.TOOL);

        ImmutableSet.of(
                Gson.class,
                DockerManager.class,
                PingResource.class,
                BrowserEndpoint.class,
                ServiceManager.class,
                VerificationResource.class,
                SnapshotStore.class,
// TODO disabled for now
//                SnapshotRequestStore.class,
//                SnapshotRequestResource.class,
//                CreditStore.class,
//                SubscriptionStore.class,
                UserStore.class,
                ShutdownResource.class
        ).forEach(injector::getBinding);
    }
}
