package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.model.AllPlansGetResponse;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPricing;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.web.ApiException;

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
    public AllPlansGetResponse getAllPlans() {
        return new AllPlansGetResponse(ImmutableList.of(SELF_HOST_PLAN));
    }

    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        return ImmutableSet.of();
    }

    @Override
    public Optional<Plan> getPlan(String planId, Optional<String> accountIdOpt) {
        return SELF_HOST_PLAN.getBasePlanId().equals(planId)
                ? Optional.of(SELF_HOST_PLAN)
                : Optional.empty();
    }

    @Override
    public Optional<PlanWithAddons> getCouponPlan(CouponStore.CouponModel coupon, Optional<String> accountId) {
        return SELF_HOST_PLAN.getBasePlanId().equals(coupon.getBasePlanId())
                ? Optional.of(new PlanWithAddons(SELF_HOST_PLAN, ImmutableMap.of()))
                : Optional.empty();
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
    public void verifyAccountMeetsPlanRestrictions(String planId, String accountId) throws ApiException {
        // No-op
    }

    @Override
    public void verifyAccountMeetsLimits(String planId, String accountId) throws ApiException {
        // No-op
    }

    @Override
    public boolean isAccountExceedsPostLimit(String planId, String accountId) {
        return false;
    }

    @Override
    public void verifyActionMeetsPlanRestrictions(String planId, String accountId, Action action) throws ApiException {
        // No-op
    }

    @Override
    public void verifyConfigMeetsPlanRestrictions(String planId, String accountId, ConfigAdmin config) throws ApiException {
        // No-op
    }

    @Override
    public void verifyTeammateInviteMeetsPlanRestrictions(String planId, String projectId, boolean addOne) throws ApiException {
        // No-op
    }

    @Override
    public void verifyProjectCountMeetsPlanRestrictions(String planId, String accountId, boolean addOne) throws ApiException {
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
