// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;


import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import lombok.Value;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.PlanDetail;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;
import java.util.UUID;

import static com.smotana.clearflask.billing.KillBillClientProvider.PAYMENT_TEST_PLUGIN_NAME;
import static com.smotana.clearflask.billing.KillBillClientProvider.STRIPE_PLUGIN_NAME;

public interface Billing {

    ImmutableSet<SubscriptionStatus> SUBSCRIPTION_STATUS_ACTIVE_ENUMS = Sets.immutableEnumSet(
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.ACTIVENORENEWAL,
            SubscriptionStatus.ACTIVEPAYMENTRETRY,
            SubscriptionStatus.ACTIVETRIAL);

    void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn);

    Account getAccount(String accountId);

    Account getAccountByKbId(UUID accountIdKb);

    Subscription getSubscription(String accountId);

    Optional<String> getEndOfTermChangeToPlanId(Subscription subscription);

    SubscriptionStatus getEntitlementStatus(Account account, Subscription subscription);

    SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, Account account, Subscription subscription, String reason);

    void updatePaymentToken(String accountId, Gateway type, String paymentToken);

    Optional<AccountBillingPaymentActionRequired> getActions(UUID accountIdKb);

    void syncActions(String accountId);

    Subscription cancelSubscription(String accountId);

    Subscription resumeSubscription(String accountId);

    Subscription changePlan(String accountId, String planId, Optional<Long> recurringPriceOpt);

    Subscription changePlanToFlatYearly(String accountId, long yearlyPrice);

    /**
     * If user attempts to use a feature outside of their plan determined by PlanStore's
     * verifyActionMeetsPlanRestrictions
     * and verifyConfigMeetsPlanRestrictions, try to auto-upgrade to required plan.
     * <p>
     * Possible at least in these circumstance:
     * - When on trial period without payment method set.
     * - When on Teammate Plan switching to a real plan.
     *
     * @return True if eligible for auto-upgrade and upgrade is kicked off in background
     */
    boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId);

    Optional<AccountStore.Account> tryAutoUpgradeAfterSelfhostLicenseAdded(AccountStore.Account accountInDyn);

    Invoices getInvoices(String accountId, Optional<String> cursorOpt);

    String getInvoiceHtml(UUID invoiceId, Optional<String> accountIdOpt);

    Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId);

    Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb);

    ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId);

    void creditAdjustment(String accountId, long amount, String description);

    void recordUsage(UsageType type, String accountId, String projectId);

    void recordUsage(UsageType type, String accountId, String projectId, String userId);

    void recordUsage(UsageType type, String accountId, String projectId, UserModel user);

    void finalizeInvoice(String accountId, UUID invoiceId);

    void closeAccount(String accountId);

    /**
     * Stripe-only: create a Stripe Checkout Session for the given account's plan and return
     * the redirect URL. Other billing backends throw a clear error.
     *
     * <p>{@code targetPlanIdOpt} overrides {@code account.planid} for the session's Stripe
     * Price lookup. Used by the grandfathered-to-paid upgrade path so the local planid is
     * only written when Checkout completes (via the webhook/finalize), not eagerly on plan
     * selection. Empty/absent uses {@code account.planid}.
     */
    default String createCheckoutSession(AccountStore.Account account, Optional<String> targetPlanIdOpt) {
        throw new com.smotana.clearflask.web.ApiException(
                javax.ws.rs.core.Response.Status.BAD_REQUEST,
                "Stripe Checkout is not available in this billing mode");
    }

    /**
     * Stripe-only: create a Stripe Customer Portal session for the given account and return
     * the redirect URL.
     */
    default String createPortalSession(String accountId) {
        throw new com.smotana.clearflask.web.ApiException(
                javax.ws.rs.core.Response.Status.BAD_REQUEST,
                "Stripe Customer Portal is not available in this billing mode");
    }

    /**
     * Stripe-only: finalize a completed Checkout Session by setting account.stripeCustomerId
     * from the resulting Stripe Customer. Idempotent.
     */
    default void finalizeCheckoutSession(String sessionId) {
        // No-op for non-Stripe backends; the success-URL callback may be hit even if Stripe
        // isn't the routing target for that account.
    }

    /**
     * Cancel a subscription as part of an internal migration (e.g. KillBill -> Stripe handoff).
     * Bypasses the user-facing guards that {@link #cancelSubscription} enforces — specifically,
     * KillBilling refuses to cancel a TRIAL-phase subscription via the normal path
     * ("delete account instead"), which blocks a migration where the user is mid-trial.
     * Implementations should cancel best-effort.
     */
    default Subscription cancelSubscriptionForMigration(String accountId) {
        return cancelSubscription(accountId);
    }

    /**
     * Stripe-only: cancel any existing (non-terminal) Stripe Subscription on this account
     * immediately, no proration, no final invoice. Best-effort: never throws -- caller
     * proceeds even if cancellation fails.
     */
    default void cancelAllSubscriptionsImmediately(String accountId) {
        // No-op for non-Stripe backends.
    }

    /**
     * Stripe-only: put the account on a fresh Stripe-billed plan with a new 14-day trial,
     * as if the user just signed up. Reuses {@code account.stripeCustomerId} if already
     * set; otherwise creates a new Stripe Customer. Caller is responsible for cancelling
     * any prior subscription first.
     *
     * <p>Throws on non-Stripe backends (the action only makes sense in cloud / Stripe mode).
     *
     * @param idempotencySuffix appended to per-account Stripe idempotency keys so that
     *                          re-running the reset on the same account creates a fresh
     *                          Subscription rather than returning the prior cancelled one.
     */
    default void resetToStripeTrial(AccountStore.Account account, String idempotencySuffix) {
        throw new com.smotana.clearflask.web.ApiException(
                javax.ws.rs.core.Response.Status.BAD_REQUEST,
                "Stripe-trial reset is not available in this billing mode");
    }

    /**
     * Returns true if the account currently has a live Stripe Subscription (trialing,
     * active, past_due, or unpaid). Used by the reset endpoint to gate against
     * accidentally wiping an actually-paying customer. Returns false on non-Stripe
     * backends or when the account has no Stripe customer at all.
     */
    default boolean hasActiveStripeSubscription(AccountStore.Account account) {
        return false;
    }

    @Value
    class AccountWithSubscription {
        Account account;
        Subscription subscription;
    }

    @Value
    class PaymentMethodDetails {
        Gateway gateway;
        PaymentMethod paymentMethod;
        Optional<String> cardBrand;
        Optional<String> cardLast4;
        Optional<Long> cardExpiryYear;
        Optional<Long> cardExpiryMonth;
    }

    enum Gateway {
        STRIPE(STRIPE_PLUGIN_NAME, true),
        PAYMENT_TEST(PAYMENT_TEST_PLUGIN_NAME, false),
        EXTERNAL("__EXTERNAL_PAYMENT__", false),
        OTHER("unknown", false);

        private final String pluginName;
        private final boolean allowedInProduction;

        Gateway(String pluginName, boolean allowedInProduction) {
            this.pluginName = pluginName;
            this.allowedInProduction = allowedInProduction;
        }

        public String getPluginName() {
            return pluginName;
        }

        public boolean isAllowedInProduction() {
            return allowedInProduction;
        }
    }


    enum UsageType {
        POST,
        POST_DELETED,
        COMMENT,
        VOTE
    }
}
