package com.smotana.clearflask.core;

import com.google.common.base.Charsets;
import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.web.Application;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import javax.ws.rs.WebApplicationException;
import java.io.IOException;

import static com.smotana.clearflask.web.security.AuthenticationFilter.EXTERNAL_API_AUTH_HEADER_NAME_ACCOUNT_ID;
import static com.smotana.clearflask.web.security.AuthenticationFilter.EXTERNAL_API_AUTH_HEADER_NAME_TOKEN_ID;


@Slf4j
@Singleton
public class ClearFlaskCreditSync extends ManagedService {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        /**
         * If changed, also change in Dashboard.tsx
         */
        @DefaultValue("clearflask")
        String projectId();

        @NoDefaultValue
        String accountId();

        @NoDefaultValue
        String tokenId();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Gson gson;

    private CloseableHttpClient client;

    @Override
    protected void serviceStart() throws Exception {
        client = HttpClientBuilder.create().build();
    }


    @Override
    protected void serviceStop() throws Exception {
        if (client != null) {
            client.close();
        }
    }

    public void process(String idempotentKey, Account account, long amount, String summary) throws IOException {
        if (!config.enabled()) {
            return;
        }
        CreditRequest creditRequest = new CreditRequest(
                account.getClearFlaskGuid(),
                account.getEmail(),
                account.getName(),
                idempotentKey,
                amount,
                summary);
        String bodyStr = gson.toJson(creditRequest);

        HttpPost req = new HttpPost(
                "https://"
                        + config.projectId()
                        + "."
                        + configApp.domain()
                        + "/api/project/"
                        + config.projectId()
                        + "/admin/credit/income");
        req.setHeader(EXTERNAL_API_AUTH_HEADER_NAME_ACCOUNT_ID, config.accountId());
        req.setHeader(EXTERNAL_API_AUTH_HEADER_NAME_TOKEN_ID, config.tokenId());
        req.setEntity(new StringEntity(bodyStr, Charsets.UTF_8));
        try (CloseableHttpResponse res = client.execute(req)) {
            if (res.getStatusLine().getStatusCode() < 200
                    || res.getStatusLine().getStatusCode() > 299) {
                log.warn("Failed to sync credit, response status {}, request {}",
                        res.getStatusLine().getStatusCode(), creditRequest);
                throw new WebApplicationException(res.getStatusLine().getStatusCode());
            }
        }
    }

    @Value
    private class CreditRequest {
        @GsonNonNull
        String guid;

        String email;

        String name;

        String transactionId;

        @GsonNonNull
        long amount;

        String summary;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ClearFlaskCreditSync.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(ClearFlaskCreditSync.class);
            }
        };
    }
}
