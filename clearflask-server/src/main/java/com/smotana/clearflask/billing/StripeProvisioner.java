// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.ServiceSecretStore;
import com.smotana.clearflask.util.Extern;
import com.stripe.exception.StripeException;
import com.stripe.model.Price;
import com.stripe.model.Product;
import com.stripe.model.WebhookEndpoint;
import com.stripe.model.ProductFeature;
import com.stripe.model.entitlements.Feature;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.PriceListParams;
import com.stripe.param.ProductCreateParams;
import com.stripe.param.ProductFeatureCreateParams;
import com.stripe.param.ProductFeatureListParams;
import com.stripe.param.ProductListParams;
import com.stripe.param.WebhookEndpointCreateParams;
import com.stripe.param.WebhookEndpointListParams;
import com.stripe.param.entitlements.FeatureCreateParams;
import com.stripe.param.entitlements.FeatureListParams;
import lombok.AllArgsConstructor;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Stripe "infrastructure as code" — idempotently provisions everything Stripe needs to
 * back ClearFlask's billing: Products, Prices, Features, Portal configuration, and the
 * webhook endpoint.
 *
 * <p>Run {@link #upsertAll()} once per Stripe environment (test mode for staging/dev,
 * live mode for prod). Re-running is safe and acts as "sync" — existing entries are
 * matched by {@code metadata.clearflask_plan_id} (Products/Prices) or
 * {@code lookup_key} (Features) or webhook URL (Webhook endpoints).
 *
 * <p>Invoked manually via the {@link Extern @Extern} super-admin endpoint.
 */
@Slf4j
@Singleton
public class StripeProvisioner extends com.smotana.clearflask.core.ManagedService {

    public interface Config {
        /**
         * Disable webhook auto-registration if you prefer manual setup. Default true so
         * the typical operator path works out of the box.
         */
        @DefaultValue("true")
        boolean autoRegisterWebhook();

        /**
         * Run {@link #upsertAll()} automatically when the server starts. Default true so
         * a fresh deploy doesn't require a manual JMX call to bring up Stripe Products,
         * Prices, Features, and the WebhookEndpoint. Idempotent: re-running on every
         * boot is safe and acts as a sync. Failure is logged but does not block startup
         * -- a misconfigured Stripe key shouldn't prevent the rest of the app from coming
         * up. Set false in test / local environments where Stripe isn't configured.
         */
        @DefaultValue("true")
        boolean provisionOnStartup();
    }

    @Value
    @AllArgsConstructor
    public static class PlanSpec {
        String planId;
        String productName;
        Long monthlyAmountCents;
        String interval;
        Set<String> featureKeys;
    }

    /**
     * Definitive list of plans backed by Stripe Products. Grandfathered $0 plans
     * (lifetime, pitchground, starter-unlimited, cloud-free, teammate-unlimited)
     * are NOT here — they live in NoOpBilling and never touch Stripe.
     */
    public static final ImmutableList<PlanSpec> PLAN_SPECS = ImmutableList.of(
            new PlanSpec("cloud-starter-monthly", "Cloud Starter", 600L, "month",
                    ImmutableSet.of("custom_domain")),
            new PlanSpec("cloud-monthly2", "Cloud", 2900L, "month",
                    ImmutableSet.of("custom_domain", "private_projects", "api_access",
                            "whitelabel", "unlimited_teammates", "extra_project")),
            new PlanSpec("cloud-yearly", "Cloud Pro", 49000L, "year",
                    ImmutableSet.of("custom_domain", "private_projects", "api_access",
                            "whitelabel", "unlimited_teammates", "extra_project")),
            new PlanSpec("selfhost-monthly2", "Self-host License", 900L, "month",
                    ImmutableSet.of("custom_domain", "private_projects", "api_access",
                            "whitelabel", "unlimited_teammates")),
            new PlanSpec("selfhost-yearly2", "Self-host Yearly", 72000L, "year",
                    ImmutableSet.of("custom_domain", "private_projects", "api_access",
                            "whitelabel", "unlimited_teammates")),
            // sponsor-monthly: variable price, set per customer at change time.
            new PlanSpec("sponsor-monthly", "Sponsor", null, "month",
                    ImmutableSet.of("custom_domain", "private_projects", "whitelabel",
                            "unlimited_teammates")),
            // flat-yearly: variable price set by super-admin at change time.
            new PlanSpec("flat-yearly", "Business", null, "year",
                    ImmutableSet.of("custom_domain", "private_projects", "api_access",
                            "whitelabel", "unlimited_teammates", "extra_project"))
    );

