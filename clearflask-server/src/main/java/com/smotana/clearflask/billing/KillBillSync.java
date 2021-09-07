// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.billing;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import com.google.common.io.Resources;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.billing.ReportConfigurationJson.ReportConfigurationJsonList;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.text.StrBuilder;
import org.joda.time.DateTime;
import org.killbill.billing.catalog.api.TimeUnit;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.KillBillHttpClient;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.api.gen.InvoiceApi;
import org.killbill.billing.client.api.gen.OverdueApi;
import org.killbill.billing.client.api.gen.PluginInfoApi;
import org.killbill.billing.client.api.gen.TenantApi;
import org.killbill.billing.client.model.DateTimes;
import org.killbill.billing.client.model.PluginInfos;
import org.killbill.billing.client.model.gen.Duration;
import org.killbill.billing.client.model.gen.Overdue;
import org.killbill.billing.client.model.gen.OverdueCondition;
import org.killbill.billing.client.model.gen.OverdueStateConfig;
import org.killbill.billing.client.model.gen.Tenant;
import org.killbill.billing.client.model.gen.TenantKeyValue;
import org.killbill.billing.overdue.api.OverdueCancellationPolicy;
import org.w3c.dom.Document;
import rx.Observable;

import javax.ws.rs.core.MediaType;
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

import static com.smotana.clearflask.billing.KillBillClientProvider.STRIPE_PLUGIN_NAME;
import static com.smotana.clearflask.billing.ReportConfigurationJson.Frequency.DAILY;
import static com.smotana.clearflask.billing.ReportConfigurationJson.Frequency.HOURLY;
import static com.smotana.clearflask.billing.ReportConfigurationJson.ReportType.*;

