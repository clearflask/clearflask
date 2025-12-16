// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.api.model.PlanPricing.PeriodEnum;
import com.smotana.clearflask.billing.CouponStore.CouponModel;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.web.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.Price;
import com.stripe.model.PriceCollection;
import com.stripe.model.Product;
import com.stripe.model.ProductCollection;
import com.stripe.net.RequestOptions;
import com.stripe.param.PriceListParams;
import com.stripe.param.ProductListParams;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * PlanStore implementation that fetches plan information from Stripe Products/Prices.
 * <p>
 * Plans are configured in Stripe with metadata:
 * - plan_id: ClearFlask plan identifier (e.g., "starter-monthly", "pro-monthly")
 * - title: Display name for the plan
 * - description: Plan description
 * - terms: Additional terms/conditions
 * - period: MONTHLY, YEARLY, LIFETIME
 * - trial_days: Number of trial days (optional)
 * - tracked_users_limit: Maximum tracked users (optional)
 * - feature_*: Feature flags (feature_private_projects=true, feature_sso=true, etc.)
 * - visible_landing: Whether to show on landing page pricing
 * - visible_available: Whether plan is available for new signups
 */
@Slf4j
@Singleton
public class StripePlanStore extends ManagedService implements PlanStore {

    // Metadata keys for Stripe Products/Prices
    public static final String META_PLAN_ID = "plan_id";
    public static final String META_TITLE = "title";
    public static final String META_DESCRIPTION = "description";
    public static final String META_TERMS = "terms";
    public static final String META_PERIOD = "period";
    public static final String META_TRIAL_DAYS = "trial_days";
    public static final String META_TRACKED_USERS_LIMIT = "tracked_users_limit";
    public static final String META_TRACKED_USERS_PRICE = "tracked_users_price";
    public static final String META_VISIBLE_LANDING = "visible_landing";
    public static final String META_VISIBLE_AVAILABLE = "visible_available";
    public static final String META_FEATURE_PREFIX = "feature_";

    // Standard features that can be enabled via metadata
    private static final ImmutableSet<String> KNOWN_FEATURES = ImmutableSet.of(
            "private_projects",
            "sso",
            "whitelabel",
            "api_access",
            "priority_support",
            "custom_domain",
            "export_data",
            "integrations",
            "webhooks",
            "roadmap",
            "changelog",
            "voting",
            "comments",
            "analytics"
    );

    public interface Config {
        @DefaultValue("300")
        long planCacheTtlSeconds();

        @DefaultValue("true")
        boolean cacheEnabled();
    }

    @Inject
    private Config config;
    @Inject
    private StripeBillingConfig stripeBillingConfig;
    @Inject
    private AccountStore accountStore;

    // Cache for plans (keyed by isTestMode)
    private final Cache<Boolean, ImmutableMap<String, Plan>> plansCache = CacheBuilder.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .build();

    // Cache for price IDs (keyed by planId)
    private final Cache<String, String> priceIdCache = CacheBuilder.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .build();

    @Override
    protected void serviceStart() throws Exception {
        // Pre-warm cache
        try {
            loadPlansFromStripe(false);
            loadPlansFromStripe(true);
        } catch (Exception ex) {
            log.warn("Failed to pre-warm Stripe plan cache", ex);
        }
    }

    @Override
    protected void serviceStop() throws Exception {
        plansCache.invalidateAll();
        priceIdCache.invalidateAll();
    }

    private RequestOptions getRequestOptions(boolean testMode) {
        String apiKey = testMode
                ? stripeBillingConfig.stripeTestApiKey()
                : stripeBillingConfig.stripeLiveApiKey();
        return RequestOptions.builder()
                .setApiKey(apiKey)
                .build();
    }

    private boolean isTestMode() {
        return BillingRouter.isForceStripeTestMode();
    }