    /**
     * Stripe Entitlement Features. Lookup keys are stable identifiers; names are display labels.
     */
    public static final ImmutableMap<String, String> FEATURES = ImmutableMap.<String, String>builder()
            .put("private_projects", "Private projects")
            .put("whitelabel", "Whitelabel (no ClearFlask branding)")
            .put("api_access", "API access")
            .put("extra_project", "Extra projects")
            .put("custom_domain", "Custom domain")
            .put("unlimited_teammates", "Unlimited teammates")
            .build();

    @Inject
    private Config config;
    @Inject
    private com.smotana.clearflask.web.Application.Config configApp;
    @Inject
    private ServiceSecretStore serviceSecretStore;
    @Inject
    private StripeClientSetup.Config stripeClientConfig;

    /** Public-facing app URL derived from {@code Application.Config.domain}. */
    private String publicUrl() {
        return "https://" + configApp.domain();
    }

    @Override
    protected void serviceStart() {
        if (!config.provisionOnStartup()) {
            log.info("StripeProvisioner: provisionOnStartup disabled, skipping");
            return;
        }
        // Skip silently if Stripe isn't even wired in this environment (e.g. test runs that
        // disable the Stripe module). Without a key the SDK throws on first call.
        try {
            if (com.google.common.base.Strings.isNullOrEmpty(stripeClientConfig.stripeApiKey())) {
                log.info("StripeProvisioner: stripeApiKey absent, skipping startup provision");
                return;
            }
        } catch (Exception ex) {
            log.info("StripeProvisioner: stripeApiKey not configured, skipping startup provision");
            return;
        }
        try {
            log.info("StripeProvisioner: running upsertAll on startup");
            upsertAll();
        } catch (Exception ex) {
            // Idempotent retry happens on next boot. Don't fail the JVM start over a
            // transient Stripe outage or misconfig.
            log.warn("StripeProvisioner: startup upsertAll failed (continuing)", ex);
        }
    }

    @Extern
    public String upsertAll() throws StripeException {
        StringBuilder report = new StringBuilder("Stripe provisioner report:\n");
        Map<String, String> featureLookupToId = upsertFeatures(report);
        Map<String, String> planIdToProductId = upsertProducts(report);
        upsertPrices(planIdToProductId, report);
        attachFeaturesToProducts(planIdToProductId, featureLookupToId, report);
        if (config.autoRegisterWebhook()) {
            upsertWebhook(report);
        } else {
            report.append("Webhook auto-registration disabled by config.\n");
        }
        log.info(report.toString());
        return report.toString();
    }

    private Map<String, String> upsertFeatures(StringBuilder report) throws StripeException {
        Map<String, String> existing = new HashMap<>();
        FeatureListParams listParams = FeatureListParams.builder().setLimit(100L).build();
        for (Feature f : Feature.list(listParams).autoPagingIterable()) {
            if (f.getLookupKey() != null) {
                existing.put(f.getLookupKey(), f.getId());
            }
        }
        Map<String, String> result = new HashMap<>(existing);
        for (Map.Entry<String, String> entry : FEATURES.entrySet()) {
            String lookup = entry.getKey();
            String name = entry.getValue();
            if (existing.containsKey(lookup)) {
                report.append("  Feature ").append(lookup).append(" (id ").append(existing.get(lookup))
                        .append(") OK\n");
                continue;
            }
            Feature created = Feature.create(FeatureCreateParams.builder()
                    .setLookupKey(lookup)
                    .setName(name)
                    .build());
            result.put(lookup, created.getId());
            report.append("  Feature ").append(lookup).append(" CREATED id=").append(created.getId())
                    .append("\n");
        }
        return result;
    }

