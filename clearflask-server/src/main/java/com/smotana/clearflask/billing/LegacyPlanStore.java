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
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPricing.PeriodEnum;
import com.smotana.clearflask.billing.CouponStore.CouponModel;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.catalog.api.BillingPeriod;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.model.gen.*;
import org.killbill.billing.client.model.gen.Subscription;

import javax.annotation.Nullable;
import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class LegacyPlanStore extends ManagedService implements PlanStore {
    /** @deprecated reference {@link PlanConstants#PLAN_MAX_POSTS} -- kept for source-compat until the KB removal commit. */
    @Deprecated
    public static final ImmutableMap<String, Long> PLAN_MAX_POSTS = PlanConstants.PLAN_MAX_POSTS;
    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    public static final long GROWTH_MAX_TEAMMATES = 2L;
    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    public static final long STANDARD_MAX_TEAMMATES = 8L;
    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    public static final long LIFETIME_MAX_TEAMMATES = 1L;
    /**
     * If changed, also change in BillingPage.tsx
     */
    public static final String ADDON_WHITELABEL = "whitelabel";
    /**
     * If changed, also change in BillingPage.tsx
     */
    public static final String ADDON_PRIVATE_PROJECTS = "private-projects";
    /**
     * If changed, also change in BillingPage.tsx
     */
    public static final String ADDON_EXTRA_PROJECT = "extra-project";
    /** @deprecated reference {@link PlanConstants#ADDON_EXTRA_TEAMMATE} -- kept for source-compat until the KB removal commit. */
    @Deprecated
    public static final String ADDON_EXTRA_TEAMMATE = PlanConstants.ADDON_EXTRA_TEAMMATE;
    /**
     * If changed, also change in BillingPage.tsx
     */
    public static final String ADDON_AI = "extra-ai";
    private static final String TERMS_POSTS = "Delete older posts to keep your project tidy and stay within the limits.";
    private static final String TERMS_PROJECTS = "You can create separate projects each having their own set of users and content";
    private static final String TERMS_ADMINS = "Amount of administrators, product managers or support team members you can have on each project including yourself.";
    private static final String TERMS_CLEARFLASK_AI = "ClearFlask AI is a way to talk to your customers through AI powered with all of your customer feedback. This feature is currently in preview and may become a paid feature in the future.";
    private static final String TERMS_CREDIT_SYSTEM = "Credit System allows fine-grained prioritization of value for each idea.";
    private static final String TERMS_PRIVATE_PROJECTS = "Create a private project so only authorized users can view and provide feedback";
    private static final String TERMS_AI = "Talk to your customers via AI";
    private static final String TERMS_SSO_AND_OAUTH = "Use your existing user accounts to log into ClearFlask with Single Sign-On or external OAuth provider such as Google, Github or Facebook";
    private static final String TERMS_SITE_TEMPLATE = "Use your own HTML template to display parts of the site";
    private static final String TERMS_TRACKING = "Include Google Analytics or Hotjar on every page";
    private static final String TERMS_API = "Integrate with any external service via our API and webhooks";
    private static final String TERMS_GITHUB = "Synchronize GitHub issues with ClearFlask";
    private static final String TERMS_INTERCOM = "Add Intercom widget on every page";
    private static final String TERMS_BILLING = "Custom billing and invoicing";
    private static final String TERMS_WHITELABEL = "Remove ClearFlask branding";
    private static final String TERMS_ELASTICSEARCH = "Search powered by ElasticSearch for fast and accurate search capability";
    private static final String TERMS_INSTALLATION_GUIDANCE = "Expert guidance on installation of self-hosted instance.";
    private static final String TERMS_SUPPORT_ALLOCATION = "The plan provides up to 10 support hours each month, offering you consistent access to expert assistance.";
    private static final String TERMS_NON_URGENT_SLA = "This SLA ensures that any non-critical support requests or planned interventions are addressed within 72 hours. It is designed for situations where immediate action is not necessary. This timeframe helps manage client expectations by providing a clear response window, reducing uncertainty and ensuring that non-urgent issues are handled efficiently.";
    /** @deprecated reference {@link PlanStore#SELFHOST_SERVICE_PLANS} -- kept for source-compat with existing callers. */
    @Deprecated
    public static final ImmutableSet<String> SELFHOST_SERVICE_PLANS = PlanStore.SELFHOST_SERVICE_PLANS;
    /** @deprecated reference {@link PlanStore#AVAILABLE_SELFHOST_SERVICE_PLANS}. */
    @Deprecated
    public static final ImmutableSet<String> AVAILABLE_SELFHOST_SERVICE_PLANS = PlanStore.AVAILABLE_SELFHOST_SERVICE_PLANS;
    /** @deprecated reference {@link PlanStore#AVAILABLE_PLAN_NAMES}. */
    @Deprecated
    public static final ImmutableSet<String> AVAILABLE_PLAN_NAMES = PlanStore.AVAILABLE_PLAN_NAMES;
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
                    new PlanPerk(PLAN_MAX_POSTS.get("starter-unlimited") + " ideas", TERMS_POSTS),
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
                    new PlanPerk("Whitelabel", TERMS_WHITELABEL)),
                    null, null))
            .put("standard3-monthly", pp -> new Plan("standard3-monthly", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("All features", null)),
                    null, null))
            .put("lifetime-lifetime", pp -> new Plan("lifetime-lifetime", "Lifetime",
                    pp, ImmutableList.of(
                    new PlanPerk("All features", null)),
                    null, null))
            .put("lifetime2-lifetime", pp -> new Plan("lifetime2-lifetime", "Lifetime",
                    pp, ImmutableList.of(
                    new PlanPerk("All features", null)),
                    null, null))
            .put("cloud-free", pp -> new Plan("cloud-free", "Starter",
                    pp, ImmutableList.of(
                    new PlanPerk("Feedback", null),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Announcements", null)),
                    null, null))
            .put("cloud-starter-monthly", pp -> new Plan("cloud-starter-monthly", "Starter",
                    pp, ImmutableList.of(
                    new PlanPerk("Feedback", null),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Announcements", null)),
                    null, null))
            .put("cloud-monthly", pp -> new Plan("cloud-monthly", "Growth",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited teammates/posts", null),
                    new PlanPerk("Custom domain", null),
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("SSO and OAuth", TERMS_SSO_AND_OAUTH)),
                    null, null))
            .put("cloud-yearly", pp -> new Plan("cloud-yearly", "Pro",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited Teammates Free", null),
                    new PlanPerk("Integrations", null),
                    new PlanPerk("API", TERMS_API),
                    new PlanPerk("Whitelabel", TERMS_WHITELABEL)),
                    null, null))
            .put("cloud-90day-yearly", pp -> new Plan("cloud-90day-yearly", "Pro",
                    pp, ImmutableList.of(
                    new PlanPerk("90 day trial", null),
                    new PlanPerk("Unlimited Teammates Free", null),
                    new PlanPerk("Integrations", null),
                    new PlanPerk("API", TERMS_API),
                    new PlanPerk("Whitelabel", TERMS_WHITELABEL)),
                    null, null))
            .put("selfhost-monthly", pp -> new Plan("selfhost-monthly", "Monthly License",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited admins/posts", null),
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("Whitelabel & SSO & API", null)),
                    null, null))
            .put("selfhost-yearly", pp -> new Plan("selfhost-yearly", "Yearly License (Grandfathered)",
                    pp, ImmutableList.of(
                    new PlanPerk("All features", null),
                    new PlanPerk("Basic support", null)),
                    null, null))
            .put("selfhost-yearly2", pp -> new Plan("selfhost-yearly2", "Support License",
                    pp, ImmutableList.of(
                    new PlanPerk("Installation guidance", TERMS_INSTALLATION_GUIDANCE),
                    new PlanPerk("Support allocation", TERMS_SUPPORT_ALLOCATION),
                    new PlanPerk("Non-urgent SLA", TERMS_NON_URGENT_SLA)),
                    null, null))
            .put("cloud-monthly2", pp -> new Plan("cloud-monthly2", "Cloud",
                    pp, ImmutableList.of(
                    new PlanPerk("All features", null),
                    new PlanPerk("Unlimited teammates", TERMS_ADMINS),
                    new PlanPerk("Unlimited posts", TERMS_POSTS)),
                    null, null))
            .put("selfhost-monthly2", pp -> new Plan("selfhost-monthly2", "Self-host License",
                    pp, ImmutableList.of(
                    new PlanPerk("All features", null),
                    new PlanPerk("Unlimited teammates", TERMS_ADMINS),
                    new PlanPerk("Unlimited posts", TERMS_POSTS)),
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
    // FEATURES_TABLE / FEATURES_TABLE_SELFHOST moved to PlanConstants — they describe
    // plan-family product policy, not anything KillBill-specific, and need to survive
    // the KB removal commit. plansGetResponse below references them via PlanConstants.

    @Inject
    private Billing billing;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;

    private ImmutableMap<String, Plan> allPlans;
    private ImmutableMap<String, Plan> availablePlans;
    private PlansGetResponse plansGetResponse;
    private AllPlansGetResponse allPlansGetResponse;

    private static PlanPricing pp(long basePrice, long baseMau, long unitPrice, long unitMau,
                                 PeriodEnum period, PlanPricingAdmins admins) {
        return PlanPricing.builder()
                .basePrice(basePrice).baseMau(baseMau).unitPrice(unitPrice).unitMau(unitMau)
                .period(period).admins(admins).build();
    }

    /**
     * Plan pricing extracted verbatim from the KillBill catalog (catalog021 + older versions,
     * latest-effectiveDate-wins) so this store no longer queries the KillBill engine on startup.
     * Plans absent here resolve to null pricing (the grandfathered $0 plans). getPlan() still
     * overrides the displayed price from each account's live subscription; the public pricing page
     * renders sellable plans from StripePlanStore.
     */
    private static final ImmutableMap<String, PlanPricing> STATIC_PLAN_PRICING = ImmutableMap.<String, PlanPricing>builder()
            .put("growth-monthly", pp(50L, 0L, 0L, 0L, PeriodEnum.MONTHLY, null))
            .put("standard-monthly", pp(200L, 0L, 0L, 0L, PeriodEnum.MONTHLY, null))
            .put("growth2-monthly", pp(10L, 50L, 10L, 50L, PeriodEnum.MONTHLY, null))
            .put("standard2-monthly", pp(100L, 500L, 50L, 500L, PeriodEnum.MONTHLY, null))
            .put("pitchground-a-lifetime", pp(0L, 50L, 10L, 50L, PeriodEnum.LIFETIME, null))
            .put("pitchground-b-lifetime", pp(0L, 500L, 50L, 500L, PeriodEnum.LIFETIME, null))
            .put("starter3-monthly", pp(10L, 0L, 0L, 0L, PeriodEnum.MONTHLY, null))
            .put("sponsor-monthly", pp(50L, 0L, 0L, 0L, PeriodEnum.MONTHLY, null))
            .put("standard3-monthly", pp(8L, 0L, 0L, 0L, PeriodEnum.MONTHLY, new PlanPricingAdmins(1L, 4L)))
            .put("lifetime-lifetime", pp(250L, 0L, 0L, 0L, PeriodEnum.LIFETIME, null))
            .put("lifetime2-lifetime", pp(150L, 0L, 0L, 0L, PeriodEnum.LIFETIME, new PlanPricingAdmins(1L, 75L)))
            .put("cloud-starter-monthly", pp(6L, 0L, 0L, 0L, PeriodEnum.MONTHLY, null))
            .put("cloud-monthly", pp(29L, 0L, 0L, 0L, PeriodEnum.MONTHLY, new PlanPricingAdmins(3L, 12L)))
            .put("cloud-yearly", pp(490L, 0L, 0L, 0L, PeriodEnum.YEARLY, null))
            .put("cloud-90day-yearly", pp(490L, 0L, 0L, 0L, PeriodEnum.YEARLY, null))
            .put("selfhost-monthly", pp(18L, 0L, 0L, 0L, PeriodEnum.MONTHLY, null))
            .put("selfhost-yearly", pp(108L, 0L, 0L, 0L, PeriodEnum.YEARLY, null))
            .put("selfhost-yearly2", pp(720L, 0L, 0L, 0L, PeriodEnum.YEARLY, null))
            .put("cloud-monthly2", pp(29L, 0L, 0L, 0L, PeriodEnum.MONTHLY, null))
            .put("selfhost-monthly2", pp(9L, 0L, 0L, 0L, PeriodEnum.MONTHLY, null))
            .build();

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of();
    }

    @Override
    protected void serviceStart() throws Exception {
        ImmutableList<Plan> plans = PLANS_BUILDER.entrySet().stream()
                // Pricing/period/MAU were previously parsed from the KillBill catalog via
                // catalogApi.getCatalogJson(). They are now baked into STATIC_PLAN_PRICING so this
                // store never queries the KillBill engine. getPlan() still overrides the displayed
                // price from each account's live subscription; sellable plans render via Stripe.
                // Absent key -> null pricing (the grandfathered $0 plans).
                .map(e -> e.getValue().apply(STATIC_PLAN_PRICING.get(e.getKey())))
                .collect(ImmutableList.toImmutableList());
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
                PlanConstants.FEATURES_TABLE,
                PlanConstants.FEATURES_TABLE_SELFHOST);
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
        if (SELFHOST_SERVICE_PLANS.contains(currentPlan.getBasePlanId())) {
            AVAILABLE_SELFHOST_SERVICE_PLANS.stream()
                    .map(availablePlans::get)
                    .forEach(planOptions::add);
        } else {
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
                case "lifetime-lifetime":
                case "lifetime2-lifetime":
                case "standard3-monthly":
                case "cloud-free":
                case "cloud-starter-monthly":
                case "cloud-monthly":
                case "cloud-yearly":
                case "cloud-90day-yearly":
                case "cloud-monthly2":
                    planOptions.add(availablePlans.get("cloud-monthly2"));
                    break;
                default:
                    break;
            }
        }
        planOptions.add(currentPlan);
        return ImmutableSet.copyOf(planOptions);
    }

    @Extern
    public Optional<Plan> getPlanExternOnly(String planId, @Nullable String accountIdOpt) {
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
                                    (plan.getPricing() == null) ? null : plan.getPricing().getAdmins(),
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
            case ADDON_AI:
                return Optional.of(new PlanPerk("AI", TERMS_AI));
            case ADDON_EXTRA_PROJECT:
                long projectCount = Optional.ofNullable(Longs.tryParse(value)).orElse(0L);
                boolean isMultiple = projectCount > 1;
                return Optional.of(new PlanPerk(
                        isMultiple ? "Extra " + projectCount + " projects" : "Extra project",
                        "In addition to your plan limits, you can create "
                                + (isMultiple ? projectCount + " additional projects" : "one additional project")));
            case ADDON_EXTRA_TEAMMATE:
                long teammateCount = Optional.ofNullable(Longs.tryParse(value)).orElse(0L);
                boolean isMultipleTeammates = teammateCount > 1;
                return Optional.of(new PlanPerk(
                        isMultipleTeammates ? "Extra " + teammateCount + " teammates" : "Extra teammate",
                        "In addition to your plan limits, you have "
                                + (isMultipleTeammates ? teammateCount + " additional teammates" : "one additional teammate")));
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

    private PeriodEnum billingPeriodToPeriodEnum(BillingPeriod billingPeriod) {
        switch (billingPeriod) {
            case MONTHLY:
                return PeriodEnum.MONTHLY;
            case QUARTERLY:
                return PeriodEnum.QUARTERLY;
            case ANNUAL:
                return PeriodEnum.YEARLY;
            case NO_BILLING_PERIOD:
                // NoOpBilling synthetic subscriptions report NO_BILLING_PERIOD; treat as LIFETIME
                // (matches the catalog period mapping). Prevents the billing page 500ing for NoOp/
                // grandfathered accounts now that they no longer route through KillBilling.
                return PeriodEnum.LIFETIME;
            default:
                throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Unexpected billing period");
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LegacyPlanStore.class).asEagerSingleton();
                bind(PlanStore.class).annotatedWith(com.google.inject.name.Names.named("legacy")).to(LegacyPlanStore.class);
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(LegacyPlanStore.class).asEagerSingleton();
            }
        };
    }
}
