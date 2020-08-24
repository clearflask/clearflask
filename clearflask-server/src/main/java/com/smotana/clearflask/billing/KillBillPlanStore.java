package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.FeaturesTableFeatures;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPerk;
import com.smotana.clearflask.api.model.PlanPricing;
import com.smotana.clearflask.api.model.PlansGetResponse;
import lombok.extern.slf4j.Slf4j;

import java.util.Objects;
import java.util.Optional;

@Slf4j
@Singleton
public class KillBillPlanStore implements PlanStore {
    private static final String PLAN_TITLE_BASIC = "Basic";
    private static final String PLAN_TITLE_STANDARD = "Standard";
    private static final String TERMS_PROJECTS = "You can create separate projects each having their own set of users and content";
    private static final String TERMS_ACTIVE_USERS = "Contributors are users that have signed up or made public contributions counted on a rolling 3 month median.";
    private static final String TERMS_ANALYTICS = "View top ideas based on return on investment considering popularity, opportunity and complexity. Explore data based on trends, demographics, and custom metrics.";
    private static final String TERMS_VOTING = "Voting and expressions allows prioritization of value for each idea.";
    private static final String TERMS_CREDIT_SYSTEM = "Credit System allows fine-grained prioritization of value for each idea.";
    private static final String TERMS_CREDIT = "Spend time-based credits on future ClearFlask development features";
    private static final ImmutableMap<String, Plan> AVAILABLE_PLANS = ImmutableMap.of(
            "basic-monthly", new Plan("basic-monthly", PLAN_TITLE_BASIC,
                    new PlanPricing(50L, PlanPricing.PeriodEnum.MONTHLY), ImmutableList.of(
                    new PlanPerk("Voting and expressions", TERMS_VOTING),
                    new PlanPerk("Unlimited projects", TERMS_PROJECTS),
                    new PlanPerk("Up to 100 contributors", TERMS_ACTIVE_USERS),
                    new PlanPerk("20min feature credits", TERMS_CREDIT)),
                    null, false),
            "standard-monthly", new Plan("standard-monthly", PLAN_TITLE_STANDARD,
                    new PlanPricing(200L, PlanPricing.PeriodEnum.MONTHLY), ImmutableList.of(
                    new PlanPerk("Credit System", TERMS_CREDIT_SYSTEM),
                    new PlanPerk("Single Sign-On", null),
                    new PlanPerk("Up to 1,000 contributors", TERMS_ACTIVE_USERS),
                    new PlanPerk("1hr feature credits", TERMS_CREDIT)),
                    null, false),
            "analytic-monthly", new Plan("analytic-monthly", "Analytic",
                    null, ImmutableList.of(
                    new PlanPerk("Powerful Analytics", TERMS_ANALYTICS),
                    new PlanPerk("Multi-Agent", null),
                    new PlanPerk("Full API access", null),
                    new PlanPerk("Unlimited contributors", TERMS_ACTIVE_USERS)),
                    true, false));
    private static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Basic", "Standard", "Analytic"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Projects", ImmutableList.of("No limit", "No limit", "No limit"), TERMS_PROJECTS),
                    new FeaturesTableFeatures("Contributors", ImmutableList.of("100", "1,000", "No limit"), TERMS_ACTIVE_USERS),
                    new FeaturesTableFeatures("Layout and Style customization", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Voting and expressions", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_VOTING),
                    new FeaturesTableFeatures("Credit System", ImmutableList.of("No", "Yes", "Yes"), TERMS_CREDIT_SYSTEM),
                    new FeaturesTableFeatures("Single Sign-On", ImmutableList.of("No", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Powerful Analytics", ImmutableList.of("No", "No", "Yes"), TERMS_ANALYTICS),
                    new FeaturesTableFeatures("Full API access", ImmutableList.of("No", "No", "Yes"), null)
            ), null);
    private static final PlansGetResponse PLANS_GET_RESPONSE = new PlansGetResponse(
            AVAILABLE_PLANS.values().asList(),
            FEATURES_TABLE);

    @Inject
    private Billing billing;

    @Override
    public PlansGetResponse getPublicPlans() {
        return PLANS_GET_RESPONSE;
    }

    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        return billing.getAvailablePlans(Optional.of(accountId)).stream()
                .map(p -> AVAILABLE_PLANS.get(p.getPlan()))
                .filter(Objects::nonNull)
                .collect(ImmutableSet.toImmutableSet());
    }

    @Override
    public Optional<Plan> getPlan(String planId) {
        return Optional.ofNullable(AVAILABLE_PLANS.get(planId));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PlanStore.class).to(KillBillPlanStore.class).asEagerSingleton();
            }
        };
    }
}
