package com.smotana.clearflask.billing;

import com.google.inject.Module;
import com.google.inject.*;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import org.killbill.billing.client.KillBillHttpClient;
import org.killbill.billing.client.api.gen.*;


@Singleton
public class KillBillClientProvider implements Provider<KillBillHttpClient> {

    public interface Config {
        @NoDefaultValue
        String host();

        @NoDefaultValue
        int port();

        @NoDefaultValue
        String user();

        @NoDefaultValue
        String pass();

        @NoDefaultValue
        String apiKey();

        @NoDefaultValue
        String apiSecret();
    }

    @Inject
    private Config config;

    @Override
    public KillBillHttpClient get() {
        return new KillBillHttpClient(String.format("https://%s:%d", config.host(), config.port()),
                config.user(),
                config.pass(),
                config.apiKey(),
                config.apiSecret(),
                null,
                null,
                1000,
                5000,
                5000,
                true,
                "TLSv1.2");
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
