// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.stripe.model.Subscription;
import org.junit.Test;

import java.util.function.BooleanSupplier;

import static org.junit.Assert.assertEquals;

public class StripeStatusMapperTest {

    private static final BooleanSupplier WITHIN_LIMITS = () -> false;
    private static final BooleanSupplier OVER_LIMITS = () -> true;

    @Test
    public void nullSubscription_blocked() {
        assertEquals(SubscriptionStatus.BLOCKED, StripeStatusMapper.map(null, true, WITHIN_LIMITS));
    }

    @Test
    public void unknownStatus_active() {
        // Defaults to ACTIVE (with warn log) so a new Stripe status doesn't suddenly
        // lock paying customers out. Mirrors KillBilling.getEntitlementStatus default.
        assertEquals(SubscriptionStatus.ACTIVE, StripeStatusMapper.map(stripeSub("future_unknown", false), true, WITHIN_LIMITS));
        assertEquals(SubscriptionStatus.ACTIVE, StripeStatusMapper.map(stripeSub("future_unknown", false), false, WITHIN_LIMITS));
        // LIMITED overlay still applies.
        assertEquals(SubscriptionStatus.LIMITED, StripeStatusMapper.map(stripeSub("future_unknown", false), true, OVER_LIMITS));
    }

    @Test
    public void nullStatus_active() {
        Subscription s = new Subscription();
        s.setStatus(null);
        assertEquals(SubscriptionStatus.ACTIVE, StripeStatusMapper.map(s, true, WITHIN_LIMITS));
    }

    @Test
    public void trialing_active() {
        assertEquals(SubscriptionStatus.ACTIVETRIAL, StripeStatusMapper.map(stripeSub("trialing", false), true, WITHIN_LIMITS));
        assertEquals(SubscriptionStatus.ACTIVETRIAL, StripeStatusMapper.map(stripeSub("trialing", false), false, WITHIN_LIMITS));
    }

    @Test
    public void trialing_overLimits_limited() {
        assertEquals(SubscriptionStatus.LIMITED, StripeStatusMapper.map(stripeSub("trialing", false), true, OVER_LIMITS));
    }

    @Test
    public void trialing_pendingCancel_activeNoRenewal() {
        // User cancelled mid-trial. Stripe keeps the sub trialing with cancel_at_period_end=true.
        // UI should reflect "will not renew", not "automatic payment is active".
        assertEquals(SubscriptionStatus.ACTIVENORENEWAL, StripeStatusMapper.map(stripeSub("trialing", true), true, WITHIN_LIMITS));
        assertEquals(SubscriptionStatus.ACTIVENORENEWAL, StripeStatusMapper.map(stripeSub("trialing", true), false, WITHIN_LIMITS));
    }

    @Test
    public void active_renewing_active() {
        assertEquals(SubscriptionStatus.ACTIVE, StripeStatusMapper.map(stripeSub("active", false), true, WITHIN_LIMITS));
    }

    @Test
    public void active_pendingCancel_activeNoRenewal() {
        assertEquals(SubscriptionStatus.ACTIVENORENEWAL, StripeStatusMapper.map(stripeSub("active", true), true, WITHIN_LIMITS));
    }

    @Test
    public void active_overLimits_limited() {
        assertEquals(SubscriptionStatus.LIMITED, StripeStatusMapper.map(stripeSub("active", false), true, OVER_LIMITS));
        assertEquals(SubscriptionStatus.LIMITED, StripeStatusMapper.map(stripeSub("active", true), true, OVER_LIMITS));
    }

    @Test
    public void pastDue_withPaymentMethod_retry() {
        assertEquals(SubscriptionStatus.ACTIVEPAYMENTRETRY, StripeStatusMapper.map(stripeSub("past_due", false), true, WITHIN_LIMITS));
    }

    @Test
    public void pastDue_withoutPaymentMethod_noPaymentMethod() {
        assertEquals(SubscriptionStatus.NOPAYMENTMETHOD, StripeStatusMapper.map(stripeSub("past_due", false), false, WITHIN_LIMITS));
    }

    @Test
    public void incomplete_noPaymentMethod() {
        assertEquals(SubscriptionStatus.NOPAYMENTMETHOD, StripeStatusMapper.map(stripeSub("incomplete", false), false, WITHIN_LIMITS));
        assertEquals(SubscriptionStatus.NOPAYMENTMETHOD, StripeStatusMapper.map(stripeSub("incomplete", false), true, WITHIN_LIMITS));
    }

    @Test
    public void unpaid_blocked() {
        assertEquals(SubscriptionStatus.BLOCKED, StripeStatusMapper.map(stripeSub("unpaid", false), true, WITHIN_LIMITS));
    }

    @Test
    public void incompleteExpired_blocked() {
        assertEquals(SubscriptionStatus.BLOCKED, StripeStatusMapper.map(stripeSub("incomplete_expired", false), false, WITHIN_LIMITS));
    }

    @Test
    public void paused_noPaymentMethod() {
        // Stripe transitions a trialing sub to "paused" at trial end when no payment method
        // was added (per trial_settings.end_behavior=PAUSE). This is the grace state, not
        // a terminal block -- mirrors KillBill's NOPAYMENTMETHOD.
        assertEquals(SubscriptionStatus.NOPAYMENTMETHOD, StripeStatusMapper.map(stripeSub("paused", false), false, WITHIN_LIMITS));
        assertEquals(SubscriptionStatus.NOPAYMENTMETHOD, StripeStatusMapper.map(stripeSub("paused", false), true, WITHIN_LIMITS));
    }

    @Test
    public void canceled_customerInitiated() {
        // No overdue marker -> normal cancel, maps to CANCELLED.
        assertEquals(SubscriptionStatus.CANCELLED, StripeStatusMapper.map(stripeSub("canceled", false), true, WITHIN_LIMITS));
        assertEquals(SubscriptionStatus.CANCELLED, StripeStatusMapper.map(stripeSub("canceled", true), false, WITHIN_LIMITS));
    }

    @Test
    public void canceled_overdueEscalation_blocked() {
        // Sub cancelled by StripeOverdueEscalationService -> tagged with the overdue marker
        // metadata BEFORE cancel. The resulting canceled-with-marker maps to BLOCKED so the
        // existing ProjectDeletionService cleanup pipeline keys correctly.
        Subscription s = stripeSub("canceled", false);
        s.setMetadata(java.util.Map.of(com.smotana.clearflask.billing.StripeBilling.META_OVERDUE_CANCELLED, "true"));
        assertEquals(SubscriptionStatus.BLOCKED, StripeStatusMapper.map(s, false, WITHIN_LIMITS));
        assertEquals(SubscriptionStatus.BLOCKED, StripeStatusMapper.map(s, true, WITHIN_LIMITS));
    }

    private static Subscription stripeSub(String status, boolean cancelAtPeriodEnd) {
        Subscription s = new Subscription();
        s.setStatus(status);
        s.setCancelAtPeriodEnd(cancelAtPeriodEnd);
        return s;
    }
}
