// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.InvoiceItem;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Price;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.PriceListParams;
import com.stripe.param.SubscriptionCancelParams;
import com.stripe.param.SubscriptionCreateParams;
import com.stripe.param.SubscriptionListParams;
import com.stripe.param.SubscriptionUpdateParams;
import com.stripe.param.checkout.SessionCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.LocalDate;
import org.killbill.billing.catalog.api.BillingPeriod;
import org.killbill.billing.catalog.api.Currency;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.catalog.api.ProductCategory;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.EventSubscription;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.PaymentMethodPluginDetail;
import org.killbill.billing.client.model.gen.PhasePrice;
import org.killbill.billing.client.model.gen.PlanDetail;
import org.killbill.billing.entitlement.api.Entitlement;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Iterator;
import java.util.Optional;
import java.util.UUID;

/**
 * Direct Stripe Billing implementation.
 *
 * <p>Talks to Stripe's APIs (Customers, Subscriptions, PaymentMethods, Invoices, Prices,
 * Checkout Sessions, Customer Portal sessions) directly, bypassing KillBill. Returned data
 * is wrapped in KillBill SDK DTOs because the {@link Billing} interface contract still uses
 * those types — same convention as {@link SelfHostBilling} and {@link NoOpBilling}. We keep
 * that contract as-is to avoid cross-cutting refactors during the migration.
 *
 * <p>Signup flow:
 * <ol>
 *   <li>Local account is created with status=ACTIVETRIAL (or NOPAYMENTMETHOD if plan has no trial).
 *   <li>Caller invokes {@link #createCheckoutSession} to get a Stripe-hosted Checkout URL.
 *   <li>User completes payment on Stripe; Stripe creates Customer + Subscription on its side.
 *   <li>Webhook handler (or the success-URL callback) calls {@link #finalizeCheckoutSession}
 *       which sets {@code account.stripeCustomerId} from the resulting Stripe Customer.
 * </ol>
 *
 * <p>Management flow: caller invokes {@link #createPortalSession} to get a Customer Portal
 * URL; user manages payment method, plan, cancellation, invoices on Stripe-hosted pages.
 *
 * <p>Plan ID resolution: each ClearFlask plan ID (e.g. {@code cloud-monthly2}) maps to a
 * Stripe Price ID via {@code metadata.clearflask_plan_id}. Lookups cached for 10 minutes.
 *
 * <p>Idempotency: every mutating Stripe call passes an idempotency key derived from the
 * accountId + operation name so safe retries don't double-bill.
 */
@Slf4j
@Singleton
public class StripeBilling extends ManagedService implements Billing {

    public static final String META_CLEARFLASK_ACCOUNT_ID = "clearflask_account_id";
    public static final String META_CLEARFLASK_PLAN_ID = "clearflask_plan_id";
    public static final String META_ONE_OFF_FOR_ACCOUNT = "clearflask_one_off_for_account";
    public static final String META_MIGRATED_FROM_KILLBILL = "clearflask_migrated_from_killbill";
    public static final String META_CLEARFLASK = "clearflask";
    /**
     * Set on a Stripe Subscription right before we cancel it via the overdue-escalation path.
     * The {@link StripeStatusMapper} reads this metadata and maps the resulting canceled
     * subscription to {@code BLOCKED} (rather than CANCELLED) so the existing
     * ProjectDeletionService cleanup pipeline keys correctly.
     */
    public static final String META_OVERDUE_CANCELLED = "clearflask_overdue_cancelled";

    public interface Config {
        @DefaultValue("14")
        long defaultTrialDays();

        /**
         * Stripe webhook signing secret. Only set as a config override; normally read from
         * {@link com.smotana.clearflask.store.ServiceSecretStore} (auto-registered on startup).
         */
        @DefaultValue("")
        String webhookSecretOverride();

        /**
         * Tolerance in seconds for webhook signature validation. Stripe defaults to 300s.
         */
        @DefaultValue("300")
        long webhookToleranceSeconds();

        /**
         * Soft cap on Stripe API listing pagination.
         */
        @DefaultValue("100")
        long listPageSize();
    }

    @Inject
    private Config config;
    @Inject
    private com.smotana.clearflask.web.Application.Config configApp;
    @Inject
    private AccountStore accountStore;
    @Inject
    private com.smotana.clearflask.core.push.NotificationService notificationService;
    @Inject
    private PlanVerifyStore planVerifyStore;

    /** Public-facing app URL derived from {@code Application.Config.domain}. */
    private String publicUrl() {
        return "https://" + configApp.domain();
    }

    private Cache<String, String> planIdToPriceId;
    /**
     * Short-TTL per-account cache of the live Stripe Subscription + payment-method state.
     * Inside a single billing-page render we typically call findActiveSubscription /
     * customerHasPaymentMethod 3-6 times across getSubscription -> getEntitlementStatus
     * -> updateAndGetEntitlementStatus etc. A 5-second cache collapses all of those into
     * one Stripe round-trip while still being fresh enough that the next request reflects
     * any portal-side change. Webhook handlers explicitly invalidate via invalidateSubCache.
     */
    private Cache<String, SubSnapshot> subSnapshotCache;
    private java.util.concurrent.ExecutorService asyncExecutor;

    private static final class SubSnapshot {
        final Subscription sub; // may be null
        final boolean hasPaymentMethod;
        SubSnapshot(Subscription sub, boolean hasPaymentMethod) {
            this.sub = sub;
            this.hasPaymentMethod = hasPaymentMethod;
        }
    }

