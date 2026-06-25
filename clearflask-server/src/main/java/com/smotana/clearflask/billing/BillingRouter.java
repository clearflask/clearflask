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
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.PlanDetail;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;
import java.util.UUID;

/**
 * Single source of truth for which {@link Billing} implementation handles each operation.
 *
 * <p>Routing decision is made per-call by inspecting the target account's
 * {@code stripeCustomerId} and {@code planid} (and the runtime environment for self-hosted
 * deployments). The router itself implements {@link Billing} and delegates each method to
 * the chosen backend.
 *
 * <p>Routing rules (in priority order):
 * <ol>
 *   <li>If running in PRODUCTION_SELF_HOST environment, the router is bypassed entirely:
 *       ServiceInjector binds {@link Billing} directly to {@link SelfHostBilling}.
 *   <li>{@code account.stripeCustomerId != null} -&gt; {@link StripeBilling}.
 *       Once an account has a Stripe customer it stays on Stripe forever.
 *   <li>{@code account.planid} is in the NoOp set AND the {@code routeGrandfatheredToNoOp}
 *       config flag is enabled -&gt; {@link NoOpBilling}. (Phase 2+: lets grandfathered $0
 *       customers exist without any external billing artifacts.)
 *   <li>Otherwise -&gt; {@link KillBilling} during the migration; replace with
 *       {@link NoOpBilling} once KillBill is removed.
 * </ol>
 *
 * <p>Special-case methods that take a KillBill UUID rather than an accountId
 * ({@link #getAccountByKbId} and {@link #getActions}) route to KillBilling unconditionally
 * since by definition only KillBilling produces those UUIDs. Stripe-managed accounts are
 * never looked up by KB UUID.
 *
 * <p>The signup path ({@link #createAccountWithSubscriptionAsync}) is the one place where
 * the routing key changes mid-call: based on the {@code useStripeForNewSignups} config flag
 * and the target plan, new signups are created on either Stripe or KillBill. After that the
 * stripeCustomerId field tells the router where to send subsequent calls.
 */
@Slf4j
@Singleton
public class BillingRouter implements Billing {

    public interface Config {
        /**
         * Phase 1: false (all new signups go to KillBilling).
         * Phase 2: true (new paid signups go to StripeBilling; new grandfathered signups to NoOpBilling).
         */
        @DefaultValue("false")
        boolean useStripeForNewSignups();

        /**
         * Phase 1: false (grandfathered accounts continue on KillBilling).
         * Phase 2+: true (grandfathered accounts route to NoOpBilling, no external billing artifact).
         */
        @DefaultValue("false")
        boolean routeGrandfatheredToNoOp();

        /**
         * The "orphan" bucket is every account that is neither Stripe-billed nor grandfathered:
         * post-trial no-CC zombies, dead BLOCKED trials, NOPAYMENTMETHOD lapses on legacy/paid
         * planids. These are the last accounts still routed to KillBilling.
         *
         * <p>false (default): orphans continue on KillBilling.
         * <p>true: orphans route to NoOpBilling, which serves them NOPAYMENTMETHOD (access denied,
         * reactivatable via Stripe Checkout, aged out by ProjectDeletionService). Flipping this
         * true removes the last live KillBill dependency. Must be flipped only AFTER the 4
         * flat-yearly stragglers are normalized to the base {@code flat-yearly} planid, else they
         * would be misclassified as orphans.
         */
        @DefaultValue("false")
        boolean routeOrphansToNoOp();
    }

    @Inject
    private Config config;
    @Inject
    private AccountStore accountStore;
    @Inject
    @Named("stripe")
    private Billing stripe;
    @Inject
    @Named("noop")
    private Billing noOp;

    private Billing pick(String accountId) {
        Optional<AccountStore.Account> accountOpt = accountStore.getAccount(accountId, true);
        if (accountOpt.isEmpty()) {
            // No local account: the orphan fallback (KillBilling during migration, NoOpBilling once
            // routeOrphansToNoOp is flipped). There is nothing to bill for a missing account anyway.
            return noOp;
        }
        return pick(accountOpt.get());
    }

    private Billing pick(AccountStore.Account account) {
        if (!Strings.isNullOrEmpty(account.getStripeCustomerId())) {
            return stripe;
        }
        if (config.routeGrandfatheredToNoOp()
                && NoOpBilling.NOOP_BILLED_PLAN_IDS.contains(account.getPlanid())) {
            return noOp;
        }
        // Orphan bucket: not Stripe-billed, not grandfathered. KillBilling during the migration;
        // NoOpBilling (-> NOPAYMENTMETHOD) once routeOrphansToNoOp is flipped, removing the last
        // live KillBill dependency.
        return noOp;
    }

