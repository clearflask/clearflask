package com.smotana.clearflask.store.elastic;

import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.SettableFuture;
import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.HttpHost;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestHighLevelClient;

import java.util.Arrays;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Singleton
public class DefaultElasticSearchProvider extends ManagedService implements Provider<RestHighLevelClient> {

    public interface Config {
        @NoDefaultValue
        String serviceEndpoint();
    }

    @Inject
    private Config config;

    private Optional<RestHighLevelClient> restClientOpt = Optional.empty();

    @Override
    public RestHighLevelClient get() {
        log.info("Opening ElasticSearch client on {}", config.serviceEndpoint());
        if (restClientOpt.isPresent()) return restClientOpt.get();
        restClientOpt = Optional.of(new RestHighLevelClient(RestClient
                .builder(HttpHost.create(config.serviceEndpoint()))));
        return restClientOpt.get();
    }

    @Override
    protected void serviceStart() throws Exception {
        checkState(restClientOpt.isPresent());
        Futures.allAsList(Arrays.stream(ElasticScript.values())
                .map(script -> {
                    SettableFuture<AcknowledgedResponse> scriptsFuture = SettableFuture.create();
                    restClientOpt.get().putScriptAsync(script.toPutStoredScriptRequest(),
                            RequestOptions.DEFAULT, ActionListeners.fromFuture(scriptsFuture));
                    return scriptsFuture;
                })
                .collect(ImmutableSet.toImmutableSet()))
                .get(1, TimeUnit.MINUTES);
    }

    @Override
    protected void serviceStop() throws Exception {
        if (this.restClientOpt.isPresent()) {
            restClientOpt.get().close();
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(RestHighLevelClient.class).toProvider(DefaultElasticSearchProvider.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DefaultElasticSearchProvider.class);
            }
        };
    }
}
