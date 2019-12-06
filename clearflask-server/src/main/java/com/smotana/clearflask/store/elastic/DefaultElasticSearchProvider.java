package com.smotana.clearflask.store.elastic;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.log4j.Log4j2;
import org.apache.http.HttpHost;
import org.elasticsearch.client.RestClient;

import java.util.Optional;

@Log4j2
@Singleton
public class DefaultElasticSearchProvider extends ManagedService implements Provider<RestClient> {

    private interface Config {
        @NoDefaultValue
        String serviceEndpoint();
    }

    @Inject
    private Config config;
    @Inject
    private AWSCredentialsProvider AwsCredentialsProvider;

    private Optional<RestClient> restClientOpt = Optional.empty();

    @Override
    public RestClient get() {
        restClientOpt = Optional.of(RestClient
                .builder(HttpHost.create(config.serviceEndpoint()))
                .build());
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
                bind(RestClient.class).toProvider(DefaultElasticSearchProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DefaultElasticSearchProvider.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
