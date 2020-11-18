package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.stripe.Stripe;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class StripeClientSetup extends ManagedService {

    public interface Config {
        @NoDefaultValue
        String stripeApiKey();

        /** For testing only */
        @NoDefaultValue
        String overrideBaseUrl();
    }

    @Inject
    private Config config;

    @Override
    protected void serviceStart() throws Exception {
        Stripe.apiKey = config.stripeApiKey();
        Stripe.enableTelemetry = false;
        String overrideApiBase = config.overrideBaseUrl();
        if (!Strings.isNullOrEmpty(overrideApiBase)) {
            Stripe.overrideApiBase(overrideApiBase);
            Stripe.overrideConnectBase(overrideApiBase);
            Stripe.overrideUploadBase(overrideApiBase);
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeClientSetup.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(StripeClientSetup.class);
            }
        };
    }
}
