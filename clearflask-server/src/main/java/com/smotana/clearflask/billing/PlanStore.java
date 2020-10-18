package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.web.ErrorWithMessageException;

import java.util.Optional;

public interface PlanStore {

    /** If changed, also update PricingPage.tsx */
    long STOP_TRIAL_AFTER_ACTIVE_USERS_REACHES = 10;

    PlansGetResponse getPublicPlans();

    ImmutableSet<Plan> getAccountChangePlanOptions(String accountId);

    Optional<Plan> getPlan(String planId);

    void verifyConfigMeetsPlanRestrictions(String planId, ConfigAdmin config) throws ErrorWithMessageException;
}
