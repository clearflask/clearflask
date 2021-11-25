// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.AllPlansGetResponse;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.web.ApiException;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;

public interface PlanStore {

    /** If changed, also update PricingPage.tsx */
    long STOP_TRIAL_AFTER_ACTIVE_USERS_REACHES = 10;
    /** If changed, also update PricingPage.tsx */
    ImmutableSet<String> STOP_TRIAL_FOR_PLANS = ImmutableSet.of("growth-monthly", "standard-monthly");
    /** If changed, also update PricingPage.tsx */
    ImmutableSet<String> RECORD_TRACKED_USERS_FOR_PLANS = ImmutableSet.of("growth2-monthly", "standard2-monthly");

    /**
     * Plan used for accounts with only external accounts.
     *
     * If changed, also update UpgradeWrapper.tsx
     */
    String TEAMMATE_PLAN_ID = "teammate-unlimited";

    ImmutableSet<String> PLANS_WITHOUT_TRIAL = ImmutableSet.of(TEAMMATE_PLAN_ID, "pro-lifetime");

    PlansGetResponse getPublicPlans();

    AllPlansGetResponse getAllPlans();

    ImmutableSet<Plan> getAccountChangePlanOptions(String accountId);

    /** If subscription is passed, pricing reflects actual pricing for account */
    Optional<Plan> getPlan(String planId, Optional<Subscription> subscriptionOpt);

    /** Strips suffix from planId appended by KillBill during price override */
    String getBasePlanId(String planId);

    String prettifyPlanName(String planIdOrPrettyPlanName);

    void verifyAccountMeetsPlanRestrictions(String planId, String accountId) throws ApiException;

    void verifyActionMeetsPlanRestrictions(String planId, String accountId, Action action) throws ApiException;

    void verifyConfigMeetsPlanRestrictions(String planId, ConfigAdmin config) throws ApiException;

    void verifyTeammateInviteMeetsPlanRestrictions(String planId, String projectId, boolean addOne) throws ApiException;

    void verifyProjectCountMeetsPlanRestrictions(String planId, String accountId, boolean addOne) throws ApiException;

    enum Action {
        API_KEY,
        CREATE_PROJECT
    }
}
