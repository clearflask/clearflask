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
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.text.StrBuilder;
import org.joda.time.DateTime;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.api.gen.TenantApi;
import org.killbill.billing.client.model.DateTimes;
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
import java.util.stream.Collectors;

@Slf4j
@Singleton
public class KillBillSync extends ManagedService {
    private static final String STRIPE_PLUGIN_NAME = "killbill-stripe";
    private static final String EMAIL_PLUGIN_NAME = "email-notifications";
    private static final String PER_TENANT_CONFIG = "\"org.killbill.payment.retry.days=1,2,3\"" +
            "\"org.killbill.billing.server.notifications.retries=1m,2h,1d,2d\"";
    private static final ImmutableList<String> CATALOG_FILENAMES = ImmutableList.<String>builder()
            .add("catalog001.xml")
            .build();

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        Observable<Boolean> enabledObservable();

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
        boolean uploadCatalogs();

    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;
    @Inject
    private Provider<TenantApi> kbTenantProvider;
    @Inject
    private Provider<CatalogApi> kbCatalogProvider;

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

        List<String> perTenantConfig = config.perTenantConfig();
        if (!perTenantConfig.isEmpty()) {
            ImmutableMap<String, String> expectedProps = perTenantConfig.stream()
                    .collect(ImmutableMap.toImmutableMap(
                            s -> s.split("=")[0],
                            s -> s.split("=")[1]));
            Map<String, String> actualProps = gson.fromJson(kbTenantProvider.get().getPerTenantConfiguration(RequestOptions.empty())
                    .getValues().get(0), new TypeToken<Map<String, String>>() {
            }.getType());
            boolean isMatch = expectedProps.entrySet().stream()
                    .allMatch(e -> e.getValue().equals(actualProps.get(e.getKey())));
            if (!isMatch) {
                HashMap<String, String> props = Maps.newHashMap();
                props.putAll(actualProps);
                props.putAll(expectedProps);
                String propsStr = gson.toJson(props);
                kbTenantProvider.get().uploadPerTenantConfiguration(propsStr, RequestOptions.empty());
                log.info("Setting perTenantConfiguration {}", propsStr);
            }
        }

        String stripePluginApiKey = config.stripePluginApiKey();
        if (!Strings.isNullOrEmpty(stripePluginApiKey)) {
            List<String> values = kbTenantProvider.get().getPluginConfiguration(STRIPE_PLUGIN_NAME, RequestOptions.empty()).getValues();
            String expectedConf = "org.killbill.billing.plugin.stripe.apiKey=" + stripePluginApiKey.trim();
            if (values.isEmpty() || !expectedConf.equals(values.get(0).trim())) {
                kbTenantProvider.get().uploadPluginConfiguration(STRIPE_PLUGIN_NAME, expectedConf, RequestOptions.empty());
                log.info("Updating Stripe plugin API key");
            }
        }

        if (config.emailPluginSync()) {
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

            List<String> values = kbTenantProvider.get().getPluginConfiguration(EMAIL_PLUGIN_NAME, RequestOptions.empty()).getValues();
            if (values.isEmpty() || !expectedConf.equals(values.get(0).trim())) {
                kbTenantProvider.get().uploadPluginConfiguration(EMAIL_PLUGIN_NAME, expectedConf, RequestOptions.empty());
                log.info("Updating Email plugin conf");
            }

            // Default templates: https://github.com/killbill/killbill-email-notifications-plugin/tree/master/src/main/resources/org/killbill/billing/plugin/notification/templates
            String emailTemplateFailedPayment = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/billing-FailedPayment.html"), Charsets.UTF_8);
            setUserKeyValueIfDifferent("killbill-email-notifications:FAILED_PAYMENT_en_US", emailTemplateFailedPayment);
        }

        if (config.uploadCatalogs() && !CATALOG_FILENAMES.isEmpty()) {
            DocumentBuilder docBuilder = DocumentBuilderFactory.newInstance()
                    .newDocumentBuilder();
            XPathExpression effectiveDateXPath = XPathFactory.newInstance()
                    .newXPath()
                    .compile("//catalog/effectiveDate/text()");
            DateTimes catalogVersions = kbCatalogProvider.get().getCatalogVersions(null, RequestOptions.empty());
            for (String fileName : CATALOG_FILENAMES) {
                String catalogStr = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("killbill/" + fileName), Charsets.UTF_8);
                Document doc = docBuilder.parse(new ByteArrayInputStream(catalogStr.getBytes(Charsets.UTF_8)));
                String effectiveDateStr = effectiveDateXPath.evaluate(doc);
                DateTime effectiveDate = new DateTime(effectiveDateStr);
                if (!catalogVersions.contains(effectiveDate)) {
                    kbCatalogProvider.get().uploadCatalogXml(catalogStr, RequestOptions.empty());
                    log.info("Uploading catalog file {} effectiveDate {}", fileName, effectiveDateStr);
                }
            }
        }
    }

    void setUserKeyValueIfDifferent(String key, String value) throws KillBillClientException {
        List<String> values = kbTenantProvider.get().getUserKeyValue(key, RequestOptions.empty()).getValues();
        if (!values.isEmpty() && value.equals(values.get(0))) {
            return;
        }
        if (!values.isEmpty()) {
            kbTenantProvider.get().deleteUserKeyValue(key, RequestOptions.empty());
        }
        kbTenantProvider.get().insertUserKeyValue(key, value, RequestOptions.empty());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(KillBillSync.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