    /**
     * Pick a backend for a brand-new signup that has no account record yet.
     */
    private Billing pickForNewSignup(AccountStore.Account accountInDyn) {
        if (NoOpBilling.NOOP_BILLED_PLAN_IDS.contains(accountInDyn.getPlanid())) {
            // $0 grandfathered signups never need external billing.
            return noOp;
        }
        if (config.useStripeForNewSignups()) {
            return stripe;
        }
        return noOp;
    }

    @Override
    public void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn) {
        pickForNewSignup(accountInDyn).createAccountWithSubscriptionAsync(accountInDyn);
    }

    @Override
    public Account getAccount(String accountId) {
        return pick(accountId).getAccount(accountId);
    }

    @Override
    public Account getAccountByKbId(UUID accountIdKb) {
        // KB-UUID lookups only ever came from the KillBill webhook (KillBillResource), which is now
        // inert. Route to NoOp (synthetic shell) so this no longer calls the KillBill engine.
        return noOp.getAccountByKbId(accountIdKb);
    }

    @Override
    public Subscription getSubscription(String accountId) {
        return pick(accountId).getSubscription(accountId);
    }

    @Override
    public Optional<String> getEndOfTermChangeToPlanId(Subscription subscription) {
        // No accountId available here. Subscription.externalKey is the accountId in the
        // KillBill DTO convention used by all backends, so route by that.
        String accountId = subscription.getExternalKey();
        if (Strings.isNullOrEmpty(accountId)) {
            return noOp.getEndOfTermChangeToPlanId(subscription);
        }
        return pick(accountId).getEndOfTermChangeToPlanId(subscription);
    }

    @Override
    public SubscriptionStatus getEntitlementStatus(Account account, Subscription subscription) {
        return pick(account.getExternalKey()).getEntitlementStatus(account, subscription);
    }

    @Override
    public SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, Account account, Subscription subscription, String reason) {
        return pick(account.getExternalKey()).updateAndGetEntitlementStatus(currentStatus, account, subscription, reason);
    }

    @Override
    public void updatePaymentToken(String accountId, Gateway type, String paymentToken) {
        pick(accountId).updatePaymentToken(accountId, type, paymentToken);
    }

    @Override
    public Optional<AccountBillingPaymentActionRequired> getActions(UUID accountIdKb) {
        // Pending 3DS/SCA "requires_action" is a KillBill-only concept: Stripe resolves SCA inside
        // its hosted Checkout/Portal, so StripeBilling.getActions and NoOpBilling.getActions both
        // return empty. This only ever did real work for KillBilling-managed accounts, yet it is
        // invoked on every billing-page load (AccountResource.accountBillingAdmin). Once the live
        // path is off KillBilling (routeOrphansToNoOp), no account routes here -- skip the wasted
        // KB round-trip (which would otherwise break the billing page once KB is deleted). The KB
        // UUID is meaningless for Stripe/NoOp accounts anyway. Phase 4 removes this method and its
        // UUID-keyed siblings (getAccountByKbId, getDefaultPaymentMethodDetails(UUID)) outright.
        return Optional.empty();
    }

    @Override
    public void syncActions(String accountId) {
        pick(accountId).syncActions(accountId);
    }

    @Override
    public Subscription cancelSubscription(String accountId) {
        return pick(accountId).cancelSubscription(accountId);
    }

    @Override
    public Subscription resumeSubscription(String accountId) {
        return pick(accountId).resumeSubscription(accountId);
    }

    @Override
    public Subscription changePlan(String accountId, String planId, Optional<Long> recurringPriceOpt) {
        Optional<AccountStore.Account> accountOpt = accountStore.getAccount(accountId, true);
        if (accountOpt.isEmpty()) {
            return noOp.changePlan(accountId, planId, recurringPriceOpt);
        }
        AccountStore.Account current = accountOpt.get();
        boolean targetIsNoOp = NoOpBilling.NOOP_BILLED_PLAN_IDS.contains(planId);
        boolean accountHasNoStripe = Strings.isNullOrEmpty(current.getStripeCustomerId());
        boolean accountIsNoOp = NoOpBilling.NOOP_BILLED_PLAN_IDS.contains(current.getPlanid())
                && accountHasNoStripe;
        // An orphan: not Stripe-billed and not grandfathered (legacy/paid planid, no Stripe
        // customer). After routeOrphansToNoOp it sits at NOPAYMENTMETHOD; "reactivate" means
        // upgrading to a paid plan, which must start a fresh Stripe subscription.
        boolean accountIsOrphan = accountHasNoStripe
                && !NoOpBilling.NOOP_BILLED_PLAN_IDS.contains(current.getPlanid());

        // Upgrade path: a grandfathered $0 account OR a lapsed orphan upgrading to a paid plan
        // starts a Stripe subscription. StripeBilling.changePlan with a null stripeCustomerId
        // throws 409, which the frontend turns into a Stripe Checkout redirect (the reactivation
        // flow). Once it returns the account has stripeCustomerId set and routes to Stripe.
        if ((accountIsNoOp || accountIsOrphan) && !targetIsNoOp && config.useStripeForNewSignups()) {
            log.info("Upgrade/reactivate from plan {} to {} for account {} -- routing through StripeBilling",
                    current.getPlanid(), planId, accountId);
            return stripe.changePlan(accountId, planId, recurringPriceOpt);
        }
        // Downgrade path: a Stripe-billed account switching to a free/grandfathered plan.
        // StripeBilling.changePlan would 500 because free plans have no Stripe Price. Cancel
        // the active Stripe sub instead (immediate, no proration), then route through NoOp
        // for the local planid write. We deliberately keep stripeCustomerId on the account
        // -- if they re-upgrade later we reuse their Stripe Customer and saved card.
        boolean accountIsStripe = !Strings.isNullOrEmpty(current.getStripeCustomerId());
        if (accountIsStripe && targetIsNoOp) {
            log.info("Downgrade from Stripe-billed plan {} to grandfathered/free {} for account {} -- cancelling Stripe sub, routing through NoOpBilling",
                    current.getPlanid(), planId, accountId);
            stripe.cancelAllSubscriptionsImmediately(accountId);
            return noOp.changePlan(accountId, planId, recurringPriceOpt);
        }
        return pick(current).changePlan(accountId, planId, recurringPriceOpt);
    }

    @Override
    public Subscription changePlanToFlatYearly(String accountId, long yearlyPrice) {
        return pick(accountId).changePlanToFlatYearly(accountId, yearlyPrice);
    }

    @Override
    public boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId) {
        return pick(accountInDyn).tryAutoUpgradePlan(accountInDyn, requiredPlanId);
    }

    @Override
    public Optional<AccountStore.Account> tryAutoUpgradeAfterSelfhostLicenseAdded(AccountStore.Account accountInDyn) {
        return pick(accountInDyn).tryAutoUpgradeAfterSelfhostLicenseAdded(accountInDyn);
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        return pick(accountId).getInvoices(accountId, cursorOpt);
    }

    @Override
    public String getInvoiceHtml(UUID invoiceId, Optional<String> accountIdOpt) {
        if (accountIdOpt.isPresent()) {
            return pick(accountIdOpt.get()).getInvoiceHtml(invoiceId, accountIdOpt);
        }
        return noOp.getInvoiceHtml(invoiceId, accountIdOpt);
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
        return pick(accountId).getDefaultPaymentMethodDetails(accountId);
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb) {
        // KB-UUID-keyed; only reached from the now-inert KillBill webhook. NoOp returns empty.
        return noOp.getDefaultPaymentMethodDetails(accountIdKb);
    }

    @Override
    public ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId) {
        if (accountId.isPresent()) {
            return pick(accountId.get()).getAvailablePlans(accountId);
        }
        return noOp.getAvailablePlans(accountId);
    }

    @Override
    public void creditAdjustment(String accountId, long amount, String description) {
        pick(accountId).creditAdjustment(accountId, amount, description);
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId) {
        pick(accountId).recordUsage(type, accountId, projectId);
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, String userId) {
        pick(accountId).recordUsage(type, accountId, projectId, userId);
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, UserStore.UserModel user) {
        pick(accountId).recordUsage(type, accountId, projectId, user);
    }

    @Override
    public void finalizeInvoice(String accountId, UUID invoiceId) {
        pick(accountId).finalizeInvoice(accountId, invoiceId);
    }

    @Override
    public void closeAccount(String accountId) {
        pick(accountId).closeAccount(accountId);
    }

    @Override
    public String createCheckoutSession(AccountStore.Account account, Optional<String> targetPlanIdOpt) {
        // Checkout is Stripe-only.
        return stripe.createCheckoutSession(account, targetPlanIdOpt);
    }

    @Override
    public String createPortalSession(String accountId) {
        return stripe.createPortalSession(accountId);
    }

    @Override
    public void finalizeCheckoutSession(String sessionId) {
        stripe.finalizeCheckoutSession(sessionId);
    }

    @Override
    public void cancelAllSubscriptionsImmediately(String accountId) {
        // Stripe-only mechanic; route directly.
        stripe.cancelAllSubscriptionsImmediately(accountId);
    }

    @Override
    public void resetToStripeTrial(AccountStore.Account account, String idempotencySuffix) {
        // Whole point of this method is to put the account on Stripe; route directly to stripe.
        stripe.resetToStripeTrial(account, idempotencySuffix);
    }

    @Override
    public boolean hasActiveStripeSubscription(AccountStore.Account account) {
        return stripe.hasActiveStripeSubscription(account);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(BillingRouter.class).asEagerSingleton();
                bind(Billing.class).to(BillingRouter.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
