// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.stripe.model.Subscription;
import lombok.extern.slf4j.Slf4j;

import java.util.function.BooleanSupplier;

import static com.smotana.clearflask.api.model.SubscriptionStatus.ACTIVE;
import static com.smotana.clearflask.api.model.SubscriptionStatus.ACTIVENORENEWAL;
import static com.smotana.clearflask.api.model.SubscriptionStatus.ACTIVEPAYMENTRETRY;
import static com.smotana.clearflask.api.model.SubscriptionStatus.ACTIVETRIAL;
import static com.smotana.clearflask.api.model.SubscriptionStatus.BLOCKED;
import static com.smotana.clearflask.api.model.SubscriptionStatus.CANCELLED;
import static com.smotana.clearflask.api.model.SubscriptionStatus.LIMITED;
import static com.smotana.clearflask.api.model.SubscriptionStatus.NOPAYMENTMETHOD;

/**
 * Pure mapping from a Stripe Subscription's state to ClearFlask's SubscriptionStatus enum.
 * Mirrors the state machine in {@link KillBilling#getEntitlementStatus} so existing
 * downstream behavior (entitlement checks, trial-end notifications, etc.) keeps working
 * unchanged regardless of which billing backend is active.
 *
 * <p>Stripe subscription.status values handled:
 * <ul>
 *   <li>{@code trialing}           &mdash; {@link SubscriptionStatus#ACTIVETRIAL} when renewing,
 *       or {@link SubscriptionStatus#ACTIVENORENEWAL} when the user cancelled mid-trial
 *       ({@code cancel_at_period_end=true})
 *   <li>{@code active}             &mdash; {@link SubscriptionStatus#ACTIVE} normally,
 *       {@link SubscriptionStatus#ACTIVENORENEWAL} when cancellation is pending at period end
 *   <li>{@code past_due}           &mdash; {@link SubscriptionStatus#ACTIVEPAYMENTRETRY}
 *       (with payment method, retries in progress) or {@link SubscriptionStatus#NOPAYMENTMETHOD}
 *       (without)
 *   <li>{@code incomplete}         &mdash; {@link SubscriptionStatus#NOPAYMENTMETHOD}
 *       (initial signup never authorized a card; 24h to recover before Stripe expires it)
 *   <li>{@code paused}             &mdash; {@link SubscriptionStatus#NOPAYMENTMETHOD}
 *       (trial ended without a payment method per {@code trial_settings.end_behavior=PAUSE};
 *       recoverable by adding a card via Customer Portal)
 *   <li>{@code incomplete_expired} &mdash; {@link SubscriptionStatus#BLOCKED} (24h-no-action
 *       terminal)
 *   <li>{@code unpaid}             &mdash; {@link SubscriptionStatus#BLOCKED} (Stripe Smart
 *       Retries exhausted, dashboard set to "Mark uncollectible")
 *   <li>{@code canceled} + metadata {@code clearflask_overdue_cancelled=true} &mdash;
 *       {@link SubscriptionStatus#BLOCKED} (cancelled by our overdue-escalation path; tagged
 *       so it distinguishes from user-initiated cancel)
 *   <li>{@code canceled} (no marker) &mdash; {@link SubscriptionStatus#CANCELLED}
 *       (user-initiated cancellation via Customer Portal)
 *   <li>any unrecognized status (or null status on an existing sub) &mdash; defaults to
 *       {@link SubscriptionStatus#ACTIVE} with a warning log so a new-and-unrecognized Stripe
 *       status doesn't suddenly lock paying customers out. Mirrors KillBill's safe-fallback
 *       choice (see {@code KillBilling.getEntitlementStatus} default branch).
 *   <li>{@code null} subscription (no sub object at all) &mdash; {@link SubscriptionStatus#BLOCKED}.
 *       Distinct from the unknown-status case: no sub means no billing relationship and the
 *       caller is responsible for surfacing this.
 * </ul>
 *
 * <p>{@link SubscriptionStatus#LIMITED} overlay: when {@code isLimited} returns true for an
 * otherwise-active state (trialing, active), the result is downgraded to LIMITED so the
 * existing plan-limit gating UI fires correctly.
 */
@Slf4j
public final class StripeStatusMapper {

    private StripeStatusMapper() {
    }

    public static SubscriptionStatus map(Subscription stripeSub, boolean hasPaymentMethod, BooleanSupplier isLimited) {
        if (stripeSub == null) {
            return BLOCKED;
        }
        String status = stripeSub.getStatus();
        Boolean cancelAtPeriodEnd = stripeSub.getCancelAtPeriodEnd();
        boolean willCancel = cancelAtPeriodEnd != null && cancelAtPeriodEnd;

        if (status == null) {
            log.warn("StripeStatusMapper: null status on Stripe sub {} -- defaulting to ACTIVE", stripeSub.getId());
            return isLimited.getAsBoolean() ? LIMITED : ACTIVE;
        }
        switch (status) {
            case "trialing":
                // User cancelled mid-trial (sub is still trialing but won't renew). Surface
                // the cancellation in the UI rather than the misleading "automatic payment is
                // active" copy that ACTIVETRIAL drives.
                if (willCancel) {
                    return isLimited.getAsBoolean() ? LIMITED : ACTIVENORENEWAL;
                }
                return isLimited.getAsBoolean() ? LIMITED : ACTIVETRIAL;
            case "active":
                if (willCancel) {
                    return isLimited.getAsBoolean() ? LIMITED : ACTIVENORENEWAL;
                }
                return isLimited.getAsBoolean() ? LIMITED : ACTIVE;
            case "past_due":
                return hasPaymentMethod ? ACTIVEPAYMENTRETRY : NOPAYMENTMETHOD;
            case "incomplete":
            case "paused":
                // `paused` is what Stripe transitions a trialing sub to at trial end when
                // no payment method was added (per our trial_settings.end_behavior=PAUSE
                // config). This is the grace state -- mirrors KillBill's NOPAYMENTMETHOD:
                // the customer can recover by adding a card. NOT a terminal block.
                return NOPAYMENTMETHOD;
            case "unpaid":
                // Terminal state: Stripe's Smart Retries gave up after the configured
                // retry schedule (set in dashboard "Manage failed payments"). This is the
                // real "blocked" condition.
                return BLOCKED;
            case "incomplete_expired":
                return BLOCKED;
            case "canceled":
                // Distinguish "overdue-cancelled by us" from "explicitly cancelled by customer".
                // The overdue-escalation path tags the sub with META_OVERDUE_CANCELLED before
                // cancelling, so the resulting webhook + reconciles map to BLOCKED (matching
                // KillBill's overdue-cancelled semantics). Customer Portal cancellations leave
                // the metadata absent and map to CANCELLED.
                if (stripeSub.getMetadata() != null
                        && "true".equals(stripeSub.getMetadata().get(StripeBilling.META_OVERDUE_CANCELLED))) {
                    return BLOCKED;
                }
                return CANCELLED;
            default:
                // Unknown / future Stripe status. Don't lock customers out; surface for ops.
                // Mirrors KillBill's default-to-ACTIVE-with-error-log choice.
                log.warn("StripeStatusMapper: unknown Stripe status '{}' on sub {} -- defaulting to ACTIVE",
                        status, stripeSub.getId());
                return isLimited.getAsBoolean() ? LIMITED : ACTIVE;
        }
    }
}
