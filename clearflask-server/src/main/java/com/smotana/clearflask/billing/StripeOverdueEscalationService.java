// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.ListeningScheduledExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.email.WeeklyDigestService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.SearchAccountsResponse;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Daily job that promotes Stripe-billed accounts from NOPAYMENTMETHOD to BLOCKED after a
 * configurable number of days in that state (default 90, mirroring KillBill's
 * {@code CANCEL_AFTER_DURATION_IN_DAYS}).
 *
 * <p>This restores the KillBill-era account lifecycle for Stripe-routed accounts:
 *
 * <pre>
 *   trial end (day 14) -> NOPAYMENTMETHOD -> [90 days grace] -> BLOCKED -> ProjectDeletionService
 * </pre>
 *
 * Stripe's {@code paused} state (which is where the sub goes when trial ends with no payment
 * method per our {@code trial_settings.end_behavior=PAUSE} config) is a stable state that
 * Stripe never auto-escalates. Without this service the account would sit in
 * NOPAYMENTMETHOD forever and {@link com.smotana.clearflask.core.email.ProjectDeletionService}
 * (which keys on BLOCKED for immediate cleanup eligibility) would never fire.
 *
 * <p>The escalation flow:
 * <ol>
 *   <li>Scan accounts with {@code status == NOPAYMENTMETHOD}.
 *   <li>For each Stripe-billed one ({@code stripeCustomerId != null}) whose
 *       {@code statusChangedAt} is &ge; {@code overdueDays} ago (with fallback to
 *       {@code created} for legacy rows lacking the timestamp).
 *   <li>Re-verify against Stripe (the customer may have just added a card moments ago).
 *   <li>Call {@link StripeBilling#cancelForOverdue(Account)}: marks the sub with metadata
 *       {@link StripeBilling#META_OVERDUE_CANCELLED} then cancels it. The resulting
 *       {@code customer.subscription.deleted} webhook + reconciles map the sub to
 *       {@code BLOCKED} via {@link StripeStatusMapper}.
 *   <li>Set local status to BLOCKED so ProjectDeletionService picks it up on its next run.
 * </ol>
 *
 * <p><b>Legacy account safety</b>: {@code firstRunCutoff} bounds {@code since} from below so
 * that on first deploy, accounts that have already been NOPAYMENTMETHOD for &gt;90d don't get
 * cancelled in one shot. Operator sets this config to deploy-day Instant.
 */
@Slf4j
@Singleton
public class StripeOverdueEscalationService extends ManagedService {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        /**
         * When false, the service logs ACTION REQUIRED warnings instead of actually
         * cancelling subs. Useful for staging or to dry-run before flipping live.
         */
        @DefaultValue("true")
        boolean cancelEnabled();

        /**
         * Number of days an account must remain in NOPAYMENTMETHOD before being escalated
         * to BLOCKED. Mirrors KillBill's CANCEL_AFTER_DURATION_IN_DAYS=90.
         */
        @DefaultValue("90")
        int overdueDays();

        /**
         * Hour-of-day (UTC) when the daily run kicks off. Same pattern as
         * TrialEndingReminderService and ProjectDeletionService.
         */
        @DefaultValue("9")
        int sendAtTime();

        @DefaultValue("300")
        int jitterSeconds();

        @DefaultValue("100")
        int pageSize();

        /**
         * Optional ISO-8601 Instant. If set, {@code since = max(statusChangedAt|created,
         * firstRunCutoff)}. Use this at first deployment to give existing aged-NOPAYMENTMETHOD
         * accounts a fresh 90-day clock from rollout (so they aren't all nuked in one run).
         * Empty string means "no cutoff".
         */
        @DefaultValue("")
        String firstRunCutoff();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private AccountStore accountStore;
    @Inject
    private com.smotana.clearflask.billing.Billing billing;
    @Inject
    private StripeBilling stripeBilling;

    private ListeningScheduledExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        if (!config.enabled()) {
            log.info("StripeOverdueEscalationService disabled by config");
            return;
        }
        executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadScheduledExecutor(
                new ThreadFactoryBuilder().setNameFormat("StripeOverdueEscalation-%d").build()));
        Duration nextRuntime = WeeklyDigestService.getNextRuntime(
                ZonedDateTime.now(ZoneId.of(configApp.zoneId())), config.sendAtTime(), config.jitterSeconds());
        log.info("StripeOverdueEscalationService next runtime {} (overdueDays={}, cancelEnabled={})",
                nextRuntime, config.overdueDays(), config.cancelEnabled());
        executor.scheduleAtFixedRate(this::processAllSafely, nextRuntime, Duration.ofDays(1));
    }

    @Override
    protected void serviceStop() throws Exception {
        if (executor != null) {
            executor.shutdownNow();
            executor.awaitTermination(30, TimeUnit.SECONDS);
        }
    }

    private void processAllSafely() {
        try {
            processAll();
        } catch (Exception ex) {
            log.error("StripeOverdueEscalationService.processAll failed", ex);
        }
    }

    @Extern
    public synchronized String processAll() {
        if (!config.enabled()) {
            return "disabled";
        }
        Instant cutoff = parseCutoff();
        long scanned = 0;
        long eligible = 0;
        long escalated = 0;
        Optional<String> cursorOpt = Optional.empty();
        do {
            SearchAccountsResponse page = accountStore.searchAccounts(
                    AccountSearchSuperAdmin.builder()
                            .filterStatus(ImmutableList.of(SubscriptionStatus.NOPAYMENTMETHOD))
                            .build(),
                    true,
                    cursorOpt,
                    Optional.of(config.pageSize()));
            cursorOpt = page.getCursorOpt();
            for (Account account : page.getAccounts()) {
                scanned++;
                try {
                    Result r = processAccount(account, cutoff);
                    if (r == Result.ELIGIBLE_DRYRUN) eligible++;
                    if (r == Result.ESCALATED) escalated++;
                } catch (Exception ex) {
                    log.warn("StripeOverdueEscalation: failed for account {} {} (continuing)",
                            account.getEmail(), account.getAccountId(), ex);
                }
            }
        } while (cursorOpt.isPresent());
        String summary = String.format("StripeOverdueEscalation done: scanned=%d eligible=%d escalated=%d",
                scanned, eligible, escalated);
        log.info(summary);
        return summary;
    }

    private enum Result { SKIPPED, ELIGIBLE_DRYRUN, ESCALATED }

    private Result processAccount(Account a, Instant cutoff) {
        if (Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return Result.SKIPPED; // KB-routed or grandfathered
        }
        if (!SubscriptionStatus.NOPAYMENTMETHOD.equals(a.getStatus())) {
            return Result.SKIPPED;
        }
        Instant since = a.getStatusChangedAt() != null ? a.getStatusChangedAt() : a.getCreated();
        if (since == null) {
            log.warn("StripeOverdueEscalation: account {} has no statusChangedAt or created; skipping", a.getAccountId());
            return Result.SKIPPED;
        }
        if (cutoff != null && since.isBefore(cutoff)) {
            since = cutoff;
        }
        Instant cutoffForOverdue = Instant.now().minus(config.overdueDays(), ChronoUnit.DAYS);
        if (since.isAfter(cutoffForOverdue)) {
            return Result.SKIPPED; // not yet 90 days
        }

        // Re-verify live in case the customer just added a payment method or otherwise
        // recovered. updateAndGetEntitlementStatus pulls from Stripe and flips local status
        // if it changed.
        SubscriptionStatus verified;
        try {
            verified = billing.updateAndGetEntitlementStatus(
                    a.getStatus(),
                    billing.getAccount(a.getAccountId()),
                    billing.getSubscription(a.getAccountId()),
                    "StripeOverdueEscalation precheck");
        } catch (Exception ex) {
            log.warn("StripeOverdueEscalation: precheck failed for {} (skipping)", a.getAccountId(), ex);
            return Result.SKIPPED;
        }
        if (!SubscriptionStatus.NOPAYMENTMETHOD.equals(verified)) {
            log.info("StripeOverdueEscalation: account {} precheck flipped to {} -- skipping",
                    a.getAccountId(), verified);
            return Result.SKIPPED;
        }

        if (!config.cancelEnabled()) {
            log.warn("ACTION REQUIRED: account {} ({}) is overdue {} days; would cancel (cancelEnabled=false)",
                    a.getEmail(), a.getAccountId(),
                    ChronoUnit.DAYS.between(since, Instant.now()));
            return Result.ELIGIBLE_DRYRUN;
        }

        // (1) mark + (2) cancel via StripeBilling helper. Best-effort.
        stripeBilling.cancelForOverdue(a);
        // (3) flip local status; conditional updateStatus on DDB will set statusChangedAt=now.
        accountStore.updateStatus(a.getAccountId(), SubscriptionStatus.BLOCKED);
        log.info("StripeOverdueEscalation: escalated account {} ({}) to BLOCKED after {} days",
                a.getEmail(), a.getAccountId(),
                ChronoUnit.DAYS.between(since, Instant.now()));
        return Result.ESCALATED;
    }

    private Instant parseCutoff() {
        String raw = config.firstRunCutoff();
        if (Strings.isNullOrEmpty(raw)) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (Exception ex) {
            log.warn("StripeOverdueEscalation: failed to parse firstRunCutoff '{}' (ignoring)", raw);
            return null;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeOverdueEscalationService.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding()
                        .to(StripeOverdueEscalationService.class).asEagerSingleton();
            }
        };
    }
}
