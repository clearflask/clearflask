package com.smotana.clearflask.billing;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import com.google.common.io.Resources;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.text.StrBuilder;
import org.joda.time.DateTime;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.KillBillHttpClient;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.api.gen.InvoiceApi;
import org.killbill.billing.client.api.gen.PluginInfoApi;
import org.killbill.billing.client.api.gen.TenantApi;
import org.killbill.billing.client.model.DateTimes;
import org.killbill.billing.client.model.PluginInfos;
import org.killbill.billing.client.model.gen.Tenant;
import org.killbill.billing.client.model.gen.TenantKeyValue;
import org.w3c.dom.Document;
import rx.Observable;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPathExpression;
import javax.xml.xpath.XPathFactory;
import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import static com.smotana.clearflask.billing.KillBillClientProvider.EMAIL_PLUGIN_NAME;
import static com.smotana.clearflask.billing.KillBillClientProvider.STRIPE_PLUGIN_NAME;

@Slf4j
@Singleton
public class KillBillSync extends ManagedService {
    private static final String PER_TENANT_CONFIG = "\"org.killbill.payment.retry.days=1,2,3\"" +
            "\"org.killbill.billing.server.notifications.retries=1m,2h,1d,2d\"";
    private static final ImmutableList<String> CATALOG_FILENAMES = ImmutableList.<String>builder()
            .add("catalog001.xml")
            .build();

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        Observable<Boolean> enabledObservable();

        @DefaultValue("false")
        boolean createTenant();

        /**
         * Config properties to apply. Example:
         * "org.killbill.invoice.enabled=false","org.killbill.invoice.maxNumberOfMonthsInFuture=36"
         */
        @DefaultValue(value = PER_TENANT_CONFIG, innerType = String.class)
        List<String> perTenantConfig();

        /**
         * If set, Stripe plugin will be configured with this API key
         */
        @NoDefaultValue
        String stripePluginApiKey();

        @DefaultValue("true")
        boolean emailPluginSync();

        @DefaultValue(value = "INVOICE_PAYMENT_FAILED", innerType = String.class)
        List<String> emailPluginEmailEvents();

        @NoDefaultValue
        String emailPluginHost();

        @DefaultValue("25")
        int emailPluginPort();

        @NoDefaultValue
        String emailPluginUsername();

        @NoDefaultValue
        String emailPluginPassword();

        @DefaultValue("billing@clearflask.com")
        String emailPluginSender();

        @DefaultValue("true")
        boolean uploadInvoiceTemplate();