@Slf4j
@Singleton
public class KillBillSync extends ManagedService {
    public static final String OVERDUE_CANCELLED_STATE_NAME = "CANCELLED";
    public static final String OVERDUE_UNPAID_STATE_NAME = "UNPAID";
    public static final String CATALOG_PREFIX = "killbill/";
    public static final ImmutableList<String> CATALOG_FILENAMES = ImmutableList.<String>builder()
            .add("catalog001.xml")
            .add("catalog002.xml")
            .add("catalog005.xml")
            .add("catalog006.xml")
            .build();
    private static final String PER_TENANT_CONFIG = "\"org.killbill.payment.retry.days=1,2,3\"," +
            "\"org.killbill.billing.server.notifications.retries=1m,2h,1d,2d\"";
    private static final Overdue OVERDUE = new Overdue()
            .setInitialReevaluationInterval(1)
            .addOverdueStatesItem(new OverdueStateConfig()
                    .setName(OVERDUE_CANCELLED_STATE_NAME)
                    .setCondition(new OverdueCondition()
                            .setTimeSinceEarliestUnpaidInvoiceEqualsOrExceeds(new Duration()
                                    .setUnit(TimeUnit.DAYS)
                                    .setNumber(21)))
                    .setExternalMessage("Plan cancelled")
                    .setIsBlockChanges(true)
                    .setIsClearState(false)
                    .setIsDisableEntitlement(false)
                    .setSubscriptionCancellationPolicy(OverdueCancellationPolicy.END_OF_TERM))
            .addOverdueStatesItem(new OverdueStateConfig()
                    .setName(OVERDUE_UNPAID_STATE_NAME)
                    .setCondition(new OverdueCondition()
                            .setTimeSinceEarliestUnpaidInvoiceEqualsOrExceeds(new Duration()
                                    .setUnit(TimeUnit.DAYS)
                                    .setNumber(1)))
                    .setExternalMessage("Plan overdue")
                    .setIsBlockChanges(false)
                    .setIsClearState(false)
                    .setIsDisableEntitlement(false)
                    .setSubscriptionCancellationPolicy(OverdueCancellationPolicy.NONE)
                    .setAutoReevaluationIntervalDays(20));
    /**
     * Reports extracted from: https://github.com/killbill/killbill-analytics-plugin/blob/master/src/main/resources/seed_reports.sh
     */
    private static final ImmutableList<ReportConfigurationJson> DEFAULT_ANALYTICS_REPORTS = ImmutableList.<ReportConfigurationJson>builder()
            // Dashboard views
            .add(new ReportConfigurationJson(null, "report_accounts_summary", "Account summary", COUNTERS, "report_accounts_summary", "refresh_report_accounts_summary", HOURLY, null, null))
            .add(new ReportConfigurationJson(null, "report_active_by_product_term_monthly", "Monthly active subscriptions", TIMELINE, "report_active_by_product_term_monthly", "refresh_report_active_by_product_term_monthly", DAILY, null, null))
            .add(new ReportConfigurationJson(null, "report_cancellations_daily", "Daily cancellations", TIMELINE, "report_cancellations_daily", "refresh_report_cancellations_daily", DAILY, null, null))
            .add(new ReportConfigurationJson(null, "report_chargebacks_daily", "Daily chargebacks value", TIMELINE, "report_chargebacks_daily", "refresh_report_chargebacks_daily", DAILY, null, null))
            .add(new ReportConfigurationJson(null, "report_conversions_daily", "Conversions", TIMELINE, "v_report_conversions_daily", null, null, null, null))
            .add(new ReportConfigurationJson(null, "report_invoice_adjustments_daily", "Invoice adjustments", TIMELINE, "v_report_invoice_adjustments_daily", null, null, null, null))
            .add(new ReportConfigurationJson(null, "report_invoice_item_adjustments_daily", "Invoice item adjustments", TIMELINE, "v_report_invoice_item_adjustments_daily", null, null, null, null))
            .add(new ReportConfigurationJson(null, "report_invoice_item_credits_daily", "Invoice credits", TIMELINE, "v_report_invoice_item_credits_daily", null, null, null, null))
            .add(new ReportConfigurationJson(null, "report_invoices_balance_daily", "Daily invoice balance", TIMELINE, "report_invoices_balance_daily", "refresh_report_invoices_balance_daily", DAILY, null, null))
            .add(new ReportConfigurationJson(null, "report_invoices_daily", "Daily invoices value", TIMELINE, "report_invoices_daily", "refresh_report_invoices_daily", DAILY, null, null))
            .add(new ReportConfigurationJson(null, "report_mrr_daily", "Daily MRR", TIMELINE, "report_mrr_daily", "refresh_report_mrr_daily", DAILY, null, null))
            .add(new ReportConfigurationJson(null, "report_new_accounts_daily", "Daily new accounts", TIMELINE, "report_new_accounts_daily", "refresh_report_new_accounts_daily", HOURLY, null, null))
            .add(new ReportConfigurationJson(null, "report_overdue_states_count_daily", "Overdue states", TIMELINE, "v_report_overdue_states_count_daily", null, null, null, null))
            .add(new ReportConfigurationJson(null, "report_payments_total_daily", "Daily payments value", TIMELINE, "report_payments_total_daily", "refresh_report_payments_total_daily", HOURLY, null, null))
            .add(new ReportConfigurationJson(null, "report_refunds_total_daily", "Daily refunds value", TIMELINE, "report_refunds_total_daily", "refresh_report_refunds_total_daily", HOURLY, null, null))
            .add(new ReportConfigurationJson(null, "report_trial_starts_count_daily", "Trials", TIMELINE, "v_report_trial_starts_count_daily", null, null, null, null))
            .add(new ReportConfigurationJson(null, "report_payment_provider_conversion", "Payment Provider Conversion", TABLE, "report_payment_provider_conversion_history", "refresh_report_payment_provider_conversion_history", HOURLY, null, null))
            .add(new ReportConfigurationJson(null, "report_payment_provider_errors", "Payment Provider Errors", TIMELINE, "report_payment_provider_errors", "refresh_report_payment_provider_errors", HOURLY, null, null))
            .add(new ReportConfigurationJson(null, "report_payment_provider_monitor", "Payment Provider Monitor", TABLE, "report_payment_provider_monitor_history", "refresh_report_payment_provider_monitor_history", DAILY, null, null))
            .add(new ReportConfigurationJson(null, "report_payments_by_provider", "Payments By Provider", TABLE, "report_payments_by_provider_history", "refresh_report_payments_by_provider_history", HOURLY, null, null))
            .add(new ReportConfigurationJson(null, "report_payments_by_provider_last_24h_summary", "Payments By Provider (24h summary)", COUNTERS, "report_payments_by_provider_last_24h_summary", "refresh_report_payments_by_provider_last_24h_summary", DAILY, null, null))
            // System views
            .add(new ReportConfigurationJson(null, "system_report_control_tag_no_test", "Control tags", COUNTERS, "v_system_report_control_tag_no_test", null, null, null, null))
            .add(new ReportConfigurationJson(null, "system_report_notifications_per_queue_name", "Notification queues", TIMELINE, "v_system_report_notifications_per_queue_name", null, null, null, null))
            .add(new ReportConfigurationJson(null, "system_report_notifications_per_queue_name_late", "Late notifications", COUNTERS, "v_system_report_notifications_per_queue_name_late", null, null, null, null))
            .add(new ReportConfigurationJson(null, "system_report_payments", "Payments status", COUNTERS, "v_system_report_payments", null, null, null, null))
            .add(new ReportConfigurationJson(null, "system_report_payments_per_day", "Payments", TIMELINE, "v_system_report_payments_per_day", null, null, null, null))
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

        @DefaultValue("true")
        boolean stripePluginSync();

        @DefaultValue("ClearFlask platform")
        String stripePluginChargeStatementDesc();

