// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.util.Extern;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * One-time cleanup ahead of the KillBill removal commit.
 *
 * <p>Scans every local account and applies the post-migration access policy:
 * <ul>
 *   <li>{@code stripeCustomerId != null} → skip (already on Stripe).
 *   <li>{@code planid} ∈ {@link NoOpBilling#NOOP_BILLED_PLAN_IDS} → skip
 *       (free/grandfathered, routed to NoOpBilling, $0/lifetime — correct as-is).
 *   <li>Status {@code ActiveTrial} → skip (still in their KB trial; the patched
 *       Add Card flow can still migrate them onto Stripe before trial ends).
 *   <li>Status {@code Cancelled} → skip (already terminal).
 *   <li>Otherwise → set {@code account.status = Cancelled}. These are KB-routed
 *       paid-plan accounts past their trial without a payment method — once
 *       KillBill is removed, the router would otherwise hand them off to
 *       NoOpBilling and they'd appear active (free access). The policy is opt-out:
 *       to re-engage, the customer contacts support OR clicks Add Card and goes
 *       through the patched Stripe Checkout flow (which sets {@code stripeCustomerId}
 *       and reactivates them on Stripe).
 * </ul>
 *
 * <p>Use {@code dryRun=true} to print the report without mutating anything.
 *
 * <p>Run via JMX MBean
 * {@code com.smotana.clearflask.billing:name=OneShotKbOrphanCleanerOpsMBean},
 * method {@code cancelOrphanKbAccounts(boolean dryRun)}.
 */
@Slf4j
@Singleton
public class OneShotKbOrphanCleaner {

    @Inject
    private AccountStore accountStore;

    @Extern
    public String cancelOrphanKbAccounts(boolean dryRun) {
        StringBuilder report = new StringBuilder("OneShotKbOrphanCleaner: dryRun=")
                .append(dryRun).append("\n");
        AtomicInteger total = new AtomicInteger();
        AtomicInteger skippedStripe = new AtomicInteger();
        AtomicInteger skippedNoOpPlan = new AtomicInteger();
        AtomicInteger skippedTrial = new AtomicInteger();
        AtomicInteger skippedAlreadyCancelled = new AtomicInteger();
        AtomicInteger wouldCancel = new AtomicInteger();
        AtomicInteger cancelled = new AtomicInteger();
        StringBuilder details = new StringBuilder();

        accountStore.listAllAccounts(account -> {
            total.incrementAndGet();
            if (!Strings.isNullOrEmpty(account.getStripeCustomerId())) {
                skippedStripe.incrementAndGet();
                return;
            }
            if (NoOpBilling.NOOP_BILLED_PLAN_IDS.contains(account.getPlanid())) {
                skippedNoOpPlan.incrementAndGet();
                return;
            }
            SubscriptionStatus status = account.getStatus();
            if (status == SubscriptionStatus.ACTIVETRIAL) {
                skippedTrial.incrementAndGet();
                return;
            }
            if (status == SubscriptionStatus.CANCELLED) {
                skippedAlreadyCancelled.incrementAndGet();
                return;
            }
            details.append("  ")
                    .append(dryRun ? "WOULD CANCEL " : "CANCELLING ")
                    .append("accountId=").append(account.getAccountId())
                    .append(" email=").append(account.getEmail())
                    .append(" plan=").append(account.getPlanid())
                    .append(" status=").append(status).append("\n");
            if (dryRun) {
                wouldCancel.incrementAndGet();
            } else {
                try {
                    accountStore.updateStatus(account.getAccountId(),
                            SubscriptionStatus.CANCELLED);
                    cancelled.incrementAndGet();
                } catch (Exception ex) {
                    log.warn("OneShotKbOrphanCleaner: failed to cancel {} ({})",
                            account.getAccountId(), ex.getMessage());
                    details.append("    ERROR: ").append(ex.getMessage()).append("\n");
                }
            }
        });

        report.append("  total scanned: ").append(total).append("\n")
                .append("  skipped (already on Stripe): ").append(skippedStripe).append("\n")
                .append("  skipped (NoOp/$0/grandfathered plan): ").append(skippedNoOpPlan).append("\n")
                .append("  skipped (in active trial): ").append(skippedTrial).append("\n")
                .append("  skipped (already Cancelled): ").append(skippedAlreadyCancelled).append("\n");
        if (dryRun) {
            report.append("  would cancel: ").append(wouldCancel).append("\n");
        } else {
            report.append("  cancelled: ").append(cancelled).append("\n");
        }
        report.append("\n").append(details);
        report.append("OK\n");
        log.info(report.toString());
        return report.toString();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OneShotKbOrphanCleaner.class).asEagerSingleton();
            }
        };
    }
}