    private Map<String, String> upsertProducts(StringBuilder report) throws StripeException {
        Map<String, String> existing = new HashMap<>();
        ProductListParams listParams = ProductListParams.builder().setLimit(100L).build();
        for (Product p : Product.list(listParams).autoPagingIterable()) {
            if (p.getMetadata() == null) continue;
            String planId = p.getMetadata().get(StripeBilling.META_CLEARFLASK_PLAN_ID);
            if (planId != null) {
                existing.put(planId, p.getId());
            }
        }
        Map<String, String> result = new HashMap<>(existing);
        for (PlanSpec spec : PLAN_SPECS) {
            if (existing.containsKey(spec.getPlanId())) {
                report.append("  Product ").append(spec.getPlanId()).append(" OK id=")
                        .append(existing.get(spec.getPlanId())).append("\n");
                continue;
            }
            Product created = Product.create(ProductCreateParams.builder()
                    .setName(spec.getProductName())
                    .putMetadata(StripeBilling.META_CLEARFLASK_PLAN_ID, spec.getPlanId())
                    .putMetadata(StripeBilling.META_CLEARFLASK, "true")
                    .build());
            result.put(spec.getPlanId(), created.getId());
            report.append("  Product ").append(spec.getPlanId()).append(" CREATED id=")
                    .append(created.getId()).append("\n");
        }
        return result;
    }

    private void upsertPrices(Map<String, String> planIdToProductId, StringBuilder report) throws StripeException {
        // Build a map of (planId -> existing default-price). A "default price" here is one
        // tagged with metadata.clearflask_plan_id that ISN'T a per-customer one-off.
        Map<String, Price> existingDefaultPrice = new HashMap<>();
        PriceListParams listParams = PriceListParams.builder()
                .setActive(true)
                .setLimit(100L)
                .build();
        for (Price price : Price.list(listParams).autoPagingIterable()) {
            if (price.getMetadata() == null) continue;
            String planId = price.getMetadata().get(StripeBilling.META_CLEARFLASK_PLAN_ID);
            String oneOff = price.getMetadata().get(StripeBilling.META_ONE_OFF_FOR_ACCOUNT);
            if (planId != null && Strings.isNullOrEmpty(oneOff)) {
                existingDefaultPrice.put(planId, price);
            }
        }

        for (PlanSpec spec : PLAN_SPECS) {
            if (spec.getMonthlyAmountCents() == null) {
                report.append("  Price ").append(spec.getPlanId())
                        .append(" SKIPPED (variable per-customer pricing)\n");
                continue;
            }
            Price existing = existingDefaultPrice.get(spec.getPlanId());
            if (existing != null
                    && existing.getUnitAmount() != null
                    && existing.getUnitAmount() == spec.getMonthlyAmountCents()
                    && existing.getRecurring() != null
                    && spec.getInterval().equals(existing.getRecurring().getInterval())) {
                report.append("  Price ").append(spec.getPlanId()).append(" OK id=")
                        .append(existing.getId()).append("\n");
                continue;
            }
            String productId = planIdToProductId.get(spec.getPlanId());
            PriceCreateParams params = PriceCreateParams.builder()
                    .setProduct(productId)
                    .setUnitAmount(spec.getMonthlyAmountCents())
                    .setCurrency("usd")
                    .setRecurring(PriceCreateParams.Recurring.builder()
                            .setInterval(PriceCreateParams.Recurring.Interval.valueOf(spec.getInterval().toUpperCase()))
                            .build())
                    .putMetadata(StripeBilling.META_CLEARFLASK_PLAN_ID, spec.getPlanId())
                    .putMetadata(StripeBilling.META_CLEARFLASK, "true")
                    .build();
            Price created = Price.create(params);
            report.append("  Price ").append(spec.getPlanId()).append(" CREATED id=")
                    .append(created.getId()).append("\n");
        }
    }

