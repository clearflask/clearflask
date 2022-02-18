// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
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

    Subscription changePlan(String accountId, String planId);

    Subscription changePlanToFlatYearly(String accountId, long yearlyPrice);

    /**
     * If user attempts to use a feature outside of their plan determined by PlanStore's
     * verifyActionMeetsPlanRestrictions
     * and verifyConfigMeetsPlanRestrictions, try to auto-upgrade to required plan.
     *
     * Possible at least in these circumstance:
     * - When on trial period without payment method set.
     * - When on Teammate Plan switching to a real plan.
     *
     * @return True if eligible for auto-upgrade and upgrade is kicked off in background
     */
    boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId);

    Invoices getInvoices(String accountId, Optional<String> cursorOpt);

    String getInvoiceHtml(String accountId, UUID invoiceId);

    Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId);

    Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb);

    ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId);

    void creditAdjustment(String accountId, long amount, String description);

    void recordUsage(UsageType type, String accountId, String projectId);

    void recordUsage(UsageType type, String accountId, String projectId, String userId);

    void recordUsage(UsageType type, String accountId, String projectId, UserModel user);

    void finalizeInvoice(String accountId, UUID invoiceId);

    void closeAccount(String accountId);

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
