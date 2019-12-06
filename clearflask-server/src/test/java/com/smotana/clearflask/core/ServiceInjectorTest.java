package com.smotana.clearflask.core;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ServiceManager;
import com.google.gson.Gson;
import com.google.inject.Injector;
import com.google.inject.Stage;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.web.resource.PingResource;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.web.resource.CommentResource;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

@Slf4j
@RunWith(Parameterized.class)
public class ServiceInjectorTest {

    private final Environment env;

    public ServiceInjectorTest(Environment env) {
        this.env = env;
    }

    @Parameterized.Parameters(name = "{0}")
    public static Iterable<Object> data() {
        return ImmutableList.copyOf(Environment.values());
    }

    @Test(timeout = 5_000L)
    public void testBindings() throws Exception {
        Injector injector = ServiceInjector.INSTANCE.create(env, Stage.TOOL);

        ImmutableSet.of(
                Gson.class,
                AccountResource.class,
                CommentResource.class,
                PingResource.class,
                ServiceManager.class
        ).forEach(injector::getBinding);
    }
}
