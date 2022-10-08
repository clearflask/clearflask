// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.elastic;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.SettableFuture;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.ProvisionException;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.util.NetworkUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.Header;
import org.apache.http.HttpHeaders;
import org.apache.http.HttpHost;
import org.apache.http.impl.DefaultConnectionReuseStrategy;
import org.apache.http.impl.NoConnectionReuseStrategy;
import org.apache.http.impl.client.DefaultConnectionKeepAliveStrategy;
import org.apache.http.message.BasicHeader;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestHighLevelClient;

import java.io.IOException;
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

        @DefaultValue("false")
        boolean enableCompatibilityHeaderForVersion7();

        @DefaultValue("60000")
        int requestTimeout();

        @DefaultValue("true")
        boolean connectionReuse();

        @DefaultValue("60000")
        long connectionMaxIdleTime();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Gson gson;
    @Inject
    private Environment env;

    private Optional<RestHighLevelClient> restClientOpt = Optional.empty();

    @Override
    public RestHighLevelClient get() {
        if (configApp.startupWaitUntilDeps() && !Strings.isNullOrEmpty(config.serviceEndpoint())) {
            log.info("Waiting for ElasticSearch to be up {}", config.serviceEndpoint());
            try {
                NetworkUtil.waitUntilPortOpen(config.serviceEndpoint());
            } catch (IOException ex) {
                throw new ProvisionException("Failed to wait until ElasticSearch port opened", ex);
            }
        }
        log.info("Opening ElasticSearch client on {}", config.serviceEndpoint());
        if (restClientOpt.isPresent()) return restClientOpt.get();
        restClientOpt = Optional.of(new RestHighLevelClient(RestClient
                .builder(HttpHost.create(config.serviceEndpoint()))
                .setDefaultHeaders((config.enableCompatibilityHeaderForVersion7() ? ImmutableList.<Header>of(
                        // Compatibility headers for ElasticSearch 8+
                        // https://stackoverflow.com/a/55026495
                        new BasicHeader(HttpHeaders.ACCEPT, "application/vnd.elasticsearch+json;compatible-with=7"),
                        new BasicHeader(HttpHeaders.CONTENT_TYPE, "application/vnd.elasticsearch+json;compatible-with=7")
                ) : ImmutableList.<Header>of()).toArray(Header[]::new))
                .setHttpClientConfigCallback(httpClientConfigCallback -> httpClientConfigCallback
                        .setConnectionReuseStrategy((response, context) -> (config.connectionReuse()
                                ? DefaultConnectionReuseStrategy.INSTANCE
                                : NoConnectionReuseStrategy.INSTANCE)
                                .keepAlive(response, context))
                        .setKeepAliveStrategy((response, context) -> {
                            long duration = DefaultConnectionKeepAliveStrategy.INSTANCE.getKeepAliveDuration(response, context);
                            long maxIdleTime = config.connectionMaxIdleTime();
                            if (0 < duration && duration < maxIdleTime) {
                                return duration;
                            }
                            return maxIdleTime;
                        }))
                .setRequestConfigCallback(requestConfigBuilder -> requestConfigBuilder
                        .setConnectTimeout(config.requestTimeout())
                        .setSocketTimeout(config.requestTimeout()))));
        return restClientOpt.get();
    }

    @Override
    protected void serviceStart() throws Exception {
        checkState(restClientOpt.isPresent());
        Futures.allAsList(Arrays.stream(ElasticScript.values())
                        .map(script -> {
                            SettableFuture<Void> scriptsFuture = SettableFuture.create();
                            restClientOpt.get().putScriptAsync(script.toPutStoredScriptRequest(gson),
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
