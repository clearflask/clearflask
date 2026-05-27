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
    @Named("killbill")
    private PlanStore killBillPlanStore;
    @Inject
    @Named("stripe")
    private PlanStore stripePlanStore;

    private PlanStore primary() {
        return config.useStripeForNewSignups() ? stripePlanStore : killBillPlanStore;
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
        if (r != null && r.getPlans() != null && !r.getPlans().isEmpty()) {
            return r;
        }
        // Stripe primary, but no Products provisioned yet (or Stripe call failed). Fall back
        // to KillBill so the public pricing/signup page renders something rather than crashing.
        log.warn("PlanStoreRouter.getPublicPlans: primary returned empty, falling back to KillBill catalog");
        return killBillPlanStore.getPublicPlans();
    }

    @Override
    public AllPlansGetResponse getAllPlans() {
        AllPlansGetResponse r = primary().getAllPlans();
        if (r != null && r.getPlans() != null && !r.getPlans().isEmpty()) {
            return r;
        }
        log.warn("PlanStoreRouter.getAllPlans: primary returned empty, falling back to KillBill catalog");
        return killBillPlanStore.getAllPlans();
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
        PlanStore fallback = (picked == stripePlanStore) ? killBillPlanStore : stripePlanStore;
        return fallback.getPlan(planId, accountIdOpt);
    }

    @Override
    public Optional<PlanWithAddons> getCouponPlan(CouponStore.CouponModel coupon, Optional<String> accountIdOpt) {
        Optional<PlanWithAddons> p = primary().getCouponPlan(coupon, accountIdOpt);
        if (p.isPresent()) return p;
        PlanStore fallback = primary() == killBillPlanStore ? stripePlanStore : killBillPlanStore;
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