    private void attachFeaturesToProducts(Map<String, String> planIdToProductId,
                                          Map<String, String> featureLookupToId,
                                          StringBuilder report) throws StripeException {
        for (PlanSpec spec : PLAN_SPECS) {
            String productId = planIdToProductId.get(spec.getPlanId());
            if (productId == null) {
                continue;
            }
            Set<String> existing = new HashSet<>();
            ProductFeatureListParams listParams = ProductFeatureListParams.builder()
                    .setLimit(100L)
                    .build();
            for (ProductFeature pf : ProductFeature.list(productId, listParams).autoPagingIterable()) {
                if (pf.getEntitlementFeature() != null && pf.getEntitlementFeature().getLookupKey() != null) {
                    existing.add(pf.getEntitlementFeature().getLookupKey());
                }
            }
            for (String featureKey : spec.getFeatureKeys()) {
                if (existing.contains(featureKey)) continue;
                String featureId = featureLookupToId.get(featureKey);
                if (featureId == null) {
                    log.warn("Feature lookup_key {} not in our map; skipping", featureKey);
                    continue;
                }
                ProductFeature.create(productId, ProductFeatureCreateParams.builder()
                        .setEntitlementFeature(featureId)
                        .build());
                report.append("  Attached feature ").append(featureKey).append(" -> product ")
                        .append(spec.getPlanId()).append("\n");
            }
        }
    }

    private void upsertWebhook(StringBuilder report) throws StripeException {
        if (Strings.isNullOrEmpty(publicUrl())) {
            report.append("Webhook NOT registered: publicUrl is not configured.\n");
            return;
        }
        String url = publicUrl().replaceAll("/+$", "")
                + "/api/v1/webhook/stripe";
        WebhookEndpoint existing = null;
        WebhookEndpointListParams listParams = WebhookEndpointListParams.builder()
                .setLimit(100L)
                .build();
        for (WebhookEndpoint we : WebhookEndpoint.list(listParams).autoPagingIterable()) {
            if (url.equals(we.getUrl())) {
                existing = we;
                break;
            }
        }
        if (existing != null) {
            report.append("  Webhook OK id=").append(existing.getId()).append(" url=").append(url).append("\n");
            // Stripe only returns the signing secret on creation, so for pre-existing endpoints
            // we rely on the operator setting StripeBilling.Config.webhookSecretOverride.
            Optional<String> stored = serviceSecretStore.get(StripeBilling.WEBHOOK_SECRET_NAME);
            if (stored.isEmpty()) {
                report.append("    WARNING: webhook signing secret is unknown (endpoint pre-exists).\n");
                report.append("    Set StripeBilling.Config.webhookSecretOverride or recreate the endpoint.\n");
            }
            return;
        }
        WebhookEndpointCreateParams params = WebhookEndpointCreateParams.builder()
                .setUrl(url)
                .addEnabledEvent(WebhookEndpointCreateParams.EnabledEvent.CUSTOMER__SUBSCRIPTION__CREATED)
                .addEnabledEvent(WebhookEndpointCreateParams.EnabledEvent.CUSTOMER__SUBSCRIPTION__UPDATED)
                .addEnabledEvent(WebhookEndpointCreateParams.EnabledEvent.CUSTOMER__SUBSCRIPTION__DELETED)
                .addEnabledEvent(WebhookEndpointCreateParams.EnabledEvent.CUSTOMER__SUBSCRIPTION__TRIAL_WILL_END)
                .addEnabledEvent(WebhookEndpointCreateParams.EnabledEvent.INVOICE__PAYMENT_SUCCEEDED)
                .addEnabledEvent(WebhookEndpointCreateParams.EnabledEvent.INVOICE__PAYMENT_FAILED)
                .addEnabledEvent(WebhookEndpointCreateParams.EnabledEvent.CHECKOUT__SESSION__COMPLETED)
                .putMetadata(StripeBilling.META_CLEARFLASK, "true")
                .build();
        WebhookEndpoint created = WebhookEndpoint.create(params);
        if (!Strings.isNullOrEmpty(created.getSecret())) {
            serviceSecretStore.put(StripeBilling.WEBHOOK_SECRET_NAME, created.getSecret());
        }
        report.append("  Webhook CREATED id=").append(created.getId()).append(" url=").append(url)
                .append(" secret persisted=").append(!Strings.isNullOrEmpty(created.getSecret())).append("\n");
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeProvisioner.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                com.google.inject.multibindings.Multibinder.newSetBinder(binder(), com.smotana.clearflask.core.ManagedService.class)
                        .addBinding().to(StripeProvisioner.class).asEagerSingleton();
            }
        };
    }
}