        @DefaultValue("true")
        boolean uploadCatalogs();
    }

    @Inject
    private Config config;
    @Inject
    private KillBillClientProvider.Config configClient;
    @Inject
    private Gson gson;
    @Inject
    private Provider<TenantApi> kbTenantProvider;
    @Inject
    private Provider<CatalogApi> kbCatalogProvider;
    @Inject
    private Provider<PluginInfoApi> kbPluginInfoProvider;
    @Inject
    private Provider<InvoiceApi> kbInvoiceProvider;
    @Inject
    private Provider<KillBillHttpClient> kbClientProvider;

    private AtomicBoolean synced = new AtomicBoolean(false);

    @Override

    protected void serviceStart() throws Exception {
        sync();
        config.enabledObservable().subscribe(enabled -> {
            if (enabled) {
                try {
                    sync();
                } catch (Exception ex) {
                    log.error("Failed to sync after enabling", ex);
                }
            }
        });
    }

    private void sync() throws Exception {
        if (!config.enabled()) {
            return;
        }

        if (!synced.getAndSet(true)) {
            return;
        }

        if (config.createTenant()) {
            try {
                kbTenantProvider.get().getTenantByApiKey(configClient.apiKey(), KillBillUtil.roDefault());
                log.debug("Tenant already exists, not creating");
            } catch (KillBillClientException ex) {
                if (ex.getBillingException() != null
                        && ex.getBillingException().getCauseMessage() != null
                        && ex.getBillingException().getCauseMessage().startsWith("TenantCacheLoader cannot find value for key")) {
                    log.info("Creating tenant for api key {}", configClient.apiKey());
                    kbTenantProvider.get().createTenant(new Tenant()
                                    .setExternalKey("clearflask")
                                    .setApiKey(configClient.apiKey())
                                    .setApiSecret(configClient.apiSecret()),
                            false,
                            KillBillUtil.roDefault());
                } else {
                    throw ex;
                }
            }
        }

        List<String> perTenantConfig = config.perTenantConfig();
        if (!perTenantConfig.isEmpty()) {
            ImmutableMap<String, String> expectedProps = perTenantConfig.stream()
                    .collect(ImmutableMap.toImmutableMap(
                            s -> s.split("=")[0],
                            s -> s.split("=")[1]));
            TenantKeyValue perTenantConfiguration = kbTenantProvider.get().getPerTenantConfiguration(KillBillUtil.roDefault());
            Map<String, String> actualProps = perTenantConfiguration == null || perTenantConfiguration.getValues() == null || perTenantConfiguration.getValues().isEmpty()
                    ? ImmutableMap.of()
                    : gson.fromJson(perTenantConfiguration.getValues().get(0),
                    new TypeToken<Map<String, String>>() {
                    }.getType());
            boolean isMatch = expectedProps.entrySet().stream()
                    .allMatch(e -> e.getValue().equals(actualProps.get(e.getKey())));
            if (!isMatch) {
                HashMap<String, String> props = Maps.newHashMap();
                props.putAll(actualProps);
                props.putAll(expectedProps);
                String propsStr = gson.toJson(props);
                log.info("Setting perTenantConfiguration {}", propsStr);
                kbTenantProvider.get().uploadPerTenantConfiguration(propsStr, KillBillUtil.roDefault());
            }
        }

        Optional<PluginInfos> pluginInfos = Optional.empty();
        String stripePluginApiKey = config.stripePluginApiKey();
        if (!Strings.isNullOrEmpty(stripePluginApiKey)) {
            pluginInfos = Optional.of(kbPluginInfoProvider.get().getPluginsInfo(RequestOptions.empty()));
            if (pluginInfos.get().stream().anyMatch(i -> STRIPE_PLUGIN_NAME.equals(i.getPluginName()))) {
                throw new Exception("KillBill is missing plugin: " + STRIPE_PLUGIN_NAME);
            }

            TenantKeyValue pluginConfiguration = kbTenantProvider.get().getPluginConfiguration(STRIPE_PLUGIN_NAME, KillBillUtil.roDefault());
            String expectedConf = "org.killbill.billing.plugin.stripe.apiKey=" + stripePluginApiKey.trim();
            if (pluginConfiguration == null || pluginConfiguration.getValues() == null || pluginConfiguration.getValues().isEmpty() || !expectedConf.equals(pluginConfiguration.getValues().get(0).trim())) {
                kbTenantProvider.get().uploadPluginConfiguration(STRIPE_PLUGIN_NAME, expectedConf, KillBillUtil.roDefault());
                log.info("Updating Stripe plugin API key");
            }
        }

        if (config.emailPluginSync()) {
            if (!pluginInfos.isPresent()) {
                pluginInfos = Optional.of(kbPluginInfoProvider.get().getPluginsInfo(RequestOptions.empty()));
            }
            if (pluginInfos.get().stream().anyMatch(i -> EMAIL_PLUGIN_NAME.equals(i.getPluginName()))) {
                throw new Exception("KillBill is missing plugin: " + EMAIL_PLUGIN_NAME);
            }

            String expectedConf = new StrBuilder()
                    .append("org.killbill.billing.plugin.email-notifications.defaultEvents=")
                    .appendln(config.emailPluginEmailEvents().stream().collect(Collectors.joining(",")))
                    .append("org.killbill.billing.plugin.email-notifications.smtp.host=")
                    .appendln(config.emailPluginHost())
                    .append("org.killbill.billing.plugin.email-notifications.smtp.port=")
                    .appendln(config.emailPluginPort())
                    .appendln("org.killbill.billing.plugin.email-notifications.smtp.useAuthentication=true")
                    .append("org.killbill.billing.plugin.email-notifications.smtp.userName=")
                    .appendln(config.emailPluginUsername())
                    .append("org.killbill.billing.plugin.email-notifications.smtp.password=")
                    .appendln(config.emailPluginPassword())
                    .append("org.killbill.billing.plugin.email-notifications.smtp.defaultSender=")
                    .appendln(config.emailPluginSender())
                    .appendln("org.killbill.billing.plugin.email-notifications.smtp.useSSL=true")
                    .appendln("org.killbill.billing.plugin.email-notifications.smtp.sendHTMLEmail=true")
                    .toString();

            TenantKeyValue pluginConfiguration = kbTenantProvider.get().getPluginConfiguration(EMAIL_PLUGIN_NAME, KillBillUtil.roDefault());
            if (pluginConfiguration == null || pluginConfiguration.getValues() == null || pluginConfiguration.getValues().isEmpty() || !expectedConf.equals(pluginConfiguration.getValues().get(0).trim())) {
                log.info("Updating Email plugin conf");
                kbTenantProvider.get().uploadPluginConfiguration(EMAIL_PLUGIN_NAME, expectedConf, KillBillUtil.roDefault());
            }

            // Default templates: https://github.com/killbill/killbill-email-notifications-plugin/tree/master/src/main/resources/org/killbill/billing/plugin/notification/templates
            String emailTemplateFailedPayment = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/billing-FailedPayment.html"), Charsets.UTF_8);
            setUserKeyValueIfDifferent("killbill-email-notifications:FAILED_PAYMENT_en_US", emailTemplateFailedPayment);
        }

        if (config.uploadInvoiceTemplate()) {
            String invoiceTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("killbill/invoice-template.html"), Charsets.UTF_8);
            kbInvoiceProvider.get().uploadInvoiceTemplate(
                    invoiceTemplateHtml,
                    true,
                    KillBillUtil.roDefault());
        }

        if (config.uploadCatalogs() && !CATALOG_FILENAMES.isEmpty()) {
            DocumentBuilder docBuilder = DocumentBuilderFactory.newInstance()
                    .newDocumentBuilder();
            XPathExpression effectiveDateXPath = XPathFactory.newInstance()
                    .newXPath()
                    .compile("//catalog/effectiveDate/text()");
            DateTimes catalogVersions = kbCatalogProvider.get().getCatalogVersions(null, KillBillUtil.roDefault());
            for (String fileName : CATALOG_FILENAMES) {
                String catalogStr = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("killbill/" + fileName), Charsets.UTF_8);
                Document doc = docBuilder.parse(new ByteArrayInputStream(catalogStr.getBytes(Charsets.UTF_8)));
                String effectiveDateStr = effectiveDateXPath.evaluate(doc);
                DateTime effectiveDate = new DateTime(effectiveDateStr);
                if (!catalogVersions.contains(effectiveDate)) {
                    log.info("Uploading catalog file {} effectiveDate {}", fileName, effectiveDateStr);
                    kbCatalogProvider.get().uploadCatalogXml(catalogStr, KillBillUtil.roDefault());
                }
            }
        }
    }

    void setUserKeyValueIfDifferent(String key, String value) throws KillBillClientException {
        TenantKeyValue userKeyValue = kbTenantProvider.get().getUserKeyValue(key, KillBillUtil.roDefault());
        Optional<String> currentValueOpt = Optional.ofNullable(userKeyValue != null && userKeyValue.getValues() != null && !userKeyValue.getValues().isEmpty()
                ? userKeyValue.getValues().get(0) : null);
        if (value.equals(currentValueOpt.orElse(null))) {
            return;
        }
        if (currentValueOpt.isPresent()) {
            kbTenantProvider.get().deleteUserKeyValue(key, KillBillUtil.roDefault());
        }
        kbTenantProvider.get().insertUserKeyValue(key, value, KillBillUtil.roDefault());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(KillBillSync.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(KillBillSync.class);
            }
        };
    }
}
