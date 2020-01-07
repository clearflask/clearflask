package com.smotana.clearflask.store.elastic;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.HttpHost;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestHighLevelClient;

import java.util.Optional;

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
        if (restClientOpt.isPresent()) return restClientOpt.get();
        restClientOpt = Optional.of(new RestHighLevelClient(RestClient
                .builder(HttpHost.create(config.serviceEndpoint()))));
        return restClientOpt.get();
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
