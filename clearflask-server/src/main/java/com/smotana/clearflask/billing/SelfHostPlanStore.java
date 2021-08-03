package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPricing;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.web.ApiException;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;

public class SelfHostPlanStore implements PlanStore {

    public static final Plan SELF_HOST_PLAN = new Plan(
            "self-host",
            "Self-Hosting",
            new PlanPricing(
                    0L,
                    0L,
                    0L,
                    0L,
                    PlanPricing.PeriodEnum.YEARLY),
            ImmutableList.of(),
            false,
            false);

    @Override
    public PlansGetResponse getPublicPlans() {
        return new PlansGetResponse(
                ImmutableList.of(SELF_HOST_PLAN),
                new FeaturesTable(
                        ImmutableList.of(),
                        ImmutableList.of(),
                        null));
    }

    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        return ImmutableSet.of();
    }

    @Override
    public Optional<Plan> getPlan(String planId, Optional<Subscription> subscriptionOpt) {
        return SELF_HOST_PLAN.getBasePlanId().equals(planId) ? Optional.of(SELF_HOST_PLAN) : Optional.empty();
    }

    @Override
    public String getBasePlanId(String planId) {
        return planId;
    }

    @Override
    public String prettifyPlanName(String planIdOrPrettyPlanName) {
        return planIdOrPrettyPlanName;
    }

    @Override
    public void verifyActionMeetsPlanRestrictions(String planId, Action action) throws ApiException {
        // No-op
    }

    @Override
    public void verifyConfigMeetsPlanRestrictions(String planId, ConfigAdmin config) throws ApiException {
        // No-op
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PlanStore.class).to(SelfHostPlanStore.class).asEagerSingleton();
            }
        };
    }
}
