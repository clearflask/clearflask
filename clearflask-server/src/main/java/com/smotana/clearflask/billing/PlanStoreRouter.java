// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.smotana.clearflask.api.model.AllPlansGetResponse;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.store.AccountStore;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

/**
 * Routes {@link PlanStore} calls between {@link KillBillPlanStore} and {@link StripePlanStore}.
 *
 * <p>Account-scoped queries (getPlan/getCouponPlan/getAccountChangePlanOptions with an
 * accountId) route by {@code stripeCustomerId}: present -> Stripe, otherwise KillBill.
 *
 * <p>Global queries (getPublicPlans, getAllPlans, getBasePlanId) route by the
 * {@code useStripeForNewSignups} config flag — the same flag that controls signup routing
 * in {@link BillingRouter}. While the flag is false, the public pricing page reads from
 * KillBill's catalog021.xml (today's behavior). When flipped, it reads from Stripe.
 *
 * <p>Coupon redemptions: clearflask coupons are local to {@link CouponStore} and grant
 * grandfathered/lifetime plans; the underlying plan info comes from whichever store
 * contains it. Both are tried when needed.
 */
@Slf4j
@Singleton
public class PlanStoreRouter implements PlanStore {

    @Inject
    private BillingRouter.Config config;
    @Inject
    private AccountStore accountStore;
    @Inject
    @Named("legacy")
    private PlanStore legacyPlanStore;
    @Inject
    @Named("stripe")
    private PlanStore stripePlanStore;

    private PlanStore primary() {
        return config.useStripeForNewSignups() ? stripePlanStore : legacyPlanStore;
    }

    private PlanStore pickByAccount(String accountId) {
        if (Strings.isNullOrEmpty(accountId)) {
            return primary();
        }
        Optional<AccountStore.Account> a = accountStore.getAccount(accountId, true);
        if (a.isPresent() && !Strings.isNullOrEmpty(a.get().getStripeCustomerId())) {
            return stripePlanStore;
        }
        return primary();
    }

    @Override
    public PlansGetResponse getPublicPlans() {
        PlansGetResponse r = primary().getPublicPlans();
        if (r == null || r.getPlans() == null || r.getPlans().isEmpty()) {
            // Stripe primary, but no Products provisioned yet (or Stripe call failed). Fall
            // back to KillBill so the public pricing/signup page renders something rather
            // than crashing.
            log.warn("PlanStoreRouter.getPublicPlans: primary returned empty, falling back to legacy plan catalog");
            return legacyPlanStore.getPublicPlans();
        }
        // Stripe primary returns its plan list but does NOT own the comparison tables -- those
        // describe plan-family capabilities (Cloud vs Self-host) and are sourced from
        // KillBillPlanStore. Merge them in when the primary left them empty so /pricing renders
        // the full Features comparison table.
        if (isFeaturesTableEmpty(r.getFeaturesTable()) || isFeaturesTableEmpty(r.getFeaturesTableSelfhost())) {
            PlansGetResponse kb = legacyPlanStore.getPublicPlans();
            return new PlansGetResponse(
                    r.getPlans(),
                    isFeaturesTableEmpty(r.getFeaturesTable()) ? kb.getFeaturesTable() : r.getFeaturesTable(),
                    isFeaturesTableEmpty(r.getFeaturesTableSelfhost()) ? kb.getFeaturesTableSelfhost() : r.getFeaturesTableSelfhost());
        }
        return r;
    }

    private static boolean isFeaturesTableEmpty(com.smotana.clearflask.api.model.FeaturesTable t) {
        return t == null || t.getFeatures() == null || t.getFeatures().isEmpty();
    }

    @Override
    public AllPlansGetResponse getAllPlans() {
        AllPlansGetResponse r = primary().getAllPlans();
        if (r != null && r.getPlans() != null && !r.getPlans().isEmpty()) {
            return r;
        }
        log.warn("PlanStoreRouter.getAllPlans: primary returned empty, falling back to legacy plan catalog");
        return legacyPlanStore.getAllPlans();
    }

    @Override
    public ImmutableSet<Plan> getAccountChangePlanOptions(String accountId) {
        return pickByAccount(accountId).getAccountChangePlanOptions(accountId);
    }

    @Override
    public Optional<Plan> getPlan(String planId, Optional<String> accountIdOpt) {
        PlanStore picked = pickByAccount(accountIdOpt.orElse(null));
        Optional<Plan> p = picked.getPlan(planId, accountIdOpt);
        if (p.isPresent()) return p;
        // Fallback to the other store -- coupon-applied lifetime/grandfathered plans live in
        // KillBillPlanStore even when the primary mode is Stripe.
        PlanStore fallback = (picked == stripePlanStore) ? legacyPlanStore : stripePlanStore;
        return fallback.getPlan(planId, accountIdOpt);
    }

    @Override
    public Optional<PlanWithAddons> getCouponPlan(CouponStore.CouponModel coupon, Optional<String> accountIdOpt) {
        Optional<PlanWithAddons> p = primary().getCouponPlan(coupon, accountIdOpt);
        if (p.isPresent()) return p;
        PlanStore fallback = primary() == legacyPlanStore ? stripePlanStore : legacyPlanStore;
        return fallback.getCouponPlan(coupon, accountIdOpt);
    }

    @Override
    public String getBasePlanId(String planId) {
        return primary().getBasePlanId(planId);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PlanStoreRouter.class).asEagerSingleton();
                bind(PlanStore.class).to(PlanStoreRouter.class).asEagerSingleton();
            }
        };
    }
}
