package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;

import java.util.Optional;

public interface PlanStore {

    PlansGetResponse plansGet();

    ImmutableSet<Plan> mapIdsToPlans(ImmutableSet<String> planIds);

    Plan getTrialPlan();

    Optional<Plan> getPlan(String planId);
}
