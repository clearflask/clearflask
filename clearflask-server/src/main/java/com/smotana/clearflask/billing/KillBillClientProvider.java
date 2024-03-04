// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.inject.Module;
import com.google.inject.*;
import com.jayway.jsonpath.JsonPath;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.util.NetworkUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.client.KillBillHttpClient;
import org.killbill.billing.client.api.gen.*;

import java.io.IOException;

@Slf4j
@Singleton
public class KillBillClientProvider implements Provider<KillBillHttpClient> {
    public static final String STRIPE_PLUGIN_NAME = "killbill-stripe";
    public static final String PAYMENT_TEST_PLUGIN_NAME = "killbill-payment-test";

    public interface Config {
        @NoDefaultValue
        String host();

        @NoDefaultValue
        Integer port();

        @NoDefaultValue
        String user();

        @NoDefaultValue
        String pass();

        @NoDefaultValue
        String apiKey();

        @NoDefaultValue
        String apiSecret();

        @DefaultValue("true")
        boolean requireTls();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Environment env;

    @Override
    public KillBillHttpClient get() {
        String serviceEndpoint = String.format("%s://%s:%d", config.requireTls() ? "https" : "http", config.host(), config.port());
        if (configApp.startupWaitUntilDeps()) {
            log.info("Waiting for KillBill to be up {}", serviceEndpoint);
            JsonPath killBillHealthCheck = JsonPath.compile("$.['main.pool.ConnectivityCheck'].healthy");
            try {
                NetworkUtil.waitUntilPortOpen(config.host(), config.port());
                if (env.isProduction()) {
                    NetworkUtil.waitUntil200(serviceEndpoint + "/1.0/healthcheck");
                } else {
                    // In non-production, only consider main healthcheck, disregard 99th percentile checks
                    NetworkUtil.waitUntilResponse(
                            serviceEndpoint + "/1.0/healthcheck",
                            body -> Boolean.TRUE.equals(killBillHealthCheck.read(body)));
                }
            } catch (IOException ex) {
                throw new ProvisionException("Failed to wait until KillBill port opened", ex);
            }
        }
        log.info("Opening KillBill client on {}", serviceEndpoint);
        return new KillBillHttpClient(
                serviceEndpoint,
                config.user(),
                config.pass(),
                config.apiKey(),
                config.apiSecret(),
                null,
                null,
                60000,
                60000,
                60000,
                config.requireTls(),
                config.requireTls() ? "TLSv1.2" : null);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(KillBillHttpClient.class).toProvider(KillBillClientProvider.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));

                Provider<KillBillHttpClient> clientProvider = getProvider(KillBillHttpClient.class);
                bind(AccountApi.class).toProvider(() -> new AccountApi(clientProvider.get())).asEagerSingleton();
                bind(AdminApi.class).toProvider(() -> new AdminApi(clientProvider.get())).asEagerSingleton();
                bind(BundleApi.class).toProvider(() -> new BundleApi(clientProvider.get())).asEagerSingleton();
                bind(CatalogApi.class).toProvider(() -> new CatalogApi(clientProvider.get())).asEagerSingleton();
                bind(CreditApi.class).toProvider(() -> new CreditApi(clientProvider.get())).asEagerSingleton();
                bind(CustomFieldApi.class).toProvider(() -> new CustomFieldApi(clientProvider.get())).asEagerSingleton();
                bind(ExportApi.class).toProvider(() -> new ExportApi(clientProvider.get())).asEagerSingleton();
                bind(InvoiceApi.class).toProvider(() -> new InvoiceApi(clientProvider.get())).asEagerSingleton();
                bind(InvoiceItemApi.class).toProvider(() -> new InvoiceItemApi(clientProvider.get())).asEagerSingleton();
                bind(InvoicePaymentApi.class).toProvider(() -> new InvoicePaymentApi(clientProvider.get())).asEagerSingleton();
                bind(NodesInfoApi.class).toProvider(() -> new NodesInfoApi(clientProvider.get())).asEagerSingleton();
                bind(OverdueApi.class).toProvider(() -> new OverdueApi(clientProvider.get())).asEagerSingleton();
                bind(PaymentApi.class).toProvider(() -> new PaymentApi(clientProvider.get())).asEagerSingleton();
                bind(PaymentGatewayApi.class).toProvider(() -> new PaymentGatewayApi(clientProvider.get())).asEagerSingleton();
                bind(PaymentMethodApi.class).toProvider(() -> new PaymentMethodApi(clientProvider.get())).asEagerSingleton();
                bind(PaymentTransactionApi.class).toProvider(() -> new PaymentTransactionApi(clientProvider.get())).asEagerSingleton();
                bind(PluginInfoApi.class).toProvider(() -> new PluginInfoApi(clientProvider.get())).asEagerSingleton();
                bind(SecurityApi.class).toProvider(() -> new SecurityApi(clientProvider.get())).asEagerSingleton();
                bind(SubscriptionApi.class).toProvider(() -> new SubscriptionApi(clientProvider.get())).asEagerSingleton();
                bind(TagApi.class).toProvider(() -> new TagApi(clientProvider.get())).asEagerSingleton();
                bind(TagDefinitionApi.class).toProvider(() -> new TagDefinitionApi(clientProvider.get())).asEagerSingleton();
                bind(TenantApi.class).toProvider(() -> new TenantApi(clientProvider.get())).asEagerSingleton();
                bind(UsageApi.class).toProvider(() -> new UsageApi(clientProvider.get())).asEagerSingleton();
            }
        };
    }
}
