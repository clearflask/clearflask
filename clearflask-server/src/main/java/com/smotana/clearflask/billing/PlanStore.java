package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;

import java.util.Optional;

public interface PlanStore {

    PlansGetResponse getPublicPlans();

    ImmutableSet<Plan> getAccountChangePlanOptions(String accountId);

    Optional<Plan> getPlan(String planId);
}