        @DefaultValue("false")
        boolean uploadAnalyticsReports();

        @DefaultValue("true")
        boolean uploadInvoiceTemplate();

        @DefaultValue("true")
        boolean uploadOverdue();

        @DefaultValue("true")
        boolean uploadCatalogs();
    }

    @Inject
    private Config config;
    @Inject
    private StripeClientSetup.Config configStripeClient;
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
    private Provider<OverdueApi> kbOverdueProvider;
    @Inject
    private Provider<KillBillHttpClient> kbClientProvider;

    private final AtomicBoolean synced = new AtomicBoolean(false);

    @Override
    protected void serviceStart() throws Exception {
        sync();
        config.enabledObservable().subscribe(enabled -> {
            if (enabled && this.isRunning()) {
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
            log.info("Skipping killbill sync, disabled");
            return;
        }

        if (synced.getAndSet(true)) {
            log.trace("Skipping killbill sync, already synced");
            return;
        }

        log.info("Performing KillBill sync");

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
        } else {
            log.info("Skipping create tenant, disabled");
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
                log.info("Setting perTenantConfiguration {} from {}", props, actualProps);
                kbTenantProvider.get().uploadPerTenantConfiguration(propsStr, KillBillUtil.roDefault());
            }
        } else {
            log.info("Skipping per tenant config sync, empty config");
        }

        Optional<PluginInfos> pluginInfos = Optional.empty();

        if (config.stripePluginSync()) {
            if (!pluginInfos.isPresent()) {
                pluginInfos = Optional.of(kbPluginInfoProvider.get().getPluginsInfo(RequestOptions.empty()));
            }
            if (pluginInfos.get().stream().anyMatch(i -> STRIPE_PLUGIN_NAME.equals(i.getPluginName()))) {
                throw new Exception("KillBill is missing plugin: " + STRIPE_PLUGIN_NAME);
            }

            // Config props defined here https://github.com/killbill/killbill-stripe-plugin/blob/master/src/main/java/org/killbill/billing/plugin/stripe/StripeConfigProperties.java#L59
            Map<String, Object> stripeProperties = Maps.newHashMap();
            stripeProperties.put("org.killbill.billing.plugin.stripe.apiKey", configStripeClient.stripeApiKey());
            stripeProperties.put("org.killbill.billing.plugin.stripe.chargeDescription", config.stripePluginChargeStatementDesc().trim());
            stripeProperties.put("org.killbill.billing.plugin.stripe.chargeStatementDescriptor", config.stripePluginChargeStatementDesc().trim());
            stripeProperties.put("org.killbill.billing.plugin.stripe.cancelOn3DSAuthorizationFailure", true);
            String stripeExpectedConf = toPropertiesString(stripeProperties);

            TenantKeyValue pluginConfiguration = kbTenantProvider.get().getPluginConfiguration(STRIPE_PLUGIN_NAME, KillBillUtil.roDefault());
            if (pluginConfiguration == null || pluginConfiguration.getValues() == null || pluginConfiguration.getValues().isEmpty() || !stripeExpectedConf.equals(pluginConfiguration.getValues().get(0).trim())) {
                log.info("Updating Stripe plugin config");
                log.trace("Stripe config expected:\n{}\nactual:\n{}", stripeExpectedConf, pluginConfiguration);
                kbTenantProvider.get().uploadPluginConfiguration(STRIPE_PLUGIN_NAME, stripeExpectedConf, KillBillUtil.roDefault());
            } else {
                log.info("Skipping Stripe plugin config, already set");
            }
        } else {
            log.info("Skipping Stripe plugin sync, disabled");
        }

        if (config.uploadAnalyticsReports()) {
            // Undocumented API to retrieve all reports rather than making a call for each report
            // https://github.com/killbill/killbill-analytics-plugin/blob/master/src/main/java/org/killbill/billing/plugin/analytics/http/ReportsResource.java
            ReportConfigurationJsonList reports = kbClientProvider.get().doGet("/plugins/killbill-analytics/reports", ReportConfigurationJsonList.class, KillBillUtil.roDefault());
            ImmutableMap<String, ReportConfigurationJson> reportsMap = reports.stream().collect(ImmutableMap.toImmutableMap(
                    ReportConfigurationJson::getReportName, r -> r));
            for (ReportConfigurationJson report : DEFAULT_ANALYTICS_REPORTS) {
                Optional<ReportConfigurationJson> oldReportOpt = Optional.ofNullable(reportsMap.get(report.getReportName()));
                if (oldReportOpt.isPresent() && report.equals(oldReportOpt.get())) {
                    log.info("Skipping analytics plugin report {}, already exists", report.getReportName());
                    continue;
                }
                log.info("Setting analytics plugin report {} old report {}", report, oldReportOpt);
                kbClientProvider.get().doPost("/plugins/killbill-analytics/reports" + (oldReportOpt.isPresent() ? "?shouldUpdate=true" : ""), report, KillBillUtil.roBuilder()
                        .withHeader("Content-Type", MediaType.APPLICATION_JSON)
                        .build());
            }
        } else {
            log.info("Skipping analytics reports sync, disabled");
        }

        if (config.uploadInvoiceTemplate()) {
            String invoiceTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("killbill/invoice-template.mustache"), Charsets.UTF_8);
            String invoiceTemplateHtmlOld = kbInvoiceProvider.get().getInvoiceTemplate(KillBillUtil.roDefault());
            if (invoiceTemplateHtml.equals(invoiceTemplateHtmlOld)) {
                log.info("Skipping invoice template, already exists");
            } else {
                log.info("Uploading invoice template {} old template {}",
                        invoiceTemplateHtml, invoiceTemplateHtmlOld);
                kbInvoiceProvider.get().uploadInvoiceTemplate(
                        invoiceTemplateHtml,
                        true,
                        KillBillUtil.roDefault());
            }
        } else {
            log.info("Skipping invoice template sync, disabled");
        }

        if (config.uploadOverdue()) {
            Overdue overdueCurrent = kbOverdueProvider.get().getOverdueConfigJson(KillBillUtil.roDefault());
            if (OVERDUE.equals(overdueCurrent)) {
                log.info("Skipping overdue file, already the same");
            } else {
                log.info("Uploading overdue file {} old {}", OVERDUE, overdueCurrent);
                // This original API uses followLocation option that throws:
                // > JsonParseException: Unexpected character ('<' (code 60))
                // kbOverdueProvider.get().uploadOverdueConfigJson(OVERDUE, KillBillUtil.roDefault());
                kbClientProvider.get().doPost("/1.0/kb/overdue", OVERDUE, KillBillUtil.roBuilder()
                        .withHeader("Content-Type", MediaType.APPLICATION_JSON)
                        .build());
            }
        } else {
            log.info("Skipping overdue sync, disabled");
        }

        if (config.uploadCatalogs()) {
            DocumentBuilder docBuilder = DocumentBuilderFactory.newInstance()
                    .newDocumentBuilder();
            XPathExpression effectiveDateXPath = XPathFactory.newInstance()
                    .newXPath()
                    .compile("//catalog/effectiveDate/text()");
            DateTimes catalogVersions = kbCatalogProvider.get().getCatalogVersions(null, KillBillUtil.roDefault());
            log.trace("Uploaded catalog versions: {}", catalogVersions);
            for (String fileName : CATALOG_FILENAMES) {
                String catalogStr = Resources.toString(Thread.currentThread().getContextClassLoader().getResource(CATALOG_PREFIX + fileName), Charsets.UTF_8);
                Document doc = docBuilder.parse(new ByteArrayInputStream(catalogStr.getBytes(Charsets.UTF_8)));
                String effectiveDateStr = effectiveDateXPath.evaluate(doc);
                DateTime effectiveDate = new DateTime(effectiveDateStr);
                if (catalogVersions.stream().anyMatch(effectiveDate::isEqual)) {
                    log.info("Skipping catalog file {} effectiveDate {}, already exists", fileName, effectiveDate);
                } else {
                    log.info("Uploading catalog file {} effectiveDate {}", fileName, effectiveDate);
                    kbCatalogProvider.get().uploadCatalogXml(catalogStr, KillBillUtil.roDefault());
                }
            }
        } else {
            log.info("Skipping overdue sync, disabled");
        }
    }

    private void setUserKeyValueIfDifferent(String key, String value) throws KillBillClientException {
        TenantKeyValue userKeyValue = kbTenantProvider.get().getUserKeyValue(key, KillBillUtil.roDefault());
        Optional<String> currentValueOpt = Optional.ofNullable(userKeyValue != null && userKeyValue.getValues() != null && !userKeyValue.getValues().isEmpty()
                ? userKeyValue.getValues().get(0) : null);
        if (value.equals(currentValueOpt.orElse(null))) {
            log.info("Skipping user key value {}, already set", key);
            return;
        }
        log.info("Setting user key value {} to {} from {}, already set",
                key, value, currentValueOpt);
        if (currentValueOpt.isPresent()) {
            kbTenantProvider.get().deleteUserKeyValue(key, KillBillUtil.roDefault());
        }
        kbTenantProvider.get().insertUserKeyValue(key, value, KillBillUtil.roDefault());
    }

    private String toPropertiesString(Map<String, Object> propsMap) {
        StrBuilder builder = new StrBuilder()
                .appendln("# AUTOGENERATED, DO NOT EDIT");
        propsMap.forEach((key, val) -> builder.append(key).append("=").appendln(val.toString()));
        return builder.toString();
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
