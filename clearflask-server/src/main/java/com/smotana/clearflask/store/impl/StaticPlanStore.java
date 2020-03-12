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

    private static final ImmutableMap<String, Plan> AVAILABLE_PlANS = ImmutableMap.of(
            "7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7", new Plan("7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7", "Basic",
                    new PlanPricing(50L, PlanPricing.PeriodEnum.YEARLY), ImmutableList.of(
                    new PlanPerk("1,000 active users", "description"),
                    new PlanPerk("Simple user voting", "description"),
                    new PlanPerk("1 hour credit", "description")),
                    null, true),
            "9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89", new Plan("9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89", "Basic",
                    new PlanPricing(80L, PlanPricing.PeriodEnum.QUARTERLY), ImmutableList.of(
                    new PlanPerk("1,000 active users", "description"),
                    new PlanPerk("Simple user voting", "description"),
                    new PlanPerk("15 minute credit", "description")),
                    null, true),
            "CDBF4982-1805-4352-8A57-824AFB565973", new Plan("CDBF4982-1805-4352-8A57-824AFB565973", "Analytic",
                    new PlanPricing(300L, PlanPricing.PeriodEnum.YEARLY), ImmutableList.of(
                    new PlanPerk("Analytics and insights", "description"),
                    new PlanPerk("Credit system", "description"),
                    new PlanPerk("Unlimited projects", "description"),
                    new PlanPerk("10 hour credit", "description")),
                    null, true),
            "89C4E0BB-92A8-4F83-947A-8C39DC8CEA5A", new Plan("89C4E0BB-92A8-4F83-947A-8C39DC8CEA5A", "Analytic",
                    new PlanPricing(450L, PlanPricing.PeriodEnum.QUARTERLY), ImmutableList.of(
                    new PlanPerk("Analytics and insights", "description"),
                    new PlanPerk("Credit system", "description"),
                    new PlanPerk("Unlimited projects", "description"),
                    new PlanPerk("1 hour credit", "description")),
                    null, true),
            "597099E1-83B3-40AC-8AC3-52E9BF59A562", new Plan("597099E1-83B3-40AC-8AC3-52E9BF59A562", "Enterprise",
                    null, ImmutableList.of(
                    new PlanPerk("Multi-Agent Access", "description"),
                    new PlanPerk("White-label", "description"),
                    new PlanPerk("Integrations, API Access", "description"),
                    new PlanPerk("Dedicated/Onsite hosting", "description"),
                    new PlanPerk("Custom SLA", "description")),
                    null, true));
    private static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Basic", "Analytic", "Enterprise"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Active users", ImmutableList.of("Unlimited", "Unlimited", "Unlimited"), null),
                    new FeaturesTableFeatures("Projects", ImmutableList.of("Unlimited", "Unlimited", "Unlimited"), null),
                    new FeaturesTableFeatures("User submitted content", ImmutableList.of("Unlimited", "Unlimited", "Unlimited"), null),
                    new FeaturesTableFeatures("Customizable pages: Ideas, Roadmap, FAQ, Knowledge base, etc...", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Voting and Emoji expressions", ImmutableList.of("No", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Credit system / Crowd-funding", ImmutableList.of("No", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Analytics", ImmutableList.of("No", "No", "Yes"), null),
                    new FeaturesTableFeatures("Multi agent access", ImmutableList.of("No", "No", "Yes"), null),
                    new FeaturesTableFeatures("Integrations", ImmutableList.of("No", "No", "Yes"), null),
                    new FeaturesTableFeatures("API access", ImmutableList.of("No", "No", "Yes"), null),
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
