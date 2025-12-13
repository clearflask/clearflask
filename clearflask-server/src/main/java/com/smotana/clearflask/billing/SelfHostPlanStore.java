// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.smotana.clearflask.api.model.AllPlansGetResponse;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.store.RemoteLicenseStore;
import com.smotana.clearflask.web.Application;

import java.util.Optional;

public class SelfHostPlanStore implements PlanStore {

    public static final Plan SELF_HOST_UNLIMITED_PLAN = new Plan(
            "self-host",
            "Selfhost Open-Source",
            null,
            ImmutableList.of(),
            false,
            false);
    public static final Plan SELF_HOST_LICENSED_PLAN = new Plan(
            "selfhost-licensed",
            "Selfhost Licensed",
            null,
            ImmutableList.of(),
            false,
            false);
    /**
     * This plan is no longer necessary, by default the unlimited plan is available.
     */
    @Deprecated
    public static final Plan SELF_HOST_FREE_PLAN = new Plan(
            "selfhost-free",
            "Selfhost Limited (Deprecated)",
            null,
            ImmutableList.of(),
            false,
            false);

    @Inject
    private Application.Config configApp;
    @Inject
    private RemoteLicenseStore remoteLicenseStore;

    @Override
    public PlansGetResponse getPublicPlans() {

        return new PlansGetResponse(
                remoteLicenseStore.validateLicenseRemotely(true).isPresent()
                        ? ImmutableList.of(SELF_HOST_LICENSED_PLAN, SELF_HOST_UNLIMITED_PLAN)
                        : ImmutableList.of(SELF_HOST_UNLIMITED_PLAN),
                new FeaturesTable(
                        ImmutableList.of(),
                        ImmutableList.of(),
                        null),
                new FeaturesTable(
                        ImmutableList.of(),
                        ImmutableList.of(),
                        null));
    }

    @Override
    public AllPlansGetResponse getAllPlans() {
        return new AllPlansGetResponse(ImmutableList.of(SELF_HOST_FREE_PLAN, SELF_HOST_LICENSED_PLAN, SELF_HOST_UNLIMITED_PLAN));
    }

    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        return ImmutableSet.of(SELF_HOST_LICENSED_PLAN, SELF_HOST_UNLIMITED_PLAN);
    }

    @Override
    public Optional<Plan> getPlan(String planId, Optional<String> accountIdOpt) {
        return getAllPlans().getPlans().stream()
                .filter(plan -> plan.getBasePlanId().equals(planId))
                .findAny();
    }

    @Override
    public Optional<PlanWithAddons> getCouponPlan(CouponStore.CouponModel coupon, Optional<String> accountId) {
        return getAllPlans().getPlans().stream()
                .filter(plan -> plan.getBasePlanId().equals(coupon.getBasePlanId()))
                .map(plan -> new PlanWithAddons(plan, ImmutableMap.of()))
                .findAny();
    }

    @Override
    public String getBasePlanId(String planId) {
        return planId;
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
