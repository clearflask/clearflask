// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core;

import com.google.common.base.Predicates;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ServiceManager;
import com.google.gson.Gson;
import com.google.inject.Injector;
import com.google.inject.Stage;
import com.smotana.clearflask.billing.SelfHostBilling;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.web.resource.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameters;

import java.util.Arrays;

@Slf4j
@RunWith(Parameterized.class)
public class ServiceInjectorTest {

    private final Environment env;

    public ServiceInjectorTest(Environment env) {
        this.env = env;
    }

    @Parameters(name = "{0}")
    public static Iterable<Object> data() {
        return Arrays.stream(Environment.values())
                .filter(Predicates.not(Environment.TEST::equals))
                .collect(ImmutableSet.toImmutableSet());
    }

    @Test(timeout = 10_000L)
    public void testBindings() throws Exception {
        Injector injector = ServiceInjector.INSTANCE.create(env, Stage.TOOL);

        ImmutableSet.of(
                Gson.class,
                AccountResource.class,
                CommentResource.class,
                IdeaResource.class,
                SupportResource.class,
                NotificationResource.class,
                UserResource.class,
                VoteResource.class,
                ConnectResource.class,
                HealthResource.class,
                env != Environment.PRODUCTION_SELF_HOST ? KillBillResource.class : SelfHostBilling.class,
                ProjectResource.class,
                CreditResource.class,
                ContentResource.class,
                HealthResource.class,
                ServiceManager.class,
                GitHubResource.class
        ).forEach(injector::getBinding);
    }
}
