// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
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
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AllPlansGetResponse;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPerk;
import com.smotana.clearflask.api.model.PlanPricing;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.stripe.exception.StripeException;
import com.stripe.model.Price;
import com.stripe.model.Product;
import com.stripe.param.PriceListParams;
import com.stripe.param.ProductListParams;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * PlanStore backed by Stripe Products and Prices. Plans surface to the public pricing page
 * and to the in-app plan-switcher come from Stripe; metadata (titles, perks) is read from
 * Stripe Product fields with sensible code fallbacks if the Stripe metadata is missing or
 * incomplete.
 *
 * <p>Caching: 5-minute TTL on the entire plan list so the public pricing page doesn't hit
 * Stripe on every request. Provisioner runs are infrequent so this TTL is acceptable.
 *
 * <p>Coupons remain a clearflask-internal mechanism via {@link CouponStore} (driven by the
 * grandfathered/lifetime plan ecosystem). They are not Stripe Coupons.
 */
@Slf4j
@Singleton
public class StripePlanStore extends ManagedService implements PlanStore {

    public interface Config {
        @DefaultValue("PT5M")
        Duration cacheTtl();
    }

    /**
     * Code-side fallback titles when the Stripe Product is missing a name. Should rarely fire
     * — provisioner sets product.name from PLAN_SPECS.
     */
    private static final ImmutableMap<String, String> FALLBACK_TITLES = ImmutableMap.<String, String>builder()
            .put("cloud-starter-monthly", "Cloud Starter")
            .put("cloud-monthly2", "Cloud")
            .put("cloud-yearly", "Cloud Pro")
            .put("selfhost-monthly2", "Self-host License")
            .put("selfhost-yearly2", "Self-host Yearly")
            .put("flat-yearly", "Business")
            .put("sponsor-monthly", "Sponsor")
            .build();

    /**
     * Code-side fallback perks when Stripe Product has no marketing_features set. Provisioner
     * sets these from PLAN_SPECS as Entitlement features, but marketing_features (which drive
     * Checkout/Portal display) need a separate provisioning pass — until then these are used.
     */
    private static final ImmutableMap<String, ImmutableList<PlanPerk>> FALLBACK_PERKS = ImmutableMap.<String, ImmutableList<PlanPerk>>builder()
            .put("cloud-starter-monthly", ImmutableList.of(
                    new PlanPerk("Custom domain", null),
                    new PlanPerk("Feedback, Roadmap, Announcements", null)))
            .put("cloud-monthly2", ImmutableList.of(
                    new PlanPerk("All features", null),
                    new PlanPerk("Unlimited teammates", null),
                    new PlanPerk("Unlimited posts", null)))
            .put("cloud-yearly", ImmutableList.of(
                    new PlanPerk("Unlimited Teammates", null),
                    new PlanPerk("Integrations", null),
                    new PlanPerk("API", null),
                    new PlanPerk("Whitelabel", null)))
            .put("selfhost-monthly2", ImmutableList.of(
                    new PlanPerk("Self-host license", null),
                    new PlanPerk("All features", null)))
            .put("selfhost-yearly2", ImmutableList.of(
                    new PlanPerk("Self-host yearly license", null),
                    new PlanPerk("All features", null)))
            .put("flat-yearly", ImmutableList.of(
                    new PlanPerk("Custom yearly pricing", null),
                    new PlanPerk("All features", null),
                    new PlanPerk("Whitelabel", null)))
            .put("sponsor-monthly", ImmutableList.of(
                    new PlanPerk("Choose your monthly amount", null),
                    new PlanPerk("Whitelabel", null)))
            .build();

    @Inject
    private Config config;
    @Inject
    private com.google.inject.Provider<com.smotana.clearflask.store.AccountStore> accountStoreProvider;

    private Cache<String, ImmutableList<Plan>> plansCache;