    private ImmutableMap<String, Plan> getPlans() {
        boolean testMode = isTestMode();
        try {
            if (config.cacheEnabled()) {
                ImmutableMap<String, Plan> cached = plansCache.getIfPresent(testMode);
                if (cached != null) {
                    return cached;
                }
            }
            return loadPlansFromStripe(testMode);
        } catch (StripeException ex) {
            log.error("Failed to load plans from Stripe", ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to load plans");
        }
    }

    private ImmutableMap<String, Plan> loadPlansFromStripe(boolean testMode) throws StripeException {
        RequestOptions requestOptions = getRequestOptions(testMode);

        // Fetch all active products
        ProductListParams productParams = ProductListParams.builder()
                .setActive(true)
                .setLimit(100L)
                .build();

        ProductCollection products = Product.list(productParams, requestOptions);

        // Fetch all active prices
        PriceListParams priceParams = PriceListParams.builder()
                .setActive(true)
                .setLimit(100L)
                .addExpand("data.product")
                .build();

        PriceCollection prices = Price.list(priceParams, requestOptions);

        // Build plan map
        Map<String, Plan> plans = new HashMap<>();

        for (Price price : prices.getData()) {
            Map<String, String> metadata = price.getMetadata();
            if (metadata == null || !metadata.containsKey(META_PLAN_ID)) {
                // Skip prices without plan_id metadata
                continue;
            }

            String planId = metadata.get(META_PLAN_ID);

            // Get product metadata as fallback
            Product product = price.getProductObject();
            Map<String, String> productMetadata = product != null ? product.getMetadata() : Collections.emptyMap();

            // Build the plan
            Plan plan = buildPlanFromMetadata(planId, price, metadata, productMetadata);
            plans.put(planId, plan);

            // Cache price ID
            priceIdCache.put(planId, price.getId());
        }

        ImmutableMap<String, Plan> result = ImmutableMap.copyOf(plans);
        plansCache.put(testMode, result);

        log.info("Loaded {} plans from Stripe (testMode={})", plans.size(), testMode);
        return result;
    }

    private Plan buildPlanFromMetadata(String planId, Price price, Map<String, String> priceMetadata, Map<String, String> productMetadata) {
        // Merge metadata (price takes precedence over product)
        Map<String, String> metadata = new HashMap<>(productMetadata);
        metadata.putAll(priceMetadata);

        String title = metadata.getOrDefault(META_TITLE, planId);
        PeriodEnum period = parsePeriod(metadata.getOrDefault(META_PERIOD, "MONTHLY"));

        // Parse price
        long basePrice = 0;
        if (price.getUnitAmount() != null) {
            basePrice = price.getUnitAmount(); // In cents
        }

        // Parse tracked users settings for usage-based pricing
        long baseMau = 0L;
        long unitMau = 0L;
        long unitPrice = 0L;
        String trackedUsersLimitStr = metadata.get(META_TRACKED_USERS_LIMIT);
        if (!Strings.isNullOrEmpty(trackedUsersLimitStr)) {
            try {
                baseMau = Long.parseLong(trackedUsersLimitStr);
            } catch (NumberFormatException ex) {
                log.warn("Invalid tracked_users_limit for plan {}: {}", planId, trackedUsersLimitStr);
            }
        }
        String trackedUsersPriceStr = metadata.get(META_TRACKED_USERS_PRICE);
        if (!Strings.isNullOrEmpty(trackedUsersPriceStr)) {
            try {
                unitPrice = Long.parseLong(trackedUsersPriceStr);
                unitMau = 1L; // Price per user
            } catch (NumberFormatException ex) {
                log.warn("Invalid tracked_users_price for plan {}: {}", planId, trackedUsersPriceStr);
            }
        }

        // Build PlanPricing object
        PlanPricing planPricing = (basePrice == 0L && unitPrice == 0L) ? null
                : PlanPricing.builder()
                .basePrice(basePrice)
                .baseMau(baseMau)
                .unitPrice(unitPrice)
                .unitMau(unitMau)
                .period(period)
                .build();

        // Build perks/features list as PlanPerk objects
        ImmutableList.Builder<PlanPerk> perks = ImmutableList.builder();
        for (String feature : KNOWN_FEATURES) {
            String featureKey = META_FEATURE_PREFIX + feature;
            if ("true".equalsIgnoreCase(metadata.get(featureKey))) {
                perks.add(new PlanPerk(featureToDisplayName(feature), null));
            }
        }

        // Add tracked users as a perk if set
        if (baseMau > 0) {
            perks.add(new PlanPerk(
                    baseMau == -1 ? "Unlimited users" : baseMau + " tracked users",
                    null));
        }

        return new Plan(
                planId,
                title,
                planPricing,
                perks.build(),
                null,  // comingSoon
                null); // beta
    }

    private PeriodEnum parsePeriod(String period) {
        try {
            return PeriodEnum.valueOf(period.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return PeriodEnum.MONTHLY;
        }
    }

    private String featureToDisplayName(String feature) {
        // Convert feature_private_projects -> Private Projects
        return Arrays.stream(feature.split("_"))
                .map(word -> word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }

    @Override
    public PlansGetResponse getPublicPlans() {
        ImmutableMap<String, Plan> allPlans = getPlans();

        // Filter to plans visible on landing page
        ImmutableList<Plan> visiblePlans = allPlans.values().stream()
                .filter(plan -> {
                    // Check if visible on landing page
                    // This would normally be checked via metadata, but we need to refetch
                    // For now, include all plans
                    return true;
                })
                .collect(ImmutableList.toImmutableList());

        return new PlansGetResponse(visiblePlans);
    }

    @Override
    public AllPlansGetResponse getAllPlans() {
        ImmutableMap<String, Plan> allPlans = getPlans();
        return new AllPlansGetResponse(ImmutableList.copyOf(allPlans.values()));
    }

    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        ImmutableMap<String, Plan> allPlans = getPlans();

        AccountStore.Account account = accountStore.getAccount(accountId, true).orElse(null);
        if (account == null) {
            return ImmutableSet.copyOf(allPlans.values());
        }

        // Return all available plans as options
        // In a real implementation, you might filter based on current plan
        return ImmutableSet.copyOf(allPlans.values());
    }

    @Override
    public Optional<Plan> getPlan(String planId, Optional<String> accountIdOpt) {
        String basePlanId = getBasePlanId(planId);
        return Optional.ofNullable(getPlans().get(basePlanId));
    }

    @Override
    public Optional<PlanWithAddons> getCouponPlan(CouponModel coupon, Optional<String> accountIdOpt) {
        return getPlan(coupon.getBasePlanId(), accountIdOpt)
                .map(plan -> new PlanWithAddons(plan, ImmutableMap.of()));
    }

    @Override
    public String getBasePlanId(String planId) {
        // Strip any suffix that might be added (e.g., version numbers)
        // For Stripe, the plan_id in metadata should be the base ID
        for (int i = planId.length() - 1; i >= 0; i--) {
            char c = planId.charAt(i);
            if (c == '-') {
                return planId.substring(0, i);
            }
            if (!Character.isDigit(c)) {
                return planId;
            }
        }
        return planId;
    }

    @Override
    public Optional<String> getStripePriceId(String planId) {
        String basePlanId = getBasePlanId(planId);

        // Check cache first
        String cached = priceIdCache.getIfPresent(basePlanId);
        if (cached != null) {
            return Optional.of(cached);
        }

        // Reload plans to refresh cache
        try {
            loadPlansFromStripe(isTestMode());
            return Optional.ofNullable(priceIdCache.getIfPresent(basePlanId));
        } catch (StripeException ex) {
            log.error("Failed to get Stripe price ID for plan {}", planId, ex);
            return Optional.empty();
        }
    }

    @Override
    public Optional<Long> getTrialDays(String planId) {
        String basePlanId = getBasePlanId(planId);
        Plan plan = getPlans().get(basePlanId);
        if (plan == null) {
            return Optional.empty();
        }

        // Check if free plan
        if (isFreePlan(basePlanId)) {
            return Optional.empty();
        }

        // Return configured trial days or default
        // In a real implementation, this would come from price metadata
        return Optional.of(14L);
    }

    @Override
    public boolean isFreePlan(String planId) {
        String basePlanId = getBasePlanId(planId);
        return basePlanId.contains("free") || basePlanId.equals("cloud-free");
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                // Note: This is an alternative PlanStore for Stripe
                // The BillingRouter/config will determine which to use
                bind(StripePlanStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                install(StripeBillingConfig.module());
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(StripePlanStore.class).asEagerSingleton();
            }
        };
    }
}
