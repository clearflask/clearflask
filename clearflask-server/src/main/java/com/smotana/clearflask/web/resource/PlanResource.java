package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.api.PlanApi;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.PlanStore;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;

@Slf4j
@Singleton
@Path("/v1")
public class PlanResource extends AbstractResource implements PlanApi {

    @Inject
    private PlanStore planStore;

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public PlansGetResponse plansGet() {
        return planStore.plansGet();
    }
}