    @Override
    protected void serviceStart() {
        plansCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.cacheTtl())
                .maximumSize(8)
                .build();
    }

    private ImmutableList<Plan> loadPlans() {
        ImmutableList<Plan> cached = plansCache.getIfPresent("ALL");
        if (cached != null) {
            return cached;
        }
        ImmutableList<Plan> result = loadPlansFromStripe();
        plansCache.put("ALL", result);
        return result;
    }

    private ImmutableList<Plan> loadPlansFromStripe() {
        try {
            // Index Products by metadata.clearflask_plan_id
            Map<String, Product> productByPlanId = new HashMap<>();
            ProductListParams pParams = ProductListParams.builder().setActive(true).setLimit(100L).build();
            for (Product p : Product.list(pParams).autoPagingIterable()) {
                if (p.getMetadata() == null) continue;
                String planId = p.getMetadata().get(StripeBilling.META_CLEARFLASK_PLAN_ID);
                if (!Strings.isNullOrEmpty(planId)) {
                    productByPlanId.put(planId, p);
                }
            }
            // Index default Prices by metadata.clearflask_plan_id (skipping per-customer one-offs)
            Map<String, Price> priceByPlanId = new HashMap<>();
            PriceListParams prParams = PriceListParams.builder().setActive(true).setLimit(100L).build();
            for (Price price : Price.list(prParams).autoPagingIterable()) {
                if (price.getMetadata() == null) continue;
                String planId = price.getMetadata().get(StripeBilling.META_CLEARFLASK_PLAN_ID);
                String oneOff = price.getMetadata().get(StripeBilling.META_ONE_OFF_FOR_ACCOUNT);
                if (!Strings.isNullOrEmpty(planId) && Strings.isNullOrEmpty(oneOff)) {
                    priceByPlanId.put(planId, price);
                }
            }

            ImmutableList.Builder<Plan> plans = ImmutableList.builder();
            for (Map.Entry<String, Product> entry : productByPlanId.entrySet()) {
                String planId = entry.getKey();
                Product product = entry.getValue();
                Price price = priceByPlanId.get(planId);
                plans.add(buildPlan(planId, product, price));
            }
            return plans.build();
        } catch (StripeException ex) {
            log.warn("Stripe: failed to load plan list", ex);
            return ImmutableList.of();
        }
    }

    private Plan buildPlan(String planId, Product product, Price price) {
        String title = product != null && !Strings.isNullOrEmpty(product.getName())
                ? product.getName()
                : FALLBACK_TITLES.getOrDefault(planId, planId);

        ImmutableList<PlanPerk> perks = readMarketingFeatures(product);
        if (perks.isEmpty()) {
            perks = FALLBACK_PERKS.getOrDefault(planId, ImmutableList.of());
        }

        PlanPricing pricing = price == null ? null : buildPricing(price);

        return new Plan(planId, title, pricing, perks, /* comingSoon */ null, /* beta */ null);
    }

    private ImmutableList<PlanPerk> readMarketingFeatures(Product product) {
        if (product == null || product.getMarketingFeatures() == null) {
            return ImmutableList.of();
        }
        ImmutableList.Builder<PlanPerk> b = ImmutableList.builder();
        for (Product.MarketingFeature mf : product.getMarketingFeatures()) {
            if (Strings.isNullOrEmpty(mf.getName())) continue;
            b.add(new PlanPerk(mf.getName(), null));
        }
        return b.build();
    }

    private PlanPricing buildPricing(Price price) {
        long unitAmountCents = price.getUnitAmount() == null ? 0L : price.getUnitAmount();
        long basePriceDollars = unitAmountCents / 100L;
        PlanPricing.PeriodEnum period = PlanPricing.PeriodEnum.MONTHLY;
        if (price.getRecurring() != null && price.getRecurring().getInterval() != null) {
            switch (price.getRecurring().getInterval()) {
                case "year": period = PlanPricing.PeriodEnum.YEARLY; break;
                case "month": period = PlanPricing.PeriodEnum.MONTHLY; break;
                default: break;
            }
        }
        return new PlanPricing(
                basePriceDollars,   // basePrice
                0L,                 // baseMau (not used in flat-fee plans)
                0L,                 // unitMau
                0L,                 // unitPrice
                null,               // admins (not used)
                period);
    }

    @Override
    public PlansGetResponse getPublicPlans() {
        // Only the actively-sellable plans show on the public pricing page; the same
        // PlanStore.AVAILABLE_PLAN_NAMES filter that KillBillPlanStore uses. Other Stripe
        // Products (sponsor-monthly, flat-yearly, etc.) are admin/internal-only and stay
        // hidden from /pricing.
        ImmutableList<Plan> publicPlans = loadPlans().stream()
                .filter(p -> PlanStore.AVAILABLE_PLAN_NAMES.contains(p.getBasePlanId()))
                .collect(ImmutableList.toImmutableList());
        // Comparison/features tables come from PlanConstants (extracted from KillBillPlanStore),
        // so /pricing renders the full Cloud + Self-host feature comparison without any KillBill
        // dependency. Previously these were empty here and PlanStoreRouter merged KillBill's in.
        return new PlansGetResponse(
                publicPlans,
                PlanConstants.FEATURES_TABLE,
                PlanConstants.FEATURES_TABLE_SELFHOST);
    }

    @Override
    public AllPlansGetResponse getAllPlans() {
        return new AllPlansGetResponse(loadPlans());
    }

    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        // Filter publicly-sellable plans to those compatible with the account's current plan
        // family (cloud accounts get cloud options; self-host accounts get self-host options).
        // Mirrors KillBillPlanStore.getAccountChangePlanOptions logic.
        com.smotana.clearflask.store.AccountStore.Account a = accountStoreProvider.get()
                .getAccount(accountId, true).orElse(null);
        String currentPlanId = a == null ? null : a.getPlanid();
        boolean selfhost = currentPlanId != null && PlanStore.SELFHOST_SERVICE_PLANS.contains(currentPlanId);

        return loadPlans().stream()
                .filter(p -> PlanStore.AVAILABLE_PLAN_NAMES.contains(p.getBasePlanId()))
                .filter(p -> {
                    boolean planIsSelfhost = PlanStore.SELFHOST_SERVICE_PLANS.contains(p.getBasePlanId());
                    return selfhost ? planIsSelfhost : !planIsSelfhost;
                })
                .collect(ImmutableSet.toImmutableSet());
    }

    @Override
    public Optional<Plan> getPlan(String planId, Optional<String> accountIdOpt) {
        return loadPlans().stream()
                .filter(p -> p.getBasePlanId().equals(planId))
                .findAny();
    }

    @Override
    public Optional<PlanWithAddons> getCouponPlan(CouponStore.CouponModel coupon, Optional<String> accountIdOpt) {
        return loadPlans().stream()
                .filter(p -> p.getBasePlanId().equals(coupon.getBasePlanId()))
                .map(p -> new PlanWithAddons(p, ImmutableMap.of()))
                .findAny();
    }

    @Override
    public String getBasePlanId(String planId) {
        return planId;
    }

    private FeaturesTable emptyFeaturesTable() {
        return new FeaturesTable(ImmutableList.of(), ImmutableList.of(), null);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripePlanStore.class).asEagerSingleton();
                bind(PlanStore.class).annotatedWith(Names.named("stripe")).to(StripePlanStore.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding()
                        .to(StripePlanStore.class).asEagerSingleton();
            }
        };
    }
}
