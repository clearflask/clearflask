// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.UserStore.UserModel;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.PlanDetail;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;
import java.util.UUID;

/**
 * Routes billing calls to the appropriate implementation based on account configuration.
 * <p>
 * Routing logic:
 * 1. If account has stripeCustomerId set, use StripeBilling
 * 2. If StripeBillingConfig.useStripeForNewSignups() is true AND this is a new signup, use StripeBilling
 * 3. Otherwise, use KillBilling
 * <p>
 * This allows for gradual migration from KillBill to Stripe.
 */
@Slf4j
@Singleton
public class BillingRouter implements Billing {

    @Inject
    private StripeBillingConfig stripeBillingConfig;

    @Inject
    @Named("killbill")
    private Provider<Billing> killBillingProvider;

    @Inject
    @Named("stripe")
    private Provider<Billing> stripeBillingProvider;

    @Inject
    private AccountStore accountStore;

    /**
     * Thread-local flag for forcing test mode (set via ?stripe_test=1 query parameter)
     */
    private static final ThreadLocal<Boolean> forceStripeTestMode = ThreadLocal.withInitial(() -> false);

    /**
     * Thread-local flag for forcing Stripe billing (for new signups with test mode enabled)
     */
    private static final ThreadLocal<Boolean> forceStripeBilling = ThreadLocal.withInitial(() -> false);

    /**
     * Call this from request filter when ?stripe_test=1 is detected
     */
    public static void setForceStripeTestMode(boolean force) {
        forceStripeTestMode.set(force);
    }

    public static boolean isForceStripeTestMode() {
        return forceStripeTestMode.get();
    }

    /**
     * Call this to force using Stripe billing for the current request
     */
    public static void setForceStripeBilling(boolean force) {
        forceStripeBilling.set(force);
    }

    public static boolean isForceStripeBilling() {
        return forceStripeBilling.get();
    }

    /**
     * Clear thread-local flags (should be called after request processing)
     */
    public static void clearThreadLocals() {
        forceStripeTestMode.remove();
        forceStripeBilling.remove();
    }

    /**
     * Determine which billing implementation to use for a given account.
     */
    private Billing getBillingForAccount(String accountId) {
        if (forceStripeBilling.get()) {
            log.debug("Using StripeBilling for account {} due to forced stripe billing flag", accountId);
            return stripeBillingProvider.get();
        }

        Optional<Account> accountOpt = accountStore.getAccount(accountId, true);
        if (accountOpt.isPresent() && !Strings.isNullOrEmpty(accountOpt.get().getStripeCustomerId())) {
            log.debug("Using StripeBilling for account {} (has stripeCustomerId)", accountId);
            return stripeBillingProvider.get();
        }

        log.debug("Using KillBilling for account {}", accountId);
        return killBillingProvider.get();
    }

    /**
     * Determine which billing to use for new account creation.
     */
    private Billing getBillingForNewAccount() {
        if (forceStripeBilling.get() || forceStripeTestMode.get()) {
            log.info("Using StripeBilling for new account due to forced stripe mode");
            return stripeBillingProvider.get();
        }

        if (stripeBillingConfig.useStripeForNewSignups()) {
            log.info("Using StripeBilling for new account due to config flag");
            return stripeBillingProvider.get();
        }

        log.debug("Using KillBilling for new account");
        return killBillingProvider.get();
    }

    // === Billing Interface Implementation ===

