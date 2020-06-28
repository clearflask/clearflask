package com.smotana.clearflask.billing;


import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.SettableFuture;
import com.google.inject.*;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.DefaultElasticSearchProvider;
import com.smotana.clearflask.store.elastic.ElasticScript;
import com.smotana.veruv.core.AbstractVeruvModule;
import com.smotana.veruv.util.LogUtil;
import com.smotana.veruv.web.message.Error;
import com.smotana.veruv.web.message.Payment;
import com.stripe.Stripe;
import com.stripe.exception.*;
import com.stripe.model.Charge;
import com.stripe.model.Customer;
import com.stripe.model.Refund;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.client.RequestOptions;
import rx.Observable;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import java.util.Arrays;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static com.google.common.base.Preconditions.checkNotNull;
import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Singleton
public class StripeLoader extends ManagedService {

    public interface Config {
        @NoDefaultValue
        String apiKeySecret();

        @NoDefaultValue
        Observable<String> apiKeySecretObservable();
    }

    @Inject
    private Config config;

    @Override
    protected void serviceStart() throws Exception {
        checkNotNull(Strings.emptyToNull(config.apiKeySecret()), "Stripe api key cannot be empty");
        config.apiKeySecretObservable().subscribe(s -> Stripe.apiKey = s);
        Stripe.apiKey = config.apiKeySecret();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.configModule(StripeLoader.Config.class));
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
