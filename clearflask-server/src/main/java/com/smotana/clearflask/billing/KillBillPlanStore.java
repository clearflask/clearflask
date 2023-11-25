// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Preconditions;
import com.google.common.base.Strings;
import com.google.common.collect.*;
import com.google.common.primitives.Longs;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.api.model.PlanPricing.PeriodEnum;
import com.smotana.clearflask.billing.CouponStore.CouponModel;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.catalog.api.BillingPeriod;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.model.Catalogs;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.client.model.gen.*;

import javax.annotation.Nullable;
import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class KillBillPlanStore extends ManagedService implements PlanStore {
    public static final String DEFAULT_UPGRADE_REQUIRED_PLAN = "standard3-monthly";
    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    private static final long STARTER_MAX_POSTS = 30L;
    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    private static final long GROWTH_MAX_TEAMMATES = 2L;
    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    private static final long STANDARD_MAX_TEAMMATES = 8L;
    /**
     * If changed, also change in BillingPage.tsx
     */
    private static final String ADDON_WHITELABEL = "whitelabel";
    /**
     * If changed, also change in BillingPage.tsx
     */
    private static final String ADDON_PRIVATE_PROJECTS = "private-projects";
    /**
     * If changed, also change in BillingPage.tsx
     */
    private static final String ADDON_EXTRA_PROJECT = "extra-project";
    private static final String TERMS_POSTS = "Keep your project tidy and delete old posts to stay within the limits.";
    private static final String TERMS_PROJECTS = "You can create separate projects each having their own set of users and content";
    private static final String TERMS_ADMINS = "Amount of administrators, product managers or support team members you can have on each project including yourself.";
    private static final String TERMS_CREDIT_SYSTEM = "Credit System allows fine-grained prioritization of value for each idea.";
    private static final String TERMS_PRIVATE_PROJECTS = "Create a private project so only authorized users can view and provide feedback";
    private static final String TERMS_SSO_AND_OAUTH = "Use your existing user accounts to log into ClearFlask with Single Sign-On or external OAuth provider such as Google, Github or Facebook";
    private static final String TERMS_SITE_TEMPLATE = "Use your own HTML template to display parts of the site";
    private static final String TERMS_TRACKING = "Include Google Analytics or Hotjar on every page";
    private static final String TERMS_API = "Integrate with any external service via our API and webhooks";
    private static final String TERMS_GITHUB = "Synchronize GitHub issues with ClearFlask";
    private static final String TERMS_INTERCOM = "Add Intercom widget on every page";
    private static final String TERMS_BILLING = "Custom billing and invoicing";
    private static final String TERMS_WHITELABEL = "Remove ClearFlask branding";
    private static final String TERMS_ELASTICSEARCH = "Search powered by ElasticSearch for fast and accurate search capability";
    private static final ImmutableSet<String> AVAILABLE_PLAN_NAMES = ImmutableSet.of(
            "standard3-monthly",
            "lifetime-lifetime");
    private static final ImmutableMap<String, Function<PlanPricing, Plan>> PLANS_BUILDER = ImmutableMap.<String, Function<PlanPricing, Plan>>builder()
            // Deprecated plan with unlimited trial up to 10 MAU
            .put("growth-monthly", pp -> new Plan("growth-monthly", "Growth",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Announcements", null)),
                    null, null))
            // Deprecated plan with unlimited trial up to 10 MAU
            .put("standard-monthly", pp -> new Plan("standard-monthly", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("SSO and OAuth", TERMS_SSO_AND_OAUTH),
                    new PlanPerk("Site template", TERMS_SITE_TEMPLATE)),
                    null, null))
            .put("starter-unlimited", pp -> new Plan("starter-unlimited", "Starter",
                    pp, ImmutableList.of(
                    new PlanPerk(STARTER_MAX_POSTS + " ideas", TERMS_POSTS),
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Unlimited users", null)),
                    null, null))
            .put("growth2-monthly", pp -> new Plan("growth2-monthly", "Growth",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited ideas", null),
                    new PlanPerk(GROWTH_MAX_TEAMMATES + " Teammates", TERMS_ADMINS),
                    new PlanPerk("Scalable pricing", null)),
                    null, null))
            .put("standard2-monthly", pp -> new Plan("standard2-monthly", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk(STANDARD_MAX_TEAMMATES + " Teammates", TERMS_ADMINS),
                    new PlanPerk("Integrations & API", null),
                    new PlanPerk("SSO and OAuth", TERMS_SSO_AND_OAUTH)),
                    null, null))
            // Available only on external marketplace via coupons
            .put("pro-lifetime", pp -> new Plan("pro-lifetime", "Pro",
                    pp, ImmutableList.of(
                    new PlanPerk("Lifetime deal", null),
                    new PlanPerk("Unlimited users", null),
                    new PlanPerk("1 Teammate", TERMS_ADMINS),
                    new PlanPerk("1 Project", TERMS_PROJECTS)),
                    null, null))
            .put("pitchground-a-lifetime", pp -> new Plan("pitchground-a-lifetime", "PitchGround A",
                    pp, ImmutableList.of(
                    new PlanPerk("Lifetime deal", null),
                    new PlanPerk("50 tracked users", null),
                    new PlanPerk("1 Teammate", TERMS_ADMINS),
                    new PlanPerk("1 Project", TERMS_PROJECTS),
                    new PlanPerk("Feedback", null),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Announcements", null),
                    new PlanPerk("Custom domain", null)),
                    null, null))
            .put("pitchground-b-lifetime", pp -> new Plan("pitchground-b-lifetime", "PitchGround B",
                    pp, ImmutableList.of(
                    new PlanPerk("Lifetime deal", null),
                    new PlanPerk("500 tracked users", null),
                    new PlanPerk("3 Teammates", TERMS_ADMINS),
                    new PlanPerk("1 Project", TERMS_PROJECTS),
                    new PlanPerk("Feedback", null),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Announcements", null),
                    new PlanPerk("Custom domain", null)),
                    null, null))
            .put("pitchground-c-lifetime", pp -> new Plan("pitchground-c-lifetime", "PitchGround C",
                    pp, ImmutableList.of(
                    new PlanPerk("Lifetime deal", null),
                    new PlanPerk("Unlimited users", null),
                    new PlanPerk("5 Teammates", TERMS_ADMINS),
                    new PlanPerk("5 Projects", TERMS_PROJECTS),
                    new PlanPerk("Feedback", null),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Announcements", null),
                    new PlanPerk("Custom domain", null),
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("SSO and OAuth", TERMS_SSO_AND_OAUTH),
                    new PlanPerk("API", TERMS_API),
                    new PlanPerk("All integrations", null)),
                    null, null))
            .put("pitchground-d-lifetime", pp -> new Plan("pitchground-d-lifetime", "PitchGround D",
                    pp, ImmutableList.of(
                    new PlanPerk("Lifetime deal", null),
                    new PlanPerk("Unlimited users", null),
                    new PlanPerk("10 Teammates", TERMS_ADMINS),
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Feedback", null),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Announcements", null),
                    new PlanPerk("Custom domain", null),
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("SSO and OAuth", TERMS_SSO_AND_OAUTH),
                    new PlanPerk("API", TERMS_API),
                    new PlanPerk("All integrations", null)),
                    null, null))
            .put("pitchground-e-lifetime", pp -> new Plan("pitchground-e-lifetime", "PitchGround E",
                    pp, ImmutableList.of(
                    new PlanPerk("Lifetime deal", null),
                    new PlanPerk("Unlimited users", null),
                    new PlanPerk("25 Teammates", TERMS_ADMINS),
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Feedback", null),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Announcements", null),
                    new PlanPerk("Custom domain", null),
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("SSO and OAuth", TERMS_SSO_AND_OAUTH),
                    new PlanPerk("API", TERMS_API),
                    new PlanPerk("All integrations", null),
                    new PlanPerk("Whitelabel", TERMS_WHITELABEL)),
                    null, null))
            .put("starter3-monthly", pp -> new Plan("starter3-monthly", "Starter",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Unlimited teammates", null),
                    new PlanPerk("Unlimited users", null)),
                    null, null))
            .put("standard-unlimited", pp -> new Plan("standard-unlimited", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Unlimited teammates", TERMS_ADMINS),
                    new PlanPerk("Unlimited users", null)),
                    null, null))
            .put("standard2-unlimited", pp -> new Plan("standard2-unlimited", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Unlimited users", null),
                    new PlanPerk("3 teammates", null)),
                    null, null))
            .put("sponsor-monthly", pp -> new Plan("sponsor-monthly", "Sponsor",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited teammates", null),
                    new PlanPerk("Private projects", null),
                    new PlanPerk("Whitelabel", null)),
                    null, null))
            .put("standard3-monthly", pp -> new Plan("standard3-monthly", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("All features", null)),
                    null, null))
            .put("lifetime-lifetime", pp -> new Plan("lifetime-lifetime", "Lifetime",
                    pp, ImmutableList.of(
                    new PlanPerk("All features", null)),
                    null, null))
            .build();
    private static final ImmutableList<Plan> PLANS_STATIC = ImmutableList.of(
            new Plan("flat-yearly", "Business",
                    null, ImmutableList.of(
                    new PlanPerk("Whitelabel", null),
                    new PlanPerk("Support & SLA", null)),
                    null, null),
            new Plan(TEAMMATE_PLAN_ID, "Teammate",
                    null, ImmutableList.of(
                    new PlanPerk("External projects", null),
                    new PlanPerk("No billing", null)),
                    null, null)
    );
    private static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Self-host", "Standard", "Lifetime"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Projects", ImmutableList.of("No limit", "No limit", "No limit"), TERMS_PROJECTS),
                    new FeaturesTableFeatures("Users", ImmutableList.of("No limit", "No limit", "No limit"), null),
                    new FeaturesTableFeatures("Posts", ImmutableList.of("No limit", "No limit", "No limit"), TERMS_POSTS),
                    new FeaturesTableFeatures("Teammates", ImmutableList.of("No limit", "No limit", "No limit"), TERMS_ADMINS),
                    new FeaturesTableFeatures("Credit System", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_CREDIT_SYSTEM),
                    new FeaturesTableFeatures("Roadmap", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Content customization", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Custom domain", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Private projects", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_PRIVATE_PROJECTS),
                    new FeaturesTableFeatures("SSO and OAuth", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_SSO_AND_OAUTH),
                    new FeaturesTableFeatures("API", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_API),
                    new FeaturesTableFeatures("GitHub integration", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_GITHUB),
                    new FeaturesTableFeatures("Intercom integration", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_INTERCOM),
                    new FeaturesTableFeatures("Tracking integrations", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_TRACKING),
                    new FeaturesTableFeatures("Site template", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_SITE_TEMPLATE),
                    new FeaturesTableFeatures("Whitelabel", ImmutableList.of("No", "Yes", "Yes"), TERMS_WHITELABEL),
                    // new FeaturesTableFeatures("Search engine", ImmutableList.of("Yes", "No", "No"), TERMS_ELASTICSEARCH),
                    new FeaturesTableFeatures("Priority support", ImmutableList.of("No", "Yes", "Yes"), null)
            ), null);

    @Inject
    private Billing billing;
    @Inject
    private CatalogApi catalogApi;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;

    private ImmutableMap<String, Plan> allPlans;
    private ImmutableMap<String, Plan> availablePlans;
    private PlansGetResponse plansGetResponse;
    private AllPlansGetResponse allPlansGetResponse;

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(KillBillSync.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        Catalogs catalogs = catalogApi.getCatalogJson(null, null, KillBillUtil.roDefault());
        ImmutableList<Plan> plans = PLANS_BUILDER.entrySet().stream().map(e -> {
            // Oh god this is just terrible, this is what happens when you check in at 4am
            String planName = e.getKey();
            org.killbill.billing.client.model.gen.Plan plan = catalogs
                    .stream()
                    .sorted(Comparator.comparing(Catalog::getEffectiveDate).reversed())
                    .flatMap(c -> c.getProducts().stream())
                    .flatMap(p -> p.getPlans().stream())
                    .filter(p -> planName.equals(p.getName()))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Plan not found in catalog:" + e.getKey()));
            Optional<Phase> evergreenOpt = Stream.of(plan)
                    .flatMap(p -> p.getPhases().stream())
                    .filter(p -> PhaseType.EVERGREEN.name().equals(p.getType()))
                    .findAny();
            long basePrice = evergreenOpt.stream()
                    // Regular pricing
                    .flatMap(p -> p.getPrices().stream())
                    .map(Price::getValue)
                    .map(BigDecimal::longValueExact)
                    .max(Long::compareTo)
                    // Fixed pricing
                    .or(() -> evergreenOpt.stream()
                            .flatMap(p -> p.getFixedPrices().stream())
                            .map(Price::getValue)
                            .map(BigDecimal::longValueExact)
                            .max(Long::compareTo))
                    .orElse(0L);
            Optional<Usage> usageOpt = evergreenOpt.stream()
                    .flatMap(p -> p.getUsages().stream())
                    .findFirst();
            PeriodEnum period;
            if (BillingPeriod.MONTHLY.equals(plan.getBillingPeriod())) {
                period = PeriodEnum.MONTHLY;
            } else if (BillingPeriod.ANNUAL.equals(plan.getBillingPeriod())) {
                period = PeriodEnum.YEARLY;
            } else if (BillingPeriod.QUARTERLY.equals(plan.getBillingPeriod())) {
                period = PeriodEnum.QUARTERLY;
            } else if (BillingPeriod.NO_BILLING_PERIOD.equals(plan.getBillingPeriod())) {
                period = PeriodEnum.LIFETIME;
            } else {
                log.error("Unknown billing period {} for plan {}, defaulting to yearly", plan.getBillingPeriod(), plan.getPrettyName());
                period = PeriodEnum.YEARLY;
            }
            long baseMau = 0L;
            long unitPrice = 0L;
            long unitMau = 0L;
            Optional<PlanPricingAdmins> adminsOpt = Optional.empty();
            if (usageOpt.stream()
                    .flatMap(usage -> usage.getTiers().stream())
                    .flatMap(tier -> tier.getBlocks().stream())
                    .anyMatch(block -> KillBilling.TRACKED_TEAMMATE_UNIT_NAME.equals(block.getUnit()))) {
                adminsOpt = Optional.of(new PlanPricingAdmins(
                        usageOpt.stream()
                                .flatMap(usage -> usage.getTiers().stream())
                                .flatMap(tier -> tier.getBlocks().stream())
                                .filter(block -> KillBilling.TRACKED_TEAMMATE_UNIT_NAME.equals(block.getUnit()))
                                .findFirst()
                                .map(TieredBlock::getMax)
                                .map(Double::valueOf)
                                .map(Double::longValue)
                                .orElseThrow(),
                        usageOpt.stream()
                                .flatMap(usage -> usage.getTiers().stream())
                                .flatMap(tier -> tier.getBlocks().stream())
                                .filter(block -> KillBilling.TRACKED_TEAMMATE_UNIT_NAME.equals(block.getUnit()))
                                .skip(1)
                                .flatMap(block -> block.getPrices().stream())
                                .findFirst()
                                .map(Price::getValue)
                                .map(BigDecimal::longValueExact)
                                .orElseThrow()));
            } else if (usageOpt.stream()
                    .flatMap(usage -> usage.getTiers().stream())
                    .flatMap(tier -> tier.getBlocks().stream())
                    .anyMatch(block -> KillBilling.TRACKED_USER_UNIT_NAME.equals(block.getUnit()))) {
                baseMau = usageOpt.stream()
                        .flatMap(usage -> usage.getTiers().stream())
                        .flatMap(tier -> tier.getBlocks().stream())
                        .filter(block -> KillBilling.TRACKED_USER_UNIT_NAME.equals(block.getUnit()))
                        .findFirst()
                        .map(TieredBlock::getSize)
                        .map(Double::valueOf)
                        .map(Double::longValue)
                        .orElse(0L);
                unitPrice = usageOpt.stream()
                        .flatMap(usage -> usage.getTiers().stream())
                        .flatMap(tier -> tier.getBlocks().stream())
                        .filter(block -> KillBilling.TRACKED_USER_UNIT_NAME.equals(block.getUnit()))
                        .skip(1)
                        .flatMap(block -> block.getPrices().stream())
                        .findFirst()
                        .map(Price::getValue)
                        .map(BigDecimal::longValueExact)
                        .orElse(0L);
                unitMau = usageOpt.stream()
                        .flatMap(usage -> usage.getTiers().stream())
                        .skip(1)
                        .flatMap(tier -> tier.getBlocks().stream())
                        .findFirst()
                        .map(TieredBlock::getSize)
                        .map(Double::valueOf)
                        .map(Double::longValue)
                        .orElse(0L);
            }
            PlanPricing planPricing = (basePrice == 0L && unitPrice == 0L) ? null
                    : PlanPricing.builder()
                    .basePrice(basePrice)
                    .baseMau(baseMau)
                    .unitPrice(unitPrice)
                    .unitMau(unitMau)
                    .period(period)
                    .admins(adminsOpt.orElse(null))
                    .build();
            return e.getValue().apply(planPricing);
        }).collect(ImmutableList.toImmutableList());
        allPlans = Stream.concat(plans.stream(), PLANS_STATIC.stream())
                .collect(ImmutableMap.toImmutableMap(
                        Plan::getBasePlanId,
                        p -> p));
        availablePlans = allPlans.entrySet().stream()
                .filter(e -> AVAILABLE_PLAN_NAMES.contains(e.getValue().getBasePlanId()))
                .collect(ImmutableMap.toImmutableMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue));
        Preconditions.checkState(allPlans.keySet().stream().noneMatch(p -> p.matches(".*-[0-9]]+")),
                "Plans cannot end in a number, plans with price overrides end in a number");
        plansGetResponse = new PlansGetResponse(
                availablePlans.values().asList(),
                FEATURES_TABLE);
        allPlansGetResponse = new AllPlansGetResponse(
                allPlans.values().asList());
    }

    @Extern
    @Override
    public PlansGetResponse getPublicPlans() {
        return plansGetResponse;
    }

    @Extern
    @Override
    public AllPlansGetResponse getAllPlans() {
        return allPlansGetResponse;
    }

    @Extern
    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        Subscription subscription = billing.getSubscription(accountId);
        String planToChangeFrom = billing.getEndOfTermChangeToPlanId(subscription)
                .orElse(subscription.getPlanName());
        // Let's not pass account into getPlan, there is a weird situation where if you are changing plans at end of
        // term, the plan you are given is the final one, but the price is set as your current one leading to
        // non-sensical price.
        Plan currentPlan = getPlan(planToChangeFrom, Optional.empty()).get();
        Set<Plan> planOptions = Sets.newHashSet();
        switch (currentPlan.getBasePlanId()) {
            case "growth-monthly":
            case "growth2-monthly":
            case "starter3-monthly":
            case "standard-monthly":
            case "standard2-monthly":
            case "standard2-unlimited":
            case TEAMMATE_PLAN_ID:
            case "pro-lifetime":
            case "starter-unlimited":
            case "pitchground-a-lifetime":
            case "pitchground-b-lifetime":
            case "pitchground-c-lifetime":
            case "pitchground-d-lifetime":
            case "pitchground-e-lifetime":
            case "flat-yearly":
            case "standard-unlimited":
            case "sponsor-monthly":
                planOptions.add(availablePlans.get("standard3-monthly"));
                planOptions.add(availablePlans.get("lifetime-lifetime"));
                break;
            case "lifetime-lifetime":
                planOptions.add(availablePlans.get("standard3-monthly"));
                break;
            case "standard3-monthly":
                planOptions.add(availablePlans.get("lifetime-lifetime"));
                break;
            default:
                break;
        }
        planOptions.add(currentPlan);
        return ImmutableSet.copyOf(planOptions);
    }

    @Extern
    private Optional<Plan> getPlanExternOnly(String planId, @Nullable String accountIdOpt) {
        return getPlan(planId, Optional.ofNullable(Strings.emptyToNull(accountIdOpt)), Optional.empty())
                .map(PlanWithAddons::getPlan);
    }

    @Override
    public Optional<Plan> getPlan(String planId, Optional<String> accountIdOpt) {
        return getPlan(planId, accountIdOpt, Optional.empty())
                .map(PlanWithAddons::getPlan);
    }

    @Override
    public Optional<PlanWithAddons> getCouponPlan(CouponModel coupon, Optional<String> accountIdOpt) {
        return getPlan(coupon.getBasePlanId(), accountIdOpt, Optional.of(coupon));
    }

    private Optional<PlanWithAddons> getPlan(String planId, Optional<String> accountIdOpt, Optional<CouponModel> couponOpt) {
        String basePlanId = getBasePlanId(planId);
        Optional<Plan> planOpt = Optional.ofNullable(allPlans.get(basePlanId));

        Optional<Account> accountOpt = accountIdOpt.flatMap(accountId -> accountStore.getAccount(accountIdOpt.get(), true));
        boolean isStackingProPlan = couponOpt.isPresent()
                && "pro-lifetime".equals(planOpt.map(Plan::getBasePlanId).orElse(null))
                && "pro-lifetime".equals(accountOpt.map(Account::getPlanid).orElse(null));

        ImmutableMap<String, String> addons = ImmutableMap.of();
        if (planOpt.isPresent() && accountOpt.isPresent()) {
            boolean isPlanChanging = couponOpt.isPresent() && !isStackingProPlan;

            if (!isPlanChanging) {
                // Update with actual plan price from killbill for given account
                Subscription subscription = billing.getSubscription(accountOpt.get().getAccountId());
                Optional<Long> recurringPrice = Stream.of(subscription.getPriceOverrides(), subscription.getPrices())
                        .filter(Objects::nonNull)
                        .flatMap(List::stream)
                        .filter(phasePrice -> subscription.getPlanName().equals(phasePrice.getPlanName()))
                        .filter(phasePrice -> (subscription.getPhaseType() == PhaseType.TRIAL
                                // For trial phase, show the price of evergreen
                                // For any other phase, find the specific price of that phase
                                ? PhaseType.EVERGREEN : subscription.getPhaseType())
                                .name().equals(phasePrice.getPhaseType()))
                        .findFirst()
                        .map(PhasePrice::getRecurringPrice)
                        .map(BigDecimal::longValueExact);
                if (recurringPrice.isPresent()) {
                    planOpt = planOpt.map(plan -> plan.toBuilder()
                            .pricing(new PlanPricing(
                                    recurringPrice.get(),
                                    0L,
                                    0L,
                                    0L,
                                    plan.getPricing().getAdmins(),
                                    billingPeriodToPeriodEnum(subscription.getBillingPeriod())))
                            .build());
                }

                // Update plan perks with account addons
                addons = accountOpt.get().getAddons() == null
                        ? ImmutableMap.of()
                        : accountOpt.get().getAddons();

                // Apply Pro plan stacking
                if (isStackingProPlan) {
                    HashMap<String, String> addonsNew = Maps.newHashMap(addons);
                    addonsNew.compute(ADDON_EXTRA_PROJECT, (k, v) -> String.valueOf(Optional.ofNullable(v)
                            .flatMap(extraProjectCountStr -> Optional.ofNullable(Longs.tryParse(extraProjectCountStr)))
                            .orElse(0L) + 1L));
                    addons = ImmutableMap.copyOf(addonsNew);
                }

                ImmutableList<PlanPerk> addonPerks = addons.entrySet().stream()
                        .flatMap(e -> getAddonAsPlanPerk(e.getKey(), e.getValue()).stream())
                        .collect(ImmutableList.toImmutableList());
                if (!addonPerks.isEmpty()) {
                    planOpt = planOpt.map(plan -> plan.toBuilder()
                            .perks(ImmutableList.<PlanPerk>builder()
                                    .addAll(plan.getPerks())
                                    .addAll(addonPerks)
                                    .build())
                            .build());
                }
            }
        }
        return planOpt.isPresent()
                ? Optional.of(new PlanWithAddons(planOpt.get(), addons))
                : Optional.empty();
    }


    private Optional<PlanPerk> getAddonAsPlanPerk(String addonId, String value) {
        if (Strings.isNullOrEmpty(value)
                || "false".equals(value)
                || "0".equals(value)) {
            return Optional.empty();
        }
        switch (addonId) {
            case ADDON_WHITELABEL:
                return Optional.of(new PlanPerk("Whitelabel", TERMS_WHITELABEL));
            case ADDON_PRIVATE_PROJECTS:
                return Optional.of(new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS));
            case ADDON_EXTRA_PROJECT:
                long projectCount = Optional.ofNullable(Longs.tryParse(value)).orElse(0L);
                boolean isMultiple = projectCount > 1;
                return Optional.of(new PlanPerk(
                        isMultiple ? "Extra " + projectCount + " projects" : "Extra project",
                        "In addition to your plan limits, you can create "
                                + (isMultiple ? projectCount + " additional projects" : "one additional project")));
            default:
                return Optional.empty();
        }
    }

    /**
     * When adding price overrides, KillBill creates a new plan with a number suffix "-XXX".
     *
     * @return plan id without suffix
     */
    @Override
    public String getBasePlanId(String planId) {
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
    public String prettifyPlanName(String planIdOrPrettyPlanName) {
        if (planIdOrPrettyPlanName.contains("-")) {
            // Most likely this is not a pretty plan name, just a plan id
            return getPlan(planIdOrPrettyPlanName, Optional.empty())
                    .map(Plan::getTitle)
                    .map(name -> name + " Plan")
                    .orElse(planIdOrPrettyPlanName);
        }
        return planIdOrPrettyPlanName;
    }

    @Override
    public void verifyAccountMeetsPlanRestrictions(String planId, String accountId) throws ApiException {
        Account account = accountStore.getAccount(accountId, true).get();
        account.getProjectIds().stream()
                .map(projectId -> projectStore.getProject(projectId, true))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .forEach(project -> {
                    verifyConfigMeetsPlanRestrictions(planId, accountId, project.getVersionedConfigAdmin().getConfig());
                    verifyTeammateInviteMeetsPlanRestrictions(planId, project.getProjectId(), false);
                });

        verifyAccountMeetsLimits(planId, accountId);

        verifyProjectCountMeetsPlanRestrictions(planId, accountId, false);

        if (!Strings.isNullOrEmpty(account.getApiKey())) {
            verifyActionMeetsPlanRestrictions(planId, accountId, Action.API_KEY);
        }
    }

    @Override
    public void verifyAccountMeetsLimits(String planId, String accountId) throws ApiException {
        if (isAccountExceedsPostLimit(planId, accountId)) {
            throw new RequiresUpgradeException("Maximum number of posts reached, please delete old ones");
        }
    }

    @Override
    public boolean isAccountExceedsPostLimit(String planId, String accountId) {
        OptionalLong maxPostsOpt = OptionalLong.empty();
        switch (planId) {
            case "starter-unlimited":
                maxPostsOpt = OptionalLong.of(STARTER_MAX_POSTS);
            default:
                // No limit
        }
        if (maxPostsOpt.isPresent()
                && accountStore.getPostCountForAccount(accountId) > maxPostsOpt.getAsLong()) {
            return true;
        }
        return false;
    }

    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    @Override
    public void verifyActionMeetsPlanRestrictions(String planId, String accountId, Action action) throws RequiresUpgradeException {
        Account account = accountStore.getAccount(accountId, true).get();

        if (Action.CREATE_PROJECT.equals(action)) {
            verifyProjectCountMeetsPlanRestrictions(planId, accountId, true);
        }

        switch (getBasePlanId(planId)) {
            case TEAMMATE_PLAN_ID:
                switch (action) {
                    case CREATE_PROJECT:
                        throw new RequiresUpgradeException("Not allowed to create projects without a plan");
                    case API_KEY:
                        throw new RequiresUpgradeException("Not allowed to use API without a plan");
                }
                return;
            case "starter-unlimited":
            case "starter3-monthly":
            case "growth-monthly":
            case "growth2-monthly":
            case "pitchground-a-lifetime":
            case "pitchground-b-lifetime":
                switch (action) {
                    case API_KEY:
                        throw new RequiresUpgradeException("Not allowed to use API on your plan");
                }
                return;
            default:
                // No restriction
        }
    }

    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    @Override
    public void verifyConfigMeetsPlanRestrictions(String planId, String accountId, ConfigAdmin config) throws RequiresUpgradeException {
        ImmutableMap<String, String> addons = accountStore.getAccount(accountId, true)
                .map(Account::getAddons)
                .orElse(ImmutableMap.of());
        boolean hasAddonWhitelabel = "true".equals(addons.get(ADDON_WHITELABEL));
        boolean hasAddonPrivateProjects = "true".equals(addons.get(ADDON_PRIVATE_PROJECTS));

        switch (getBasePlanId(planId)) {
            case TEAMMATE_PLAN_ID:
                throw new RequiresUpgradeException("Not allowed to have projects without a plan");
            case "starter-unlimited":
            case "starter3-monthly":
            case "growth-monthly":
            case "growth2-monthly":
            case "pro-lifetime":
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to Whitelabel Powered By on your plan");
                }
                // Restrict OAuth
                if (!config.getUsers().getOnboarding().getNotificationMethods().getOauth().isEmpty()) {
                    throw new RequiresUpgradeException("Not allowed to use OAuth on your plan");
                }
                // Restrict Single Sign-On
                if (config.getUsers().getOnboarding().getNotificationMethods().getSso() != null) {
                    throw new RequiresUpgradeException("Not allowed to use SSO on your plan");
                }
                // Restrict Private projects
                if (!hasAddonPrivateProjects && config.getUsers().getOnboarding().getVisibility() == Onboarding.VisibilityEnum.PRIVATE) {
                    throw new RequiresUpgradeException("Not allowed to use Private visibility on your plan");
                }
                // Restrict Site template
                if (config.getStyle().getTemplates() != null) {
                    throw new RequiresUpgradeException("Not allowed to use Templates on your plan");
                }
                // Restrict Integrations
                if (config.getGithub() != null) {
                    throw new RequiresUpgradeException("Not allowed to use GitHub integration on your plan");
                }
                if (config.getIntegrations().getGoogleAnalytics() != null) {
                    throw new RequiresUpgradeException("Not allowed to use Google Analytics integration on your plan");
                }
                if (config.getIntegrations().getHotjar() != null) {
                    throw new RequiresUpgradeException("Not allowed to use HotJar integration on your plan");
                }
                if (config.getIntegrations().getIntercom() != null) {
                    throw new RequiresUpgradeException("Not allowed to use Intercom integration on your plan");
                }
                // Restrict No Index
                if (config.getNoIndex() == Boolean.TRUE) {
                    throw new RequiresUpgradeException("Not allowed to disable Search Indexing on your plan");
                }
                return;
            case "pitchground-a-lifetime":
            case "pitchground-b-lifetime":
                // Restrict OAuth
                if (!config.getUsers().getOnboarding().getNotificationMethods().getOauth().isEmpty()) {
                    throw new RequiresUpgradeException("Not allowed to use OAuth on your plan");
                }
                // Restrict Single Sign-On
                if (config.getUsers().getOnboarding().getNotificationMethods().getSso() != null) {
                    throw new RequiresUpgradeException("Not allowed to use SSO on your plan");
                }
                // Restrict Private projects
                if (!hasAddonPrivateProjects && config.getUsers().getOnboarding().getVisibility() == Onboarding.VisibilityEnum.PRIVATE) {
                    throw new RequiresUpgradeException("Not allowed to use Private visibility on your plan");
                }
                // Restrict Site template
                if (config.getStyle().getTemplates() != null) {
                    throw new RequiresUpgradeException("Not allowed to use Templates on your plan");
                }
                // Restrict Integrations
                if (config.getGithub() != null) {
                    throw new RequiresUpgradeException("Not allowed to use GitHub integration on your plan");
                }
                if (config.getIntegrations().getGoogleAnalytics() != null) {
                    throw new RequiresUpgradeException("Not allowed to use Google Analytics integration on your plan");
                }
                if (config.getIntegrations().getHotjar() != null) {
                    throw new RequiresUpgradeException("Not allowed to use HotJar integration on your plan");
                }
                if (config.getIntegrations().getIntercom() != null) {
                    throw new RequiresUpgradeException("Not allowed to use Intercom integration on your plan");
                }
                // rollover to next case
            case "pitchground-c-lifetime":
            case "pitchground-d-lifetime":
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to Whitelabel Powered By on your plan");
                }
                // rollover to next case
            case "pitchground-e-lifetime":
                break;
            case "standard-monthly":
            case "standard2-monthly":
            case "standard-unlimited":
            case "flat-yearly":
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to Whitelabel Powered By on your plan");
                }
                break;
            case "standard2-unlimited":
                // Restrict Private projects
                if (!hasAddonPrivateProjects && config.getUsers().getOnboarding().getVisibility() == Onboarding.VisibilityEnum.PRIVATE) {
                    throw new RequiresUpgradeException("Not allowed to use Private visibility on your plan");
                }
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to Whitelabel Powered By on your plan");
                }
                break;
            case "sponsor-monthly":
            case "lifetime-lifetime":
            case "standard3-monthly":
                break;
        }
    }

    @Override
    public void verifyConfigChangeMeetsRestrictions(boolean isSuperAdmin, Optional<ConfigAdmin> configAdminPreviousOpt, ConfigAdmin configAdmin) throws ApiException {
        if (!isSuperAdmin && !configAdminPreviousOpt
                .flatMap(ca -> Optional.ofNullable(ca.getForceSearchEngine()))
                .equals(Optional.ofNullable(configAdmin.getForceSearchEngine()))) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to change search engine");
        }
    }

    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    @Override
    public void verifyTeammateInviteMeetsPlanRestrictions(String planId, String projectId, boolean addOne) throws ApiException {
        Optional<Long> teammateLimitOpt = Optional.empty();
        String requiredPlanId = DEFAULT_UPGRADE_REQUIRED_PLAN;
        switch (getBasePlanId(planId)) {
            case "starter-unlimited":
            case "pro-lifetime":
            case "pitchground-a-lifetime":
                teammateLimitOpt = Optional.of(1L);
                requiredPlanId = DEFAULT_UPGRADE_REQUIRED_PLAN;
                break;
            case "pitchground-b-lifetime":
                teammateLimitOpt = Optional.of(3L);
                requiredPlanId = DEFAULT_UPGRADE_REQUIRED_PLAN;
                break;
            case "pitchground-c-lifetime":
                teammateLimitOpt = Optional.of(5L);
                requiredPlanId = DEFAULT_UPGRADE_REQUIRED_PLAN;
                break;
            case "growth-monthly":
            case "growth2-monthly":
                teammateLimitOpt = Optional.of(GROWTH_MAX_TEAMMATES);
                requiredPlanId = DEFAULT_UPGRADE_REQUIRED_PLAN;
                break;
            case "standard-monthly":
            case "standard2-monthly":
                teammateLimitOpt = Optional.of(STANDARD_MAX_TEAMMATES);
                break;
            case "pitchground-d-lifetime":
                teammateLimitOpt = Optional.of(10L);
                break;
            case "pitchground-e-lifetime":
                teammateLimitOpt = Optional.of(25L);
                break;
            case "standard2-unlimited":
                teammateLimitOpt = Optional.of(3L);
                break;
            case "starter3-monthly":
            case "standard3-monthly":
            case "standard-unlimited":
            case "flat-yearly":
            case "sponsor-monthly":
            case "lifetime-lifetime":
                break; // No limit
            default:
                if (LogUtil.rateLimitAllowLog("killbillplanstore-teammates-unknown-limit")) {
                    log.warn("Plan {} has no defined teammate limit", getBasePlanId(planId));
                }
        }
        if (teammateLimitOpt.isPresent()) {
            if (teammateLimitOpt.get() <= 1L) {
                if (addOne || getCurrentTeammateCount(projectId) > 1L) {
                    throw new RequiresUpgradeException(requiredPlanId, "Your plan has reached the teammate limit");
                }
            } else {
                if ((getCurrentTeammateCount(projectId) + (addOne ? 1 : 0)) > teammateLimitOpt.get()) {
                    throw new RequiresUpgradeException(requiredPlanId, "Your plan has reached the teammate limit");
                }
            }
        }
    }

    private long getCurrentTeammateCount(String projectId) {
        long adminCount = projectStore.getProject(projectId, true).map(ProjectStore.Project::getModel)
                .map(ProjectStore.ProjectModel::getAdminsAccountIds)
                .map(AbstractCollection::size)
                .orElse(0);
        long pendingInvitationCount = projectStore.getInvitations(projectId)
                .stream()
                .filter(Predicate.not(ProjectStore.InvitationModel::isAccepted))
                .count();
        return pendingInvitationCount + adminCount;
    }

    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    @Override
    public void verifyProjectCountMeetsPlanRestrictions(String planId, String accountId, boolean addOne) throws ApiException {
        ImmutableMap<String, String> addons = accountStore.getAccount(accountId, true)
                .map(Account::getAddons)
                .orElse(ImmutableMap.of());

        Optional<Long> projectCountLimitOpt = Optional.empty();
        switch (getBasePlanId(planId)) {
            case "pro-lifetime":
            case "pitchground-a-lifetime":
            case "pitchground-b-lifetime":
                projectCountLimitOpt = Optional.of(1L);
                break;
            case "pitchground-c-lifetime":
                projectCountLimitOpt = Optional.of(5L);
                break;
            default:
                break;
        }

        // Project Addons
        long addonExtraProjectCount = Optional.ofNullable(addons.get(ADDON_EXTRA_PROJECT))
                .flatMap(addonExtraProjectCountStr -> Optional.ofNullable(Longs.tryParse(addonExtraProjectCountStr)))
                .orElse(0L);
        projectCountLimitOpt = projectCountLimitOpt.map(planLimit -> planLimit + addonExtraProjectCount);

        if (projectCountLimitOpt.isPresent()) {
            long projectCount = accountStore.getAccount(accountId, true).get()
                    .getProjectIds().size();
            if ((projectCount + (addOne ? 1 : 0)) > projectCountLimitOpt.get()) {
                throw new RequiresUpgradeException("Your plan has reached project limit");
            }
        }
    }

    private PeriodEnum billingPeriodToPeriodEnum(BillingPeriod billingPeriod) {
        switch (billingPeriod) {
            case MONTHLY:
                return PeriodEnum.MONTHLY;
            case QUARTERLY:
                return PeriodEnum.QUARTERLY;
            case ANNUAL:
                return PeriodEnum.YEARLY;
            default:
                throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Unexpected billing period");
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PlanStore.class).to(KillBillPlanStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(KillBillPlanStore.class).asEagerSingleton();
            }
        };
    }
}
