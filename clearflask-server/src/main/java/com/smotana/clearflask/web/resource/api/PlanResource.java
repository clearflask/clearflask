package com.smotana.clearflask.web.resource.api;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.PlanApi;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.FeaturesTableFeatures;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPerk;
import com.smotana.clearflask.api.model.PlanPricing;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.web.resource.AbstractClearflaskResource;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.ws.rs.Path;

@Slf4j
@Singleton
@Path("/v1")
public class PlanResource extends AbstractClearflaskResource implements PlanApi {

    private static final ImmutableList<Plan> AVAILABLE_PlANS = ImmutableList.of(
            new Plan("7CC22CC8-16C5-49DF-8AEB-2FD98D9059A7", "Basic",
                    new PlanPricing(50L, PlanPricing.PeriodEnum.YEARLY), ImmutableList.of(
                    new PlanPerk("Unlimited users", "description"),
                    new PlanPerk("Simple user voting", "description"),
                    new PlanPerk("1 hour credit", "description"))),
            new Plan("9C7EA3A5-B4AE-46AA-9C2E-98659BC65B89", "Basic",
                    new PlanPricing(80L, PlanPricing.PeriodEnum.QUARTERLY), ImmutableList.of(
                    new PlanPerk("Unlimited users", "description"),
                    new PlanPerk("Simple user voting", "description"),
                    new PlanPerk("15 minute credit", "description"))),
            new Plan("CDBF4982-1805-4352-8A57-824AFB565973", "Analytic",
                    new PlanPricing(300L, PlanPricing.PeriodEnum.YEARLY), ImmutableList.of(
                    new PlanPerk("Content analytics and search", "description"),
                    new PlanPerk("Crowd-funding", "description"),
                    new PlanPerk("Unlimited projects", "description"),
                    new PlanPerk("10 hour credit", "description"))),
            new Plan("89C4E0BB-92A8-4F83-947A-8C39DC8CEA5A", "Analytic",
                    new PlanPricing(450L, PlanPricing.PeriodEnum.QUARTERLY), ImmutableList.of(
                    new PlanPerk("Content analytics and search", "description"),
                    new PlanPerk("Crowd-funding", "description"),
                    new PlanPerk("Unlimited projects", "description"),
                    new PlanPerk("1 hour credit", "description"))),
            new Plan("597099E1-83B3-40AC-8AC3-52E9BF59A562", "Enterprise",
                    null, ImmutableList.of(
                    new PlanPerk("Multi-Agent Access", "description"),
                    new PlanPerk("Whitelabel", "description"),
                    new PlanPerk("Integrations, API Access", "description"),
                    new PlanPerk("Dedicated/Onsite hosting", "description"),
                    new PlanPerk("Custom SLA", "description"))));
    private static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Basic", "Analytic", "Enterprise"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Projects", ImmutableList.of("1", "Unlimited", "Unlimited")),
                    new FeaturesTableFeatures("Active users", ImmutableList.of("Unlimited", "Unlimited", "Unlimited")),
                    new FeaturesTableFeatures("User submitted content", ImmutableList.of("Unlimited", "Unlimited", "Unlimited")),
                    new FeaturesTableFeatures("Customizable pages: Ideas, Roadmap, FAQ, Knowledge base, etc...", ImmutableList.of("Yes", "Yes", "Yes")),
                    new FeaturesTableFeatures("Voting and Emoji expressions", ImmutableList.of("No", "Yes", "Yes")),
                    new FeaturesTableFeatures("Credit system / Crowd-funding", ImmutableList.of("No", "Yes", "Yes")),
                    new FeaturesTableFeatures("Analytics", ImmutableList.of("No", "No", "Yes")),
                    new FeaturesTableFeatures("Multi agent access", ImmutableList.of("No", "No", "Yes")),
                    new FeaturesTableFeatures("Integrations", ImmutableList.of("No", "No", "Yes")),
                    new FeaturesTableFeatures("API access", ImmutableList.of("No", "No", "Yes")),
                    new FeaturesTableFeatures("Whitelabel", ImmutableList.of("No", "No", "Yes"))
            ));

    @Override
    public PlansGetResponse plansGet() {
        return new PlansGetResponse(AVAILABLE_PlANS, FEATURES_TABLE);
    }
}
