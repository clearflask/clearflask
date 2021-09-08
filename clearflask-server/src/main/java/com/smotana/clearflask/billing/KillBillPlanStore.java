// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.billing;

import com.google.common.base.Preconditions;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.FeaturesTableFeatures;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPerk;
import com.smotana.clearflask.api.model.PlanPricing;
import com.smotana.clearflask.api.model.PlanPricing.PeriodEnum;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.catalog.api.BillingPeriod;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.model.Catalogs;
import org.killbill.billing.client.model.gen.Catalog;
import org.killbill.billing.client.model.gen.Phase;
import org.killbill.billing.client.model.gen.PhasePrice;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.client.model.gen.Usage;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.util.AbstractCollection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class KillBillPlanStore extends ManagedService implements PlanStore {
    private static final String TERMS_PROJECTS = "You can create separate projects each having their own set of users and content";
    private static final String TERMS_ADMINS = "Amount of administrators, product managers or support team members you can have on each project.";
    private static final String TERMS_CREDIT_SYSTEM = "Credit System allows fine-grained prioritization of value for each idea.";
    private static final String TERMS_PRIVATE_PROJECTS = "Create a private project so only authorized users can view and provide feedback";
    private static final String TERMS_SSO_AND_OAUTH = "Use your existing user accounts to log into ClearFlask with Single Sign-On or external OAuth provider such as Google, Github or Facebook";
    private static final String TERMS_SITE_TEMPLATE = "Use your own HTML template to display parts of the site";
    private static final String TERMS_TRACKING = "Include Google Analytics or Hotjar on every page";
    private static final String TERMS_API = "Integrate with any external service via our API and webhooks";
    private static final String TERMS_INTERCOM = "Add Intercom widget on every page";
    private static final String TERMS_BILLING = "Custom billing and invoicing";
    private static final ImmutableSet<String> AVAILABLE_PLAN_NAMES = ImmutableSet.of(
            "growth2-monthly",
            "standard2-monthly",
            "flat-yearly");
    private static final ImmutableMap<String, Function<PlanPricing, Plan>> PLANS_BUILDER = ImmutableMap.<String, Function<PlanPricing, Plan>>builder()
            // Deprecated plan with unlimited trial up to 10 MAU
            .put("growth-monthly", pp -> new Plan("growth-monthly", "Growth",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Changelog", null)),
                    null, null))
            // Deprecated plan with unlimited trial up to 10 MAU
            .put("standard-monthly", pp -> new Plan("standard-monthly", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("SSO and OAuth", TERMS_SSO_AND_OAUTH),
                    new PlanPerk("Site template", TERMS_SITE_TEMPLATE)),
                    null, null))
            .put("growth2-monthly", pp -> new Plan("growth2-monthly", "Growth",
                    pp, ImmutableList.of(
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Roadmap", null),
                    new PlanPerk("Changelog", null)),
                    null, null))
            .put("standard2-monthly", pp -> new Plan("standard2-monthly", "Standard",
                    pp, ImmutableList.of(
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("SSO and OAuth", TERMS_SSO_AND_OAUTH),
                    new PlanPerk("Site template", TERMS_SITE_TEMPLATE)),
                    null, null))
            .build();
    private static final ImmutableList<Plan> PLANS_STATIC = ImmutableList.of(
            new Plan("flat-yearly", "Flat",
                    null, ImmutableList.of(
                    new PlanPerk("Flat annual price", null),
                    new PlanPerk("Tailored plan", null),
                    new PlanPerk("Support & SLA", null)),
                    null, null),
            new Plan(TEAMMATE_PLAN_ID, "Teammate",
                    null, ImmutableList.of(
                    new PlanPerk("External projects", null),
                    new PlanPerk("No billing", null)),
                    null, null)
    );
    private static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Growth", "Standard", "Flat"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Projects", ImmutableList.of("No limit", "No limit", "No limit"), TERMS_PROJECTS),
                    new FeaturesTableFeatures("Viewers", ImmutableList.of("No limit", "No limit", "No limit"), null),
                    new FeaturesTableFeatures("Teammates", ImmutableList.of("1", "8", "No limit"), TERMS_ADMINS),
                    new FeaturesTableFeatures("Credit System", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_CREDIT_SYSTEM),
                    new FeaturesTableFeatures("Roadmap", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Content customization", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Custom domain", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Private projects", ImmutableList.of("No", "Yes", "Yes"), TERMS_PRIVATE_PROJECTS),
                    new FeaturesTableFeatures("SSO and OAuth", ImmutableList.of("No", "Yes", "Yes"), TERMS_SSO_AND_OAUTH),
                    new FeaturesTableFeatures("API", ImmutableList.of("No", "Yes", "Yes"), TERMS_API),
                    new FeaturesTableFeatures("Tracking integrations", ImmutableList.of("No", "Yes", "Yes"), TERMS_TRACKING),
                    new FeaturesTableFeatures("Intercom integration", ImmutableList.of("No", "Yes", "Yes"), TERMS_INTERCOM),
                    new FeaturesTableFeatures("Site template", ImmutableList.of("No", "Yes", "Yes"), TERMS_SITE_TEMPLATE),
                    new FeaturesTableFeatures("Volume discount", ImmutableList.of("No", "No", "Yes"), null),
                    new FeaturesTableFeatures("Billing & Invoicing", ImmutableList.of("No", "No", "Yes"), TERMS_BILLING)
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
            Phase evergreen = catalogs
                    .stream()
                    .sorted(Comparator.comparing(Catalog::getEffectiveDate).reversed())
                    .flatMap(c -> c.getProducts().stream())
                    .flatMap(p -> p.getPlans().stream())
                    .filter(p -> planName.equals(p.getName()))
                    .findFirst()
                    .stream()
                    .flatMap(p -> p.getPhases().stream())
                    .filter(p -> PhaseType.EVERGREEN.name().equals(p.getType()))
                    .findAny()
                    .get();
            long basePrice = evergreen.getPrices().get(0).getValue().longValueExact();
            Usage usage = evergreen.getUsages().get(0);
            PeriodEnum period;
            if (BillingPeriod.MONTHLY.name().equals(usage.getBillingPeriod())) {
                period = PeriodEnum.MONTHLY;
            } else {
                period = PeriodEnum.YEARLY;
            }
            long baseMau = Double.valueOf(usage.getTiers().get(0).getBlocks().get(0).getSize()).longValue();
            long unitPrice = usage.getTiers().get(1).getBlocks().get(0).getPrices().get(0).getValue().longValueExact();
            long unitMau = Double.valueOf(usage.getTiers().get(1).getBlocks().get(0).getSize()).longValue();
            PlanPricing planPricing = PlanPricing.builder()
                    .basePrice(basePrice)
                    .baseMau(baseMau)
                    .unitPrice(unitPrice)
                    .unitMau(unitMau)
                    .period(period)
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
    }

    @Extern
    @Override
    public PlansGetResponse getPublicPlans() {
        return plansGetResponse;
    }

    @Extern
    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        Subscription subscription = billing.getSubscription(accountId);
        String planToChangeFrom = billing.getEndOfTermChangeToPlanId(subscription)
                .orElse(subscription.getPlanName());
        switch (getBasePlanId(planToChangeFrom)) {
            case "growth-monthly":
                return ImmutableSet.of(
                        availablePlans.get("growth-monthly"),
                        availablePlans.get("standard2-monthly"));
            case "standard-monthly":
                return ImmutableSet.of(
                        availablePlans.get("growth2-monthly"),
                        availablePlans.get("standard-monthly"));
            case TEAMMATE_PLAN_ID:
            case "growth2-monthly":
            case "standard2-monthly":
                return ImmutableSet.of(
                        availablePlans.get("growth2-monthly"),
                        availablePlans.get("standard2-monthly"));
            case "flat-yearly":
            default:
                return ImmutableSet.of();
        }
    }

    @Extern
    @Override
    public Optional<Plan> getPlan(String planId, Optional<Subscription> subscriptionOpt) {
        String basePlanId = getBasePlanId(planId);
        Optional<Plan> planOpt = Optional.ofNullable(allPlans.get(basePlanId));
        if (planOpt.isPresent()
                && subscriptionOpt.isPresent()) {
            Optional<Long> recurringPrice = Stream.of(subscriptionOpt.get().getPriceOverrides(), subscriptionOpt.get().getPrices())
                    .filter(Objects::nonNull)
                    .flatMap(List::stream)
                    .filter(phasePrice -> subscriptionOpt.get().getPlanName().equals(phasePrice.getPlanName()))
                    .filter(phasePrice -> subscriptionOpt.get().getPhaseType().name().equals(phasePrice.getPhaseType()))
                    .findFirst()
                    .map(PhasePrice::getRecurringPrice)
                    .map(BigDecimal::longValueExact);
            if (recurringPrice.isPresent()) {
                return planOpt.map(plan -> plan.toBuilder()
                        .pricing(new PlanPricing(
                                recurringPrice.get(),
                                0L,
                                0L,
                                0L,
                                billingPeriodToPeriodEnum(subscriptionOpt.get().getBillingPeriod())))
                        .build());
            }
        }
        return planOpt;
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
                    verifyConfigMeetsPlanRestrictions(planId, project.getVersionedConfigAdmin().getConfig());
                    verifyTeammateInviteMeetsPlanRestrictions(planId, project.getProjectId(), false);
                });

        if (!Strings.isNullOrEmpty(account.getApiKey())) {
            verifyActionMeetsPlanRestrictions(planId, Action.API_KEY);
        }
    }

    /** If changed, also change in UpgradeWrapper.tsx */
    @Override
    public void verifyActionMeetsPlanRestrictions(String planId, Action action) throws RequiresUpgradeException {
        switch (getBasePlanId(planId)) {
            case TEAMMATE_PLAN_ID:
                switch (action) {
                    case CREATE_PROJECT:
                        throw new RequiresUpgradeException("growth2-monthly", "Not allowed to create projects without a plan");
                    case API_KEY:
                        throw new RequiresUpgradeException("growth2-monthly", "Not allowed to use API without a plan");
                }
                return;
            case "growth-monthly":
            case "growth2-monthly":
                switch (action) {
                    case API_KEY:
                        throw new RequiresUpgradeException("standard2-monthly", "Not allowed to use API on your plan");
                }
                return;
            case "standard-monthly":
            case "standard2-monthly":
            case "flat-yearly":
        }
    }

    /** If changed, also change in UpgradeWrapper.tsx */
    @Override
    public void verifyConfigMeetsPlanRestrictions(String planId, ConfigAdmin config) throws RequiresUpgradeException {
        switch (getBasePlanId(planId)) {
            case TEAMMATE_PLAN_ID:
                throw new RequiresUpgradeException("growth2-monthly", "Not allowed to have projects without a plan");
            case "growth-monthly":
            case "growth2-monthly":
                // Restrict OAuth
                if (!config.getUsers().getOnboarding().getNotificationMethods().getOauth().isEmpty()) {
                    throw new RequiresUpgradeException("standard2-monthly", "Not allowed to use OAuth on your plan");
                }
                // Restrict Single Sign-On
                if (config.getUsers().getOnboarding().getNotificationMethods().getSso() != null) {
                    throw new RequiresUpgradeException("standard2-monthly", "Not allowed to use SSO on your plan");
                }
                // Restrict Private projects
                if (config.getUsers().getOnboarding().getVisibility() == Onboarding.VisibilityEnum.PRIVATE) {
                    throw new RequiresUpgradeException("standard2-monthly", "Not allowed to use Private visibility on your plan");
                }
                // Restrict Site template
                if (config.getStyle().getTemplates() != null) {
                    throw new RequiresUpgradeException("standard2-monthly", "Not allowed to use Templates on your plan");
                }
                // Restrict Integrations
                if (config.getIntegrations().getGoogleAnalytics() != null) {
                    throw new RequiresUpgradeException("standard2-monthly", "Not allowed to use Google Analytics on your plan");
                }
                if (config.getIntegrations().getHotjar() != null) {
                    throw new RequiresUpgradeException("standard2-monthly", "Not allowed to use Google Analytics on your plan");
                }
                if (config.getIntegrations().getIntercom() != null) {
                    throw new RequiresUpgradeException("standard2-monthly", "Not allowed to use Intercom on your plan");
                }
                return;
            case "standard-monthly":
            case "standard2-monthly":
            case "flat-yearly":
        }
    }

    /** If changed, also change in UpgradeWrapper.tsx */
    @Override
    public void verifyTeammateInviteMeetsPlanRestrictions(String planId, String projectId, boolean addOne) throws ApiException {
        switch (getBasePlanId(planId)) {
            case "growth-monthly":
            case "growth2-monthly":
                throw new RequiresUpgradeException("standard2-monthly", "Not allowed to invite teammates on your plan");
            case "standard-monthly":
            case "standard2-monthly":
                if ((getCurrentTeammateCount(projectId) + (addOne ? 1 : 0)) > 8L) {
                    throw new RequiresUpgradeException("flat-yearly", "Your plan has reached the teammate limit");
                }
            case "flat-yearly":
        }
    }

    private long getCurrentTeammateCount(String projectId) {
        long invitationCount = projectStore.getProject(projectId, true).map(ProjectStore.Project::getModel)
                .map(ProjectStore.ProjectModel::getAdminsAccountIds)
                .map(AbstractCollection::size)
                .orElse(0);
        long adminCount = projectStore.getInvitations(projectId)
                .stream()
                .filter(Predicate.not(ProjectStore.InvitationModel::isAccepted))
                .count();
        return invitationCount = adminCount;
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
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(KillBillPlanStore.class);
            }
        };
    }
}