    @Override
    protected void serviceStart() {
        planIdToPriceId = CacheBuilder.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(10))
                .maximumSize(64)
                .build();
        subSnapshotCache = CacheBuilder.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(5))
                .maximumSize(4096)
                .build();
        asyncExecutor = java.util.concurrent.Executors.newSingleThreadExecutor(
                new com.google.common.util.concurrent.ThreadFactoryBuilder()
                        .setNameFormat("StripeBilling-async-%d")
                        .build());
    }

    @Override
    protected void serviceStop() {
        if (asyncExecutor != null) {
            asyncExecutor.shutdownNow();
        }
    }

    /* ============================ Hosted-flow entry points ============================ */

    /**
     * Create a Stripe Checkout Session for the given account's signup. Returns the URL
     * the frontend should redirect to.
     *
     * <p>{@code targetPlanIdOpt} overrides {@code account.planid}. Use this for the
     * grandfathered-to-paid upgrade path so the local planid stays untouched until the
     * customer actually pays (the subscription.created webhook will sync planid from the
     * Stripe sub metadata). Falls back to {@code account.planid} when absent -- the normal
     * fresh-signup path.
     */
    @Override
    public String createCheckoutSession(AccountStore.Account accountInDyn, Optional<String> targetPlanIdOpt) {
        String planId = targetPlanIdOpt.filter(s -> !Strings.isNullOrEmpty(s)).orElse(accountInDyn.getPlanid());
        try {
            String priceId = resolvePriceId(planId)
                    .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                            "Plan " + planId + " is not configured in Stripe"));

            SessionCreateParams.SubscriptionData.Builder subData = SessionCreateParams.SubscriptionData.builder()
                    .putMetadata(META_CLEARFLASK_ACCOUNT_ID, accountInDyn.getAccountId())
                    .putMetadata(META_CLEARFLASK_PLAN_ID, planId);
            if (!PlanStore.PLANS_WITHOUT_TRIAL.contains(planId)) {
                subData.setTrialPeriodDays(config.defaultTrialDays());
            }

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomerEmail(accountInDyn.getEmail())
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setPrice(priceId)
                            .setQuantity(1L)
                            .build())
                    .setSuccessUrl(publicUrl() + "/dashboard/billing?checkout_session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(publicUrl() + "/dashboard/billing?checkout=cancelled")
                    .setSubscriptionData(subData.build())
                    .setAllowPromotionCodes(true)
                    .putMetadata(META_CLEARFLASK_ACCOUNT_ID, accountInDyn.getAccountId())
                    .putMetadata(META_CLEARFLASK_PLAN_ID, planId)
                    .build();

            Session session = Session.create(params, idempotency(accountInDyn.getAccountId(),
                    "checkoutSession:" + planId));
            return session.getUrl();
        } catch (StripeException ex) {
            throw stripeError("createCheckoutSession", accountInDyn.getAccountId(), ex);
        }
    }

    /**
     * Create a Stripe Customer Portal Session for managing billing. Returns the URL.
     */
    public String createPortalSession(String accountId) {
        AccountStore.Account a = requireAccount(accountId);
        if (Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "This account is not managed by Stripe billing");
        }
        try {
            com.stripe.param.billingportal.SessionCreateParams params = com.stripe.param.billingportal.SessionCreateParams.builder()
                    .setCustomer(a.getStripeCustomerId())
                    .setReturnUrl(publicUrl() + "/dashboard/billing")
                    .build();
            com.stripe.model.billingportal.Session session = com.stripe.model.billingportal.Session.create(params);
            return session.getUrl();
        } catch (StripeException ex) {
            throw stripeError("createPortalSession", accountId, ex);
        }
    }

    /**
     * Called from the Checkout success-URL callback (and as a defensive measure from the
     * webhook handler). Reads the Stripe Session, identifies the local account from
     * session metadata, and persists {@code account.stripeCustomerId}. Idempotent.
     */
    public void finalizeCheckoutSession(String sessionId) {
        try {
            Session session = Session.retrieve(sessionId);
            String accountId = session.getMetadata() == null ? null
                    : session.getMetadata().get(META_CLEARFLASK_ACCOUNT_ID);
            if (Strings.isNullOrEmpty(accountId)) {
                log.warn("Stripe Checkout session {} has no clearflask_account_id metadata", sessionId);
                return;
            }
            String customerId = session.getCustomer();
            if (Strings.isNullOrEmpty(customerId)) {
                log.warn("Stripe Checkout session {} has no customer set yet (status={})",
                        sessionId, session.getStatus());
                return;
            }
            AccountStore.Account a = accountStore.getAccount(accountId, false).orElse(null);
            if (a == null) {
                log.warn("Stripe Checkout session {} references unknown clearflask account {}",
                        sessionId, accountId);
                return;
            }
            if (!Strings.isNullOrEmpty(a.getStripeCustomerId())) {
                if (!a.getStripeCustomerId().equals(customerId)) {
                    log.error("Stripe Checkout session {} customer {} does not match existing account.stripeCustomerId {}",
                            sessionId, customerId, a.getStripeCustomerId());
                }
                return;
            }
            accountStore.setStripeCustomerId(accountId, Optional.of(customerId));
            log.info("Finalized Checkout session {} -> account {} -> stripeCustomerId {}",
                    sessionId, accountId, customerId);
        } catch (StripeException ex) {
            throw stripeError("finalizeCheckoutSession", sessionId, ex);
        }
    }

    /* ============================ Billing interface ============================ */

    @Override
    public void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn) {
        // Inline signup (no Checkout redirect): create the Stripe Customer + Subscription
        // immediately, with a trial period and no required payment method up front. The
        // user adds a card later via the "Manage Billing" Customer Portal button on
        // BillingPage. Same UX as the existing KillBilling-backed signup flow.
        asyncExecutor.submit(() -> {
            try {
                createCustomerAndSubscription(accountInDyn);
            } catch (Exception ex) {
                log.warn("Stripe: createAccountWithSubscriptionAsync failed for account {}",
                        accountInDyn.getAccountId(), ex);
            }
        });
    }

    private void createCustomerAndSubscription(AccountStore.Account accountInDyn) throws StripeException {
        // Original signup path: bail if already linked. The reset path uses
        // createCustomerAndSubscriptionFresh below.
        if (!Strings.isNullOrEmpty(accountInDyn.getStripeCustomerId())) {
            log.info("Stripe: account {} already has stripeCustomerId, skipping signup creation",
                    accountInDyn.getAccountId());
            return;
        }
        createCustomerAndSubscriptionFresh(accountInDyn, "");
    }

    /**
     * Create (or reuse) a Stripe Customer and start a brand-new Subscription with a 14-day
     * trial. Used both by signup ({@link #createCustomerAndSubscription}) and by the
     * super-admin reset endpoint ({@code accountResetToStripeTrialSuperAdmin}).
     *
     * <p>The {@code idempotencySuffix} is appended to the per-account idempotency key so the
     * reset path doesn't collide with the original signup's keys (Stripe would otherwise
     * return the cancelled Subscription back). Pass an empty string for the signup path; the
     * reset path passes a per-call value (e.g. ":reset:&lt;timestamp&gt;").
     *
     * <p>Reuses {@code account.stripeCustomerId} if set (preserves invoice history). Otherwise
     * creates a new Stripe Customer and persists its id on the account.
     */
    public void createCustomerAndSubscriptionFresh(AccountStore.Account accountInDyn, String idempotencySuffix) throws StripeException {
        Customer customer;
        if (!Strings.isNullOrEmpty(accountInDyn.getStripeCustomerId())) {
            customer = Customer.retrieve(accountInDyn.getStripeCustomerId());
        } else {
            customer = Customer.create(CustomerCreateParams.builder()
                            .setEmail(accountInDyn.getEmail())
                            .setName(accountInDyn.getName())
                            .putMetadata(META_CLEARFLASK_ACCOUNT_ID, accountInDyn.getAccountId())
                            .build(),
                    idempotency(accountInDyn.getAccountId(), "createCustomer" + idempotencySuffix));
            accountStore.setStripeCustomerId(accountInDyn.getAccountId(), Optional.of(customer.getId()));
        }

        Optional<String> priceIdOpt = resolvePriceId(accountInDyn.getPlanid());
        if (priceIdOpt.isEmpty()) {
            log.warn("Stripe: no Price configured for plan {}; skipping subscription creation for {}",
                    accountInDyn.getPlanid(), accountInDyn.getAccountId());
            return;
        }
        SubscriptionCreateParams.Builder subParams = SubscriptionCreateParams.builder()
                .setCustomer(customer.getId())
                .addItem(SubscriptionCreateParams.Item.builder().setPrice(priceIdOpt.get()).build())
                .setPaymentBehavior(SubscriptionCreateParams.PaymentBehavior.DEFAULT_INCOMPLETE)
                .setProrationBehavior(SubscriptionCreateParams.ProrationBehavior.NONE)
                .putMetadata(META_CLEARFLASK_ACCOUNT_ID, accountInDyn.getAccountId())
                .putMetadata(META_CLEARFLASK_PLAN_ID, accountInDyn.getPlanid());
        if (!PlanStore.PLANS_WITHOUT_TRIAL.contains(accountInDyn.getPlanid())) {
            subParams.setTrialPeriodDays(config.defaultTrialDays());
            subParams.setTrialSettings(SubscriptionCreateParams.TrialSettings.builder()
                    .setEndBehavior(SubscriptionCreateParams.TrialSettings.EndBehavior.builder()
                            .setMissingPaymentMethod(SubscriptionCreateParams.TrialSettings.EndBehavior.MissingPaymentMethod.PAUSE)
                            .build())
                    .build());
        }
        Subscription sub = Subscription.create(subParams.build(),
                idempotency(accountInDyn.getAccountId(), "createSubscription" + idempotencySuffix));
        invalidateSubCache(accountInDyn.getAccountId());
        log.info("Stripe: created customer={} subscription={} for account={} (suffix={})",
                customer.getId(), sub.getId(), accountInDyn.getAccountId(), idempotencySuffix);
    }

    /**
     * Cancel any non-terminal Stripe Subscription for the account immediately (no proration,
     * no final invoice). Best-effort: catches and logs StripeException so the caller can
     * proceed with reset / cleanup logic.
     */
    @Override
    public void cancelAllSubscriptionsImmediately(String accountId) {
        AccountStore.Account a = accountStore.getAccount(accountId, true).orElse(null);
        if (a == null || Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return;
        }
        try {
            com.stripe.param.SubscriptionListParams params = com.stripe.param.SubscriptionListParams.builder()
                    .setCustomer(a.getStripeCustomerId())
                    .setStatus(com.stripe.param.SubscriptionListParams.Status.ALL)
                    .setLimit(config.listPageSize())
                    .build();
            for (Subscription sub : Subscription.list(params).autoPagingIterable()) {
                String s = sub.getStatus();
                if ("canceled".equals(s) || "incomplete_expired".equals(s)) continue;
                try {
                    sub.cancel(SubscriptionCancelParams.builder()
                                    .setInvoiceNow(false)
                                    .setProrate(false)
                                    .build(),
                            idempotency(accountId, "resetCancel:" + sub.getId()));
                    log.info("Stripe: cancelled subscription {} for account {} (reset path)",
                            sub.getId(), accountId);
                } catch (StripeException ex) {
                    log.warn("Stripe: failed to cancel subscription {} for account {} (continuing)",
                            sub.getId(), accountId, ex);
                }
            }
            invalidateSubCache(accountId);
        } catch (StripeException ex) {
            log.warn("Stripe: cancelAllSubscriptionsImmediately failed for {} (continuing)", accountId, ex);
        }
    }

    /**
     * Cancel the account's Stripe subscription as an "overdue" cancellation. Marks the sub
     * with {@link #META_OVERDUE_CANCELLED} metadata BEFORE cancelling so that the resulting
     * {@code customer.subscription.deleted} webhook (and subsequent reconciles) map this to
     * {@code BLOCKED} via {@link StripeStatusMapper}.
     *
     * <p>Best-effort: catches StripeException + logs. Safe to retry — idempotency keys are
     * derived from sub.id; Stripe deduplicates.
     *
     * <p>Order matters: (1) metadata update → (2) cancel. If the cancel fails mid-flight,
     * the metadata is already set, and the next daily escalation run will retry the cancel
     * and observe NOPAYMENTMETHOD (because Stripe sub is still paused at that moment).
     */
    public void cancelForOverdue(AccountStore.Account a) {
        if (a == null || Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return;
        }
        try {
            Optional<Subscription> subOpt = findActiveSubscription(a);
            if (subOpt.isEmpty()) {
                log.info("Stripe: cancelForOverdue: no active subscription for account {}", a.getAccountId());
                return;
            }
            Subscription sub = subOpt.get();
            try {
                sub.update(SubscriptionUpdateParams.builder()
                                .putMetadata(META_OVERDUE_CANCELLED, "true")
                                .build(),
                        idempotency(a.getAccountId(), "overdueMark:" + sub.getId()));
            } catch (StripeException ex) {
                log.warn("Stripe: cancelForOverdue metadata update failed for sub {} acct {} (aborting cancel)",
                        sub.getId(), a.getAccountId(), ex);
                return;
            }
            try {
                sub.cancel(SubscriptionCancelParams.builder()
                                .setInvoiceNow(false)
                                .setProrate(false)
                                .build(),
                        idempotency(a.getAccountId(), "overdueCancel:" + sub.getId()));
                invalidateSubCache(a.getAccountId());
                log.info("Stripe: overdue-cancelled subscription {} for account {}",
                        sub.getId(), a.getAccountId());
            } catch (StripeException ex) {
                log.warn("Stripe: cancelForOverdue cancel failed for sub {} acct {} (will retry next run)",
                        sub.getId(), a.getAccountId(), ex);
            }
        } catch (StripeException ex) {
            log.warn("Stripe: cancelForOverdue failed for {} (continuing)", a.getAccountId(), ex);
        }
    }

    @Override
    public Account getAccount(String accountId) {
        AccountStore.Account a = requireAccount(accountId);
        try {
            Customer customer = Strings.isNullOrEmpty(a.getStripeCustomerId())
                    ? null
                    : Customer.retrieve(a.getStripeCustomerId());
            return synthAccount(a, customer);
        } catch (StripeException ex) {
            throw stripeError("getAccount", accountId, ex);
        }
    }

    @Override
    public Account getAccountByKbId(UUID accountIdKb) {
        // Stripe-managed accounts have no KillBill UUID. Legacy code paths shouldn't reach here.
        return synthAccount(null, null);
    }

    @Override
    public org.killbill.billing.client.model.gen.Subscription getSubscription(String accountId) {
        AccountStore.Account a = requireAccount(accountId);
        try {
            Optional<Subscription> stripeSubOpt = findActiveSubscription(a);
            if (stripeSubOpt.isPresent()) {
                return synthSubscription(a, stripeSubOpt.get());
            }
            // No live Stripe sub. Two cases:
            //  (a) Brand-new signup whose async createCustomerAndSubscription hasn't
            //      finished yet -- account.stripeCustomerId may even still be empty.
            //      Returning a synthetic "pending" sub keeps accountBillingAdmin /
            //      BillingPage rendering instead of 404ing during the signup race window.
            //  (b) Existing Stripe-billed account whose sub was deleted (e.g. canceled).
            //      Same synthetic sub is safe -- callers detect the missing planName
            //      events or the empty currentPeriodEnd as "no live billing".
            // For Stripe-routed accounts the synthetic sub carries the local planid so
            // the UI can render the plan card. Mapper will see a null Stripe sub via
            // findActiveSubscription returning empty and surface the correct status.
            return synthSubscription(a, null);
        } catch (StripeException ex) {
            throw stripeError("getSubscription", accountId, ex);
        }
    }

    @Override
    public Optional<String> getEndOfTermChangeToPlanId(org.killbill.billing.client.model.gen.Subscription subscription) {
        // Stripe equivalent (SubscriptionSchedule) is not used in current product flows.
        return Optional.empty();
    }

    @Override
    public SubscriptionStatus getEntitlementStatus(Account account, org.killbill.billing.client.model.gen.Subscription subscription) {
        AccountStore.Account a = requireAccount(account.getExternalKey());
        try {
            SubSnapshot snap = loadSubSnapshot(a);
            Subscription stripeSub = snap.sub;
            boolean hasPm = snap.hasPaymentMethod;
            String planId = subscription == null ? a.getPlanid() : subscription.getPlanName();
            // Memoize: the mapper only invokes isLimited.getAsBoolean() in the branches that
            // can produce LIMITED, so we avoid the plan-verify call entirely for terminal /
            // payment-issue states. Mirrors KillBilling.getEntitlementStatus.
            com.google.common.base.Supplier<Boolean> isLimited = com.google.common.base.Suppliers.memoize(() -> isAccountLimited(a.getAccountId(), planId));
            return StripeStatusMapper.map(stripeSub, hasPm, isLimited::get);
        } catch (StripeException ex) {
            throw stripeError("getEntitlementStatus", a.getAccountId(), ex);
        }
    }

    private boolean isAccountLimited(String accountId, String planId) {
        if (Strings.isNullOrEmpty(planId)) {
            return false;
        }
        try {
            planVerifyStore.verifyAccountMeetsLimits(planId, accountId);
        } catch (ApiException ex) {
            return true;
        }
        return false;
    }

    @Override
    public SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, Account account, org.killbill.billing.client.model.gen.Subscription subscription, String reason) {
        SubscriptionStatus newStatus = getEntitlementStatus(account, subscription);
        if (!newStatus.equals(currentStatus)) {
            log.info("Stripe subscription status change {} -> {}, reason: {}, for {}",
                    currentStatus, newStatus, reason, account.getExternalKey());
            accountStore.updateStatus(account.getExternalKey(), newStatus);
            // Trial-ended email. Fires only when leaving ACTIVETRIAL for a status that
            // means the trial is actually over -- not ACTIVENORENEWAL, which is the
            // "trial still running but cancel scheduled at period end" state. Otherwise
            // a mid-trial cancellation would send the "your trial is over" email while
            // the user is still in the trial AND suppress the real one later (because
            // shouldSendTrialEndedNotification is one-shot per plan id).
            if (SubscriptionStatus.ACTIVETRIAL.equals(currentStatus)
                    && !SubscriptionStatus.ACTIVENORENEWAL.equals(newStatus)
                    && accountStore.shouldSendTrialEndedNotification(account.getExternalKey(), subscription.getPlanName())) {
                Optional<PaymentMethodDetails> pmOpt = getDefaultPaymentMethodDetails(account.getExternalKey());
                accountStore.getAccount(account.getExternalKey(), false).ifPresent(accountInDyn ->
                        notificationService.onTrialEnded(accountInDyn, pmOpt.isPresent()));
            }
        }
        return newStatus;
    }

    @Override
    public void updatePaymentToken(String accountId, Gateway gateway, String paymentToken) {
        // Customer Portal handles this for Stripe-billed accounts. Surface a clear error if
        // some legacy code path tries to push a token through here.
        throw new ApiException(Response.Status.BAD_REQUEST,
                "Use the Customer Portal to update payment methods");
    }

    @Override
    public Optional<AccountBillingPaymentActionRequired> getActions(UUID accountIdKb) {
        // KB UUIDs only exist for KillBilling-managed accounts.
        return Optional.empty();
    }

    @Override
    public void syncActions(String accountId) {
        AccountStore.Account a = requireAccount(accountId);
        if (Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return;
        }
        try {
            Optional<Subscription> subOpt = findActiveSubscription(a);
            if (subOpt.isEmpty()) {
                return;
            }
            Subscription stripeSub = subOpt.get();

            // Pull planid from Stripe metadata; if it differs from local, sync. This
            // catches plan changes made on the Stripe side that didn't propagate via
            // webhook (e.g. webhook delivery failure, downtime).
            if (stripeSub.getMetadata() != null) {
                String planFromStripe = stripeSub.getMetadata().get(META_CLEARFLASK_PLAN_ID);
                if (!Strings.isNullOrEmpty(planFromStripe) && !planFromStripe.equals(a.getPlanid())) {
                    log.info("Stripe sync: planid drift {} -> {} for account {} (subscription {})",
                            a.getPlanid(), planFromStripe, accountId, stripeSub.getId());
                    accountStore.setPlan(accountId, planFromStripe, Optional.empty());
                }
            }

            // Sync subscription status (trialing/active/past_due/canceled/etc.) into
            // local account.status via the existing entitlement-mapper path.
            updateAndGetEntitlementStatus(a.getStatus(), getAccount(accountId),
                    getSubscription(accountId), "syncActions");
        } catch (Exception ex) {
            log.warn("Stripe syncActions failed for account {} (continuing)", accountId, ex);
        }
    }

    @Override
    public org.killbill.billing.client.model.gen.Subscription cancelSubscription(String accountId) {
        AccountStore.Account a = requireAccount(accountId);
        try {
            Subscription sub = findActiveSubscription(a)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "No subscription to cancel"));
            Subscription updated = sub.update(
                    SubscriptionUpdateParams.builder().setCancelAtPeriodEnd(true).build(),
                    idempotency(accountId, "cancelSubscription:" + sub.getId()));
            invalidateSubCache(accountId);
            return synthSubscription(a, updated);
        } catch (StripeException ex) {
            throw stripeError("cancelSubscription", accountId, ex);
        }
    }

    @Override
    public org.killbill.billing.client.model.gen.Subscription resumeSubscription(String accountId) {
        AccountStore.Account a = requireAccount(accountId);
        try {
            Subscription sub = findActiveSubscription(a)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "No subscription to resume"));
            Subscription updated = sub.update(
                    SubscriptionUpdateParams.builder().setCancelAtPeriodEnd(false).build(),
                    idempotency(accountId, "resumeSubscription:" + sub.getId()));
            invalidateSubCache(accountId);
            return synthSubscription(a, updated);
        } catch (StripeException ex) {
            throw stripeError("resumeSubscription", accountId, ex);
        }
    }

    @Override
    public org.killbill.billing.client.model.gen.Subscription changePlan(String accountId, String planId, Optional<Long> recurringPriceOpt) {
        AccountStore.Account a = requireAccount(accountId);
        try {
            // Grandfathered $0 -> paid Stripe upgrade: account has no Stripe customer yet,
            // so we cannot validate or charge anything here. The real promotion happens
            // when the user completes Stripe Checkout. Do NOT write account.planid yet --
            // doing so leaves the account locally-paid but Stripe-unpaid if the user
            // abandons Checkout. The subscription.created webhook syncs planid from
            // sub metadata when payment is actually authorized.
            //
            // Frontend flow: catch this 409 and call accountBillingCheckoutSessionAdmin
            // with planId=<targetPlanId> to redirect the user to Checkout.
            if (Strings.isNullOrEmpty(a.getStripeCustomerId())) {
                throw new ApiException(Response.Status.CONFLICT,
                        "Upgrade requires Stripe Checkout. Initiate checkout for plan " + planId + ".");
            }

            Optional<String> priceIdOpt;
            if (recurringPriceOpt.isPresent() && PlanStore.ALLOW_USER_CHOOSE_PRICING_FOR_PLANS.contains(planId)) {
                priceIdOpt = Optional.of(createOrReuseOneOffMonthlyPrice(accountId, planId, recurringPriceOpt.get()));
            } else {
                priceIdOpt = resolvePriceId(planId);
            }
            String newPriceId = priceIdOpt.orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Plan " + planId + " is not configured in Stripe"));

            Subscription sub = findActiveSubscription(a)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "No subscription to change"));

            String itemId = sub.getItems().getData().isEmpty() ? null : sub.getItems().getData().get(0).getId();
            SubscriptionUpdateParams.Item.Builder itemBuilder = SubscriptionUpdateParams.Item.builder()
                    .setPrice(newPriceId);
            if (itemId != null) {
                itemBuilder.setId(itemId);
            }
            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .addItem(itemBuilder.build())
                    .putMetadata(META_CLEARFLASK_PLAN_ID, planId)
                    .setProrationBehavior(SubscriptionUpdateParams.ProrationBehavior.CREATE_PRORATIONS)
                    .build();
            Subscription updated = sub.update(params,
                    idempotency(accountId, "changePlan:" + sub.getId() + ":" + planId));
            accountStore.setPlan(accountId, planId, Optional.empty());
            invalidateSubCache(accountId);
            return synthSubscription(a, updated);
        } catch (StripeException ex) {
            throw stripeError("changePlan", accountId, ex);
        }
    }

    @Override
    public org.killbill.billing.client.model.gen.Subscription changePlanToFlatYearly(String accountId, long yearlyPrice) {
        AccountStore.Account a = requireAccount(accountId);
        try {
            String productId = resolveProductId("flat-yearly")
                    .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                            "Plan flat-yearly is not configured in Stripe"));
            PriceCreateParams priceParams = PriceCreateParams.builder()
                    .setUnitAmount(yearlyPrice * 100)
                    .setCurrency("usd")
                    .setProduct(productId)
                    .setRecurring(PriceCreateParams.Recurring.builder()
                            .setInterval(PriceCreateParams.Recurring.Interval.YEAR)
                            .build())
                    .putMetadata(META_CLEARFLASK_PLAN_ID, "flat-yearly")
                    .putMetadata(META_ONE_OFF_FOR_ACCOUNT, accountId)
                    .build();
            Price price = Price.create(priceParams,
                    idempotency(accountId, "createFlatYearlyPrice:" + yearlyPrice));

            Subscription sub = findActiveSubscription(a)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "No subscription to change"));
            String itemId = sub.getItems().getData().isEmpty() ? null : sub.getItems().getData().get(0).getId();
            SubscriptionUpdateParams.Item.Builder itemBuilder = SubscriptionUpdateParams.Item.builder()
                    .setPrice(price.getId());
            if (itemId != null) {
                itemBuilder.setId(itemId);
            }
            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .addItem(itemBuilder.build())
                    .putMetadata(META_CLEARFLASK_PLAN_ID, "flat-yearly")
                    .build();
            Subscription updated = sub.update(params,
                    idempotency(accountId, "changePlanToFlatYearly:" + yearlyPrice));
            accountStore.setPlan(accountId, "flat-yearly", Optional.empty());
            invalidateSubCache(accountId);
            return synthSubscription(a, updated);
        } catch (StripeException ex) {
            throw stripeError("changePlanToFlatYearly", accountId, ex);
        }
    }

    @Override
    public boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId) {
        return false;
    }

    @Override
    public Optional<AccountStore.Account> tryAutoUpgradeAfterSelfhostLicenseAdded(AccountStore.Account accountInDyn) {
        return Optional.empty();
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        AccountStore.Account a = requireAccount(accountId);
        if (Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return new Invoices(null, ImmutableList.of());
        }
        try {
            com.stripe.param.InvoiceListParams.Builder params = com.stripe.param.InvoiceListParams.builder()
                    .setCustomer(a.getStripeCustomerId())
                    .setLimit(config.listPageSize());
            cursorOpt.ifPresent(params::setStartingAfter);
            com.stripe.model.InvoiceCollection list = com.stripe.model.Invoice.list(params.build());
            ImmutableList.Builder<InvoiceItem> builder = ImmutableList.builder();
            for (com.stripe.model.Invoice inv : list.getData()) {
                java.time.LocalDate created = inv.getCreated() == null
                        ? java.time.LocalDate.now()
                        : Instant.ofEpochSecond(inv.getCreated()).atOffset(ZoneOffset.UTC).toLocalDate();
                Double amount = inv.getAmountDue() == null ? 0d : inv.getAmountDue() / 100.0;
                builder.add(new InvoiceItem(
                        created,
                        inv.getStatus() == null ? "open" : inv.getStatus(),
                        amount,
                        inv.getDescription() == null ? "" : inv.getDescription(),
                        inv.getId(),
                        inv.getHostedInvoiceUrl(),
                        inv.getInvoicePdf()));
            }
            String nextCursor = Boolean.TRUE.equals(list.getHasMore()) && !list.getData().isEmpty()
                    ? list.getData().get(list.getData().size() - 1).getId()
                    : null;
            return new Invoices(nextCursor, builder.build());
        } catch (StripeException ex) {
            throw stripeError("getInvoices", accountId, ex);
        }
    }

    @Override
    public String getInvoiceHtml(UUID invoiceId, Optional<String> accountIdOpt) {
        // For Stripe-billed accounts, we return a link to the Stripe-hosted invoice page
        // rather than rendering HTML ourselves. The frontend can either redirect to it or
        // open it in a new tab. We return a tiny HTML stub with a meta-refresh redirect.
        // The actual lookup uses the Stripe invoice id which we exposed as the InvoiceItem.invoiceId.
        try {
            com.stripe.model.Invoice invoice = com.stripe.model.Invoice.retrieve(invoiceId.toString());
            String url = invoice.getHostedInvoiceUrl();
            if (Strings.isNullOrEmpty(url)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Invoice has no hosted URL");
            }
            return "<!DOCTYPE html><html><head><meta http-equiv=\"refresh\" content=\"0; url="
                    + url + "\"/></head><body><a href=\"" + url + "\">View invoice on Stripe</a></body></html>";
        } catch (StripeException ex) {
            throw stripeError("getInvoiceHtml", invoiceId.toString(), ex);
        }
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
        AccountStore.Account a = requireAccount(accountId);
        if (Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return Optional.empty();
        }
        try {
            Customer customer = Customer.retrieve(a.getStripeCustomerId());
            String defaultPmId = customer.getInvoiceSettings() == null
                    ? null
                    : customer.getInvoiceSettings().getDefaultPaymentMethod();
            if (Strings.isNullOrEmpty(defaultPmId)) {
                return Optional.empty();
            }
            com.stripe.model.PaymentMethod pm = com.stripe.model.PaymentMethod.retrieve(defaultPmId);
            return Optional.of(synthPaymentMethodDetails(pm, a.getStripeCustomerId()));
        } catch (StripeException ex) {
            throw stripeError("getDefaultPaymentMethodDetails", accountId, ex);
        }
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb) {
        return Optional.empty();
    }

    @Override
    public ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId) {
        // Plan listing comes from PlanStore (StripePlanStore in Stripe mode). Returning empty
        // here is consistent with NoOpBilling/SelfHostBilling.
        return ImmutableSet.of();
    }

    @Override
    public void creditAdjustment(String accountId, long amount, String description) {
        AccountStore.Account a = requireAccount(accountId);
        if (Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return;
        }
        try {
            Customer customer = Customer.retrieve(a.getStripeCustomerId());
            // Positive `amount` here = credit toward the customer; Stripe represents customer
            // credit as negative balance.
            long currentBalance = customer.getBalance() == null ? 0L : customer.getBalance();
            long newBalance = currentBalance - amount * 100;
            customer.update(com.stripe.param.CustomerUpdateParams.builder().setBalance(newBalance).build(),
                    idempotency(accountId, "creditAdjustment:" + amount + ":" + description));
        } catch (StripeException ex) {
            throw stripeError("creditAdjustment", accountId, ex);
        }
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId) {
        // Out of scope -- current paid plans are flat-fee. To enable: post a MeterEvent here.
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, String userId) {
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, UserStore.UserModel user) {
    }

    @Override
    public void finalizeInvoice(String accountId, UUID invoiceId) {
        // Stripe finalizes invoices automatically per the subscription's collection mode.
    }

    @Override
    public void closeAccount(String accountId) {
        AccountStore.Account a = accountStore.getAccount(accountId, true).orElse(null);
        if (a == null || Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return;
        }
        try {
            // Cancel any non-terminal subscriptions, but do NOT delete the Stripe Customer.
            // Customer deletion is irreversible and destroys invoice/tax history that we
            // may need for reporting, compliance, refunds, or chargebacks. Compare with
            // KillBill.closeAccount which leaves the customer record intact. If a real
            // erasure (e.g. GDPR right-to-be-forgotten) is needed, do it explicitly via a
            // dedicated super-admin path -- not as a side effect of account deletion.
            cancelAllSubscriptionsImmediately(accountId);
        } catch (Exception ex) {
            log.warn("Stripe: closeAccount failed for {} (continuing)", accountId, ex);
        }
    }

    /* ============================ helpers ============================ */

    private AccountStore.Account requireAccount(String accountId) {
        return accountStore.getAccount(accountId, true)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));
    }

    private RequestOptions idempotency(String accountId, String operation) {
        return RequestOptions.builder()
                .setIdempotencyKey("cf:" + accountId + ":" + operation)
                .build();
    }

    public Optional<String> resolvePriceId(String planId) {
        if (Strings.isNullOrEmpty(planId)) {
            return Optional.empty();
        }
        String cached = planIdToPriceId.getIfPresent(planId);
        if (cached != null) {
            return Optional.of(cached);
        }
        try {
            PriceListParams params = PriceListParams.builder()
                    .setActive(true)
                    .setLimit(config.listPageSize())
                    .build();
            Iterable<Price> page = Price.list(params).autoPagingIterable();
            for (Price price : page) {
                if (price.getMetadata() != null
                        && planId.equals(price.getMetadata().get(META_CLEARFLASK_PLAN_ID))
                        // Skip per-customer one-offs
                        && Strings.isNullOrEmpty(price.getMetadata().get(META_ONE_OFF_FOR_ACCOUNT))) {
                    planIdToPriceId.put(planId, price.getId());
                    return Optional.of(price.getId());
                }
            }
        } catch (StripeException ex) {
            log.warn("Stripe: failed to resolve price for plan {}", planId, ex);
        }
        return Optional.empty();
    }

    private Optional<String> resolveProductId(String planId) throws StripeException {
        Optional<String> priceIdOpt = resolvePriceId(planId);
        if (priceIdOpt.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(Price.retrieve(priceIdOpt.get()).getProduct());
    }

    private String createOrReuseOneOffMonthlyPrice(String accountId, String planId, long monthlyAmount) throws StripeException {
        String productId = resolveProductId(planId)
                .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                        "Plan " + planId + " is not configured in Stripe"));
        PriceCreateParams priceParams = PriceCreateParams.builder()
                .setUnitAmount(monthlyAmount * 100)
                .setCurrency("usd")
                .setProduct(productId)
                .setRecurring(PriceCreateParams.Recurring.builder()
                        .setInterval(PriceCreateParams.Recurring.Interval.MONTH)
                        .build())
                .putMetadata(META_CLEARFLASK_PLAN_ID, planId)
                .putMetadata(META_ONE_OFF_FOR_ACCOUNT, accountId)
                .build();
        Price price = Price.create(priceParams,
                idempotency(accountId, "createOneOffPrice:" + planId + ":" + monthlyAmount));
        return price.getId();
    }

    private Optional<Subscription> findActiveSubscription(AccountStore.Account a) throws StripeException {
        return Optional.ofNullable(loadSubSnapshot(a).sub);
    }

    private boolean customerHasPaymentMethod(AccountStore.Account a) throws StripeException {
        return loadSubSnapshot(a).hasPaymentMethod;
    }

    /**
     * Single Stripe round-trip that produces the live subscription + has-payment-method
     * pair. Cached for 5s per accountId so the common multi-call path
     * (getSubscription -> getEntitlementStatus -> updateAndGetEntitlementStatus) doesn't
     * fan out to 6+ Stripe API calls per BillingPage load.
     *
     * <p>Subscription priority: {@code active}/{@code trialing}/{@code past_due} rank above
     * {@code paused}/{@code unpaid}/{@code incomplete}, so a fresh signup whose previous
     * {@code incomplete} sub hasn't expired yet still resolves to the live trialing one.
     */
    private SubSnapshot loadSubSnapshot(AccountStore.Account a) throws StripeException {
        if (a == null || Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            return new SubSnapshot(null, false);
        }
        SubSnapshot cached = subSnapshotCache.getIfPresent(a.getAccountId());
        if (cached != null) {
            return cached;
        }
        SubscriptionListParams params = SubscriptionListParams.builder()
                .setCustomer(a.getStripeCustomerId())
                .setStatus(SubscriptionListParams.Status.ALL)
                .setLimit(config.listPageSize())
                .build();
        Subscription best = null;
        int bestRank = Integer.MAX_VALUE;
        for (Subscription s : Subscription.list(params).autoPagingIterable()) {
            int rank = statusRank(s.getStatus());
            if (rank == Integer.MAX_VALUE) continue; // canceled / incomplete_expired
            if (rank < bestRank
                    || (rank == bestRank && best != null && s.getCreated() != null
                            && best.getCreated() != null && s.getCreated() > best.getCreated())) {
                best = s;
                bestRank = rank;
            }
        }
        Customer customer = Customer.retrieve(a.getStripeCustomerId());
        boolean hasPm = customer.getInvoiceSettings() != null
                && !Strings.isNullOrEmpty(customer.getInvoiceSettings().getDefaultPaymentMethod());
        SubSnapshot snap = new SubSnapshot(best, hasPm);
        subSnapshotCache.put(a.getAccountId(), snap);
        return snap;
    }

    /** Lower rank wins. {@code Integer.MAX_VALUE} means terminal / not a candidate. */
    private static int statusRank(String status) {
        if (status == null) return 100;
        switch (status) {
            case "trialing":            return 0;
            case "active":              return 1;
            case "past_due":            return 2;
            case "paused":              return 3;
            case "unpaid":              return 4;
            case "incomplete":          return 5;
            case "canceled":
            case "incomplete_expired":  return Integer.MAX_VALUE;
            default:                    return 50;
        }
    }

    private void invalidateSubCache(String accountId) {
        if (subSnapshotCache != null && !Strings.isNullOrEmpty(accountId)) {
            subSnapshotCache.invalidate(accountId);
        }
    }

    /**
     * Public entry point for webhook handlers (or any external trigger) to invalidate the
     * cached subscription snapshot for an account so the next call hits Stripe fresh.
     */
    public void invalidateSnapshot(String accountId) {
        invalidateSubCache(accountId);
    }

    private Account synthAccount(AccountStore.Account a, Customer customer) {
        UUID synthId = a == null
                ? UUID.fromString("00000000-0000-0000-0000-000000000002")
                : UUID.nameUUIDFromBytes(("stripe:" + a.getAccountId()).getBytes());
        String name = a == null ? "" : a.getName();
        String email = a == null ? "" : a.getEmail();
        String externalKey = a == null ? synthId.toString() : a.getAccountId();
        BigDecimal balance = customer == null || customer.getBalance() == null
                ? BigDecimal.ZERO
                : new BigDecimal(customer.getBalance()).movePointLeft(2).negate();
        return new Account(synthId, name, name == null ? 0 : name.length(),
                externalKey, email,
                0, Currency.USD, null, false,
                null, null, null, null, null,
                null, null, null, null,
                null, null, null, null, false,
                balance, BigDecimal.ZERO, ImmutableList.of());
    }

    private org.killbill.billing.client.model.gen.Subscription synthSubscription(AccountStore.Account a, Subscription stripeSub) {
        String planId = a.getPlanid();
        UUID accountUuid = UUID.nameUUIDFromBytes(("stripe:" + a.getAccountId()).getBytes());
        UUID subUuid = stripeSub == null
                ? accountUuid
                : UUID.nameUUIDFromBytes(("stripe-sub:" + stripeSub.getId()).getBytes());
        boolean isTrial = stripeSub != null && "trialing".equals(stripeSub.getStatus());
        Long trialEnd = stripeSub == null ? null : stripeSub.getTrialEnd();

        ImmutableList.Builder<EventSubscription> events = ImmutableList.builder();
        // Synthesize a phase-change event so AccountResource trial-end logic and
        // TrialEndingReminderService keep working unchanged. The filter does
        // `phase.contains("evergreen") && eventType == PHASE`, so emit lowercase phase.
        if (isTrial && trialEnd != null) {
            EventSubscription evt = new EventSubscription();
            evt.setEventType(org.killbill.billing.entitlement.api.SubscriptionEventType.PHASE);
            evt.setEffectiveDate(LocalDate.fromDateFields(
                    java.util.Date.from(Instant.ofEpochSecond(trialEnd))));
            evt.setPhase("evergreen");
            events.add(evt);
        }

        LocalDate startDate = stripeSub == null || stripeSub.getStartDate() == null
                ? LocalDate.parse("1970-01-01")
                : LocalDate.fromDateFields(java.util.Date.from(Instant.ofEpochSecond(stripeSub.getStartDate())));
        LocalDate periodEnd = stripeSub == null || stripeSub.getCurrentPeriodEnd() == null
                ? LocalDate.parse("2070-01-01")
                : LocalDate.fromDateFields(java.util.Date.from(Instant.ofEpochSecond(stripeSub.getCurrentPeriodEnd())));
        LocalDate cancelledDate = stripeSub != null
                && Boolean.TRUE.equals(stripeSub.getCancelAtPeriodEnd())
                && stripeSub.getCancelAt() != null
                ? LocalDate.fromDateFields(java.util.Date.from(Instant.ofEpochSecond(stripeSub.getCancelAt())))
                : null;

        return new org.killbill.billing.client.model.gen.Subscription(
                accountUuid,                            // accountId
                accountUuid,                            // bundleId
                a.getAccountId(),                       // bundleExternalKey
                subUuid,                                // subscriptionId
                a.getAccountId(),                       // externalKey
                startDate,                              // startDate
                planId,                                 // productName
                ProductCategory.BASE,
                BillingPeriod.MONTHLY,
                isTrial ? PhaseType.TRIAL : PhaseType.EVERGREEN,
                null,                                   // priceList
                planId,                                 // planName
                Entitlement.EntitlementState.ACTIVE,
                Entitlement.EntitlementSourceType.NATIVE,
                cancelledDate,                          // cancelledDate
                periodEnd,                              // chargedThroughDate
                startDate,                              // billingStartDate
                null,                                   // billingEndDate
                0,
                events.build(),
                null,
                ImmutableList.of(new PhasePrice(
                        planId,
                        planId,
                        PhaseType.EVERGREEN.name(),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        ImmutableList.of())),
                ImmutableList.of());
    }

    private PaymentMethodDetails synthPaymentMethodDetails(com.stripe.model.PaymentMethod pm, String customerId) {
        UUID accountUuid = UUID.nameUUIDFromBytes(("stripe:" + customerId).getBytes());
        UUID pmUuid = UUID.nameUUIDFromBytes(("stripe-pm:" + pm.getId()).getBytes());
        com.stripe.model.PaymentMethod.Card card = pm.getCard();
        Optional<String> brand = Optional.ofNullable(card == null ? null : card.getBrand());
        Optional<String> last4 = Optional.ofNullable(card == null ? null : card.getLast4());
        Optional<Long> expMonth = Optional.ofNullable(card == null ? null : card.getExpMonth());
        Optional<Long> expYear = Optional.ofNullable(card == null ? null : card.getExpYear());
        return new PaymentMethodDetails(
                Gateway.STRIPE,
                new PaymentMethod(
                        pmUuid,
                        pm.getId(),
                        accountUuid,
                        true,
                        Gateway.STRIPE.getPluginName(),
                        new PaymentMethodPluginDetail(
                                pm.getId(),
                                true,
                                ImmutableList.of()),
                        ImmutableList.of()),
                brand,
                last4,
                expYear,
                expMonth);
    }

    private RuntimeException stripeError(String op, String accountId, StripeException ex) {
        log.warn("Stripe: operation {} failed for account {} - {}", op, accountId, ex.getMessage());
        return new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                "Failed to contact payment processor, try again later", ex);
    }

    @Override
    public void resetToStripeTrial(AccountStore.Account account, String idempotencySuffix) {
        try {
            createCustomerAndSubscriptionFresh(account, idempotencySuffix);
        } catch (StripeException ex) {
            throw stripeError("resetToStripeTrial", account.getAccountId(), ex);
        }
    }

    @Override
    public boolean hasActiveStripeSubscription(AccountStore.Account account) {
        if (account == null || Strings.isNullOrEmpty(account.getStripeCustomerId())) {
            return false;
        }
        try {
            return findActiveSubscription(account).isPresent();
        } catch (StripeException ex) {
            log.warn("Stripe: hasActiveStripeSubscription check failed for {} (assuming no sub)",
                    account.getAccountId(), ex);
            return false;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeBilling.class).asEagerSingleton();
                bind(Billing.class).annotatedWith(Names.named("stripe")).to(StripeBilling.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(StripeBilling.class).asEagerSingleton();
            }
        };
    }

    /**
     * Helper used by {@link com.smotana.clearflask.web.resource.StripeWebhookResource}
     * to fetch the webhook signing secret. Reads from config override first, then from
     * {@link com.smotana.clearflask.store.ServiceSecretStore}.
     */
    public static final String WEBHOOK_SECRET_NAME = "stripe.webhook.signingSecret";

    @Inject
    private com.smotana.clearflask.store.ServiceSecretStore serviceSecretStore;

    public String webhookSecret() {
        if (!Strings.isNullOrEmpty(config.webhookSecretOverride())) {
            return config.webhookSecretOverride();
        }
        return serviceSecretStore.get(WEBHOOK_SECRET_NAME)
                .orElseThrow(() -> new ApiException(Response.Status.SERVICE_UNAVAILABLE,
                        "Stripe webhook signing secret not configured"));
    }
}
