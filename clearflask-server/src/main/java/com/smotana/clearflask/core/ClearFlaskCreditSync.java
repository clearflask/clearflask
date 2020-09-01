package com.smotana.clearflask.core;

import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.gson.annotations.SerializedName;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.AccountStore.Account;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpClient;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.message.BasicHeader;


@Slf4j
@Singleton
public class ClearFlaskCreditSync {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();
    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;

    private HttpClient authenticatedClient;

    @Inject
    private void setup() {
        HttpClientBuilder.create()
        CloseableHttpClient client = HttpClientBuilder.create()
                .setDefaultHeaders(ImmutableList.of(
                        new BasicHeader("x-cf-")
                ))
                .build();
    }

    public void process(Account account) {
        if (!config.enabled()) {
            return;
        }
        CreditRequest creditRequest = new CreditRequest(
                account.getClearFlaskGuid(),
                account.getEmail(),
                account.getName());
        gson.toJson(creditRequest);

        HttpClientBuilder.create()
                .setRetryHandler()
        // TODO
    }

    @Value
    private class CreditRequest {
        @GsonNonNull
        @SerializedName("guid")
        String guid;

        @SerializedName("email")
        String email;

        @SerializedName("name")
        String name;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ClearFlaskCreditSync.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