    @Override
    public void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn) {
        getBillingForNewAccount().createAccountWithSubscriptionAsync(accountInDyn);
    }

    @Override
    public org.killbill.billing.client.model.gen.Account getAccount(String accountId) {
        return getBillingForAccount(accountId).getAccount(accountId);
    }

    @Override
    public org.killbill.billing.client.model.gen.Account getAccountByKbId(UUID accountIdKb) {
        // This is KillBill-specific, delegate to KillBilling
        return killBillingProvider.get().getAccountByKbId(accountIdKb);
    }

    @Override
    public Subscription getSubscription(String accountId) {
        return getBillingForAccount(accountId).getSubscription(accountId);
    }

    @Override
    public Optional<String> getEndOfTermChangeToPlanId(Subscription subscription) {
        String accountId = subscription.getExternalKey();
        return getBillingForAccount(accountId).getEndOfTermChangeToPlanId(subscription);
    }

    @Override
    public SubscriptionStatus getEntitlementStatus(org.killbill.billing.client.model.gen.Account account, Subscription subscription) {
        String accountId = account.getExternalKey();
        return getBillingForAccount(accountId).getEntitlementStatus(account, subscription);
    }

    @Override
    public SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, org.killbill.billing.client.model.gen.Account account, Subscription subscription, String reason) {
        String accountId = account.getExternalKey();
        return getBillingForAccount(accountId).updateAndGetEntitlementStatus(currentStatus, account, subscription, reason);
    }

    @Override
    public void updatePaymentToken(String accountId, Gateway type, String paymentToken) {
        getBillingForAccount(accountId).updatePaymentToken(accountId, type, paymentToken);
    }

    @Override
    public Optional<AccountBillingPaymentActionRequired> getActions(UUID accountIdKb) {
        // This uses KillBill UUID, delegate to KillBilling
        return killBillingProvider.get().getActions(accountIdKb);
    }

    @Override
    public void syncActions(String accountId) {
        getBillingForAccount(accountId).syncActions(accountId);
    }

    @Override
    public Subscription cancelSubscription(String accountId) {
        return getBillingForAccount(accountId).cancelSubscription(accountId);
    }

    @Override
    public Subscription resumeSubscription(String accountId) {
        return getBillingForAccount(accountId).resumeSubscription(accountId);
    }

    @Override
    public Subscription changePlan(String accountId, String planId, Optional<Long> recurringPriceOpt) {
        return getBillingForAccount(accountId).changePlan(accountId, planId, recurringPriceOpt);
    }

    @Override
    public Subscription changePlanToFlatYearly(String accountId, long yearlyPrice) {
        return getBillingForAccount(accountId).changePlanToFlatYearly(accountId, yearlyPrice);
    }

    @Override
    public boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId) {
        return getBillingForAccount(accountInDyn.getAccountId()).tryAutoUpgradePlan(accountInDyn, requiredPlanId);
    }

    @Override
    public Optional<AccountStore.Account> tryAutoUpgradeAfterSelfhostLicenseAdded(AccountStore.Account accountInDyn) {
        return getBillingForAccount(accountInDyn.getAccountId()).tryAutoUpgradeAfterSelfhostLicenseAdded(accountInDyn);
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        return getBillingForAccount(accountId).getInvoices(accountId, cursorOpt);
    }

    @Override
    public String getInvoiceHtml(UUID invoiceId, Optional<String> accountIdOpt) {
        if (accountIdOpt.isPresent()) {
            return getBillingForAccount(accountIdOpt.get()).getInvoiceHtml(invoiceId, accountIdOpt);
        }
        // If no account ID, default to KillBilling
        return killBillingProvider.get().getInvoiceHtml(invoiceId, accountIdOpt);
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
        return getBillingForAccount(accountId).getDefaultPaymentMethodDetails(accountId);
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb) {
        // This uses KillBill UUID, delegate to KillBilling
        return killBillingProvider.get().getDefaultPaymentMethodDetails(accountIdKb);
    }

    @Override
    public ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId) {
        if (accountId.isPresent()) {
            return getBillingForAccount(accountId.get()).getAvailablePlans(accountId);
        }
        // For anonymous users, check if Stripe is enabled for new signups
        if (stripeBillingConfig.useStripeForNewSignups() || forceStripeBilling.get() || forceStripeTestMode.get()) {
            return stripeBillingProvider.get().getAvailablePlans(accountId);
        }
        return killBillingProvider.get().getAvailablePlans(accountId);
    }

    @Override
    public void creditAdjustment(String accountId, long amount, String description) {
        getBillingForAccount(accountId).creditAdjustment(accountId, amount, description);
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId) {
        getBillingForAccount(accountId).recordUsage(type, accountId, projectId);
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, String userId) {
        getBillingForAccount(accountId).recordUsage(type, accountId, projectId, userId);
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, UserModel user) {
        getBillingForAccount(accountId).recordUsage(type, accountId, projectId, user);
    }

    @Override
    public void finalizeInvoice(String accountId, UUID invoiceId) {
        getBillingForAccount(accountId).finalizeInvoice(accountId, invoiceId);
    }

    @Override
    public void closeAccount(String accountId) {
        getBillingForAccount(accountId).closeAccount(accountId);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Billing.class).to(BillingRouter.class).asEagerSingleton();
                install(StripeBillingConfig.module());
            }
        };
    }
}
