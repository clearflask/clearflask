// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.AllPlansGetResponse;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.billing.CouponStore.CouponModel;
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
     * If changed, also update PricingPage.tsx
     */
    ImmutableSet<String> LIFETIME_TEAMMATES_FOR_PLANS = ImmutableSet.of("lifetime2-lifetime");
    /**
     * If changed, also update PricingPage.tsx
     */
    ImmutableSet<String> ALLOW_USER_CHOOSE_PRICING_FOR_PLANS = ImmutableSet.of("sponsor-monthly");
    /**
     * If changed, also update PricingSlider.tsx
     */
    long ALLOW_USER_CHOOSE_PRICING_MIN = 1;
    /**
     * If changed, also update PricingSlider.tsx
     */
    long ALLOW_USER_CHOOSE_PRICING_MAX = 200;

    /**
     * Plan used for accounts with only external accounts.
     * <p>
     * If changed, also update UpgradeWrapper.tsx
     */
    String TEAMMATE_PLAN_ID = "teammate-unlimited";

    ImmutableSet<String> PLANS_WITHOUT_TRIAL = ImmutableSet.of(
            "starter-unlimited",
            "standard-unlimited",
            "standard2-unlimited",
            TEAMMATE_PLAN_ID,
            "pro-lifetime",
            "pitchground-a-lifetime",
            "pitchground-b-lifetime",
            "pitchground-c-lifetime",
            "pitchground-d-lifetime",
            "pitchground-e-lifetime",
            "cloud-free",
            "selfhost-monthly",
            "selfhost-yearly",
            "selfhost-yearly2");

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

    default String prettifyPlanName(String planIdOrPrettyPlanName) {
        if (planIdOrPrettyPlanName.contains("-")) {
            // Most likely this is not a pretty plan name, just a plan id
            return getPlan(planIdOrPrettyPlanName, Optional.empty())
                    .map(Plan::getTitle)
                    .map(name -> name + " Plan")
                    .orElse(planIdOrPrettyPlanName);
        }
        return planIdOrPrettyPlanName;
    }

    /**
     * Check if the given plan is a free plan (no billing required).
     */
    default boolean isFreePlan(String planId) {
        return "cloud-free".equals(planId) || planId.startsWith("free-");
    }

    /**
     * Get the Stripe Price ID for a given plan.
     * Used for direct Stripe billing.
     */
    Optional<String> getStripePriceId(String planId);

    /**
     * Get the trial period in days for a given plan.
     * Returns empty if no trial period.
     */
    Optional<Long> getTrialDays(String planId);

    @Value
    class PlanWithAddons {
        @NonNull
        Plan plan;

        @NonNull
        ImmutableMap<String, String> addons;
    }

}
