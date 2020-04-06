package com.smotana.clearflask.store.impl;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.FeaturesTableFeatures;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPerk;
import com.smotana.clearflask.api.model.PlanPricing;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.store.PlanStore;

import java.util.Optional;

@Singleton
public class StaticPlanStore implements PlanStore {

    private static final String TERMS_PROJECTS = "You can create separate projects each having their own set of users and content";
    private static final String TERMS_ACTIVE_USERS = "Active users are users that have signed up or made public contributions counted on a 3 month-average";
    private static final String TERMS_ANALYTICS = "View top ideas based on return on investement considering popularity, opportunity and complexity. Explore data based on trends, demographics, and custom metrics.";
    private static final String TERMS_VOTING = "Voting and Credit system allows precise expression of value for each idea.";
    private static final String TERMS_CREDIT = "Spend time credits on future ClearFlask development features";
    private static final ImmutableMap<String, Plan> AVAILABLE_PlANS = ImmutableMap.of(
            "7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7", new Plan("7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7", "Standard",
                    new PlanPricing(50L, PlanPricing.PeriodEnum.YEARLY), ImmutableList.of(
                    new PlanPerk("1,000 active users", TERMS_ACTIVE_USERS),
                    new PlanPerk("Multiple projects", TERMS_PROJECTS),
                    new PlanPerk("Voting and Crowd-funding", TERMS_VOTING),
                    new PlanPerk("1hr feature credits", TERMS_CREDIT)),
                    null, true),
            "9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89", new Plan("9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89", "Standard",
                    new PlanPricing(80L, PlanPricing.PeriodEnum.QUARTERLY), ImmutableList.of(
                    new PlanPerk("1,000 active users", TERMS_ACTIVE_USERS),
                    new PlanPerk("Multiple projects", TERMS_PROJECTS),
                    new PlanPerk("Voting and Crowd-funding", TERMS_VOTING),
                    new PlanPerk("5min feature credits", TERMS_CREDIT)),
                    null, true),
            "CDBF4982-1805-4352-8A57-824AFB565973", new Plan("CDBF4982-1805-4352-8A57-824AFB565973", "Analytic",
                    null, ImmutableList.of(
                    new PlanPerk("10,000 active users", TERMS_ACTIVE_USERS),
                    new PlanPerk("Powerful Analytics", TERMS_ANALYTICS),
                    new PlanPerk("Single sign-on", null),
                    new PlanPerk("API access", null)),
                    true, false),
            "597099E1-83B3-40AC-8AC3-52E9BF59A562", new Plan("597099E1-83B3-40AC-8AC3-52E9BF59A562", "Enterprise",
                    null, ImmutableList.of(
                    new PlanPerk("10,000+ active users", null),
                    new PlanPerk("Multi-Agent Access", null),
                    new PlanPerk("White-label", null)),
                    true, false));
    private static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Standard", "Analytic", "Enterprise"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Projects", ImmutableList.of("No limit", "No limit", "No limit"), TERMS_PROJECTS),
                    new FeaturesTableFeatures("Active users", ImmutableList.of("1,000", "10,000", "10,000+"), TERMS_ACTIVE_USERS),
                    new FeaturesTableFeatures("Customizable pages", ImmutableList.of("Yes", "Yes", "Yes"), "Customize with Feedback, Roadmap, Changelog, Knowledge base, Blog, FAQ"),
                    new FeaturesTableFeatures("Voting and Crowd-funding", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_VOTING),
                    new FeaturesTableFeatures("Powerful Analytics", ImmutableList.of("No", "Yes", "Yes"), TERMS_ANALYTICS),
                    new FeaturesTableFeatures("Single sign-on", ImmutableList.of("No", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("API access", ImmutableList.of("No", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Multi-Agent access", ImmutableList.of("No", "No", "Yes"), null),
                    new FeaturesTableFeatures("Whitelabel", ImmutableList.of("No", "No", "Yes"), null)
            ), null);
    private static final PlansGetResponse PLANS_GET_RESPONSE = new PlansGetResponse(AVAILABLE_PlANS.values().asList(), FEATURES_TABLE);

    @Override
    public PlansGetResponse plansGet() {
        return PLANS_GET_RESPONSE;
    }

    @Override
    public ImmutableSet<Plan> mapIdsToPlans(ImmutableSet<String> planIds) {
        return planIds.stream()
                .map(AVAILABLE_PlANS::get)
                .collect(ImmutableSet.toImmutableSet());
    }

    @Override
    public Optional<Plan> getPlan(String planId) {
        return Optional.ofNullable(AVAILABLE_PlANS.get(planId));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PlanStore.class).to(StaticPlanStore.class).asEagerSingleton();
            }
        };
    }
}
