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
import com.smotana.clearflask.util.Extern;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;

@Slf4j
@Singleton
public class KillBillPlanStore implements PlanStore {
    private static final String TERMS_PROJECTS = "You can create separate projects each having their own set of users and content";
    private static final String TERMS_ACTIVE_USERS = "Contributors are users that have signed up or made public contributions counted on a rolling 3 month median.";
    private static final String TERMS_ANALYTICS = "View top ideas based on return on investment considering popularity, opportunity and complexity. Explore data based on trends, demographics, and custom metrics.";
    private static final String TERMS_VOTING = "Voting and expressions allows prioritization of value for each idea.";
    private static final String TERMS_CREDIT_SYSTEM = "Credit System allows fine-grained prioritization of value for each idea.";
    private static final String TERMS_CREDIT = "Spend time-based credits on future ClearFlask development features";
    private static final String TERMS_PRIVATE_PROJECTS = "Create a private project so only authorized users can view and provide feedback";
    private static final String TERMS_SSO = "Use your existing user accounts to log into ClearFlask";
    private static final String TERMS_SITE_TEMPLATE = "Use your own HTML template to display parts of the site";
    private static final ImmutableMap<String, Plan> AVAILABLE_PLANS = ImmutableMap.of(
            "growth-monthly", new Plan("growth-monthly", "Growth",
                    new PlanPricing(20L, 40L, 40L, 20L, PlanPricing.PeriodEnum.MONTHLY), ImmutableList.of(
                    new PlanPerk("Unlimited projects", null),
                    new PlanPerk("Credit System", null),
                    new PlanPerk("Roadmap", null)),
                    null, null),
            "standard-monthly", new Plan("standard-monthly", "Standard",
                    new PlanPricing(200L, 400L, 400L, 200L, PlanPricing.PeriodEnum.MONTHLY), ImmutableList.of(
                    new PlanPerk("Single Sign-On", TERMS_SSO),
                    new PlanPerk("Private projects", TERMS_PRIVATE_PROJECTS),
                    new PlanPerk("Site template", TERMS_SITE_TEMPLATE)),
                    null, null),
            "flat-yearly", new Plan("flat-yearly", "Flat",
                    null, ImmutableList.of(
                    new PlanPerk("Predictable annual price", null),
                    new PlanPerk("Tailored plan", null)),
                    null, null)
    );
    private static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Growth", "Standard"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Projects", ImmutableList.of("No limit", "No limit"), TERMS_PROJECTS),
                    new FeaturesTableFeatures("Credit System", ImmutableList.of("Yes", "Yes"), TERMS_CREDIT_SYSTEM),
                    new FeaturesTableFeatures("Roadmap view", ImmutableList.of("Yes", "Yes"), null),
                    new FeaturesTableFeatures("Content customization", ImmutableList.of("Yes", "Yes"), null),
                    new FeaturesTableFeatures("Private projects", ImmutableList.of("No", "Yes"), TERMS_PRIVATE_PROJECTS),
                    new FeaturesTableFeatures("Single Sign-On", ImmutableList.of("No", "Yes"), TERMS_SSO),
                    new FeaturesTableFeatures("Site template", ImmutableList.of("No", "Yes"), TERMS_SITE_TEMPLATE)
            ), null);
    private static final PlansGetResponse PLANS_GET_RESPONSE = new PlansGetResponse(
            AVAILABLE_PLANS.values().asList(),
            FEATURES_TABLE);

    @Inject
    private Billing billing;

    @Extern
    @Override
    public PlansGetResponse getPublicPlans() {
        return PLANS_GET_RESPONSE;
    }

    @Extern
    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        Subscription subscription = billing.getSubscription(accountId);
        switch (subscription.getPlanName()) {
            case "growth-monthly":
            case "standard-monthly":
                return ImmutableSet.of(
                        AVAILABLE_PLANS.get("growth-monthly"),
                        AVAILABLE_PLANS.get("standard-monthly"));
            default:
                return ImmutableSet.of();
        }
    }

    @Extern
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
