// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.AllPlansGetResponse;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.billing.CouponStore.CouponModel;
import com.smotana.clearflask.web.ApiException;
import lombok.NonNull;
import lombok.Value;

import java.util.Optional;

public interface PlanStore {

    /**
     * If changed, also update PricingPage.tsx
     */
    long STOP_TRIAL_AFTER_ACTIVE_USERS_REACHES = 10;
    /**
     * If changed, also update PricingPage.tsx
     */
    ImmutableSet<String> STOP_TRIAL_FOR_PLANS = ImmutableSet.of("growth-monthly", "standard-monthly");
    /**
     * If changed, also update PricingPage.tsx
     */
    ImmutableSet<String> RECORD_TRACKED_USERS_FOR_PLANS = ImmutableSet.of("growth2-monthly", "standard2-monthly");
    /**
     * If changed, also update PricingPage.tsx
     */
    ImmutableSet<String> RECORD_TEAMMATES_FOR_PLANS = ImmutableSet.of("standard3-monthly");

    /**
     * Plan used for accounts with only external accounts.
     * <p>
     * If changed, also update UpgradeWrapper.tsx
     */
    String TEAMMATE_PLAN_ID = "teammate-unlimited";

    ImmutableSet<String> PLANS_WITHOUT_TRIAL = ImmutableSet.of(
            "starter-unlimited",
            "standard-unlimited",
            TEAMMATE_PLAN_ID,
            "pro-lifetime",
            "pitchground-a-lifetime",
            "pitchground-b-lifetime",
            "pitchground-c-lifetime",
            "pitchground-d-lifetime",
            "pitchground-e-lifetime");

    PlansGetResponse getPublicPlans();

    AllPlansGetResponse getAllPlans();

    ImmutableSet<Plan> getAccountChangePlanOptions(String accountId);

    /**
     * If subscription is passed, pricing reflects actual pricing for account
     */
    Optional<Plan> getPlan(String planId, Optional<String> accountIdOpt);

    /**
     * Gets plan to be applied if given coupon is used. Takes care of stacking
     */
    Optional<PlanWithAddons> getCouponPlan(CouponModel coupon, Optional<String> accountIdOpt);

    /**
     * Strips suffix from planId appended by KillBill during price override
     */
    String getBasePlanId(String planId);

    String prettifyPlanName(String planIdOrPrettyPlanName);

    void verifyAccountMeetsPlanRestrictions(String planId, String accountId) throws ApiException;

    void verifyAccountMeetsLimits(String planId, String accountId) throws ApiException;

    boolean isAccountExceedsPostLimit(String planId, String accountId);

    void verifyActionMeetsPlanRestrictions(String planId, String accountId, Action action) throws ApiException;

    void verifyConfigMeetsPlanRestrictions(String planId, String accountId, ConfigAdmin config) throws ApiException;

    void verifyConfigChangeMeetsRestrictions(boolean isSuperAdmin, Optional<ConfigAdmin> configAdminPreviousOpt, ConfigAdmin config) throws ApiException;

    void verifyTeammateInviteMeetsPlanRestrictions(String planId, String projectId, boolean addOne) throws ApiException;

    void verifyProjectCountMeetsPlanRestrictions(String planId, String accountId, boolean addOne) throws ApiException;

    enum Action {
        API_KEY,
        CREATE_PROJECT
    }

    @Value
    class PlanWithAddons {
        @NonNull
        Plan plan;

        @NonNull
        ImmutableMap<String, String> addons;
    }

}
