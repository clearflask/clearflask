package com.smotana.clearflask.billing;


import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import lombok.Value;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.PlanDetail;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;
import java.util.UUID;

import static com.smotana.clearflask.billing.KillBillClientProvider.STRIPE_PLUGIN_NAME;

public interface Billing {

    ImmutableSet<SubscriptionStatus> SUBSCRIPTION_STATUS_ACTIVE_ENUMS = Sets.immutableEnumSet(
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.ACTIVENORENEWAL,
            SubscriptionStatus.ACTIVEPAYMENTRETRY,
            SubscriptionStatus.ACTIVETRIAL);

    AccountWithSubscription createAccountWithSubscription(String accountId, String email, String name, String planId);

    Account getAccount(String accountId);

    Account getAccountByKbId(UUID accountIdKb);

    Subscription getSubscription(String accountId);

    SubscriptionStatus getEntitlementStatus(Account account, Subscription subscription, Optional<SubscriptionStatus> previousStatus);

    void updatePaymentToken(String accountId, Gateway type, String paymentToken);

    void deletePaymentMethod(String accountId);

    Subscription cancelSubscription(String accountId);

    Subscription undoPendingCancel(String accountId);

    Subscription endTrial(String accountId);

    Subscription changePlan(String accountId, String planId);

    Subscription activateSubscription(String accountId, String planId);

    Invoices getInvoices(String accountId, Optional<String> cursorOpt);

    String getInvoiceHtml(String accountId, long invoiceNumber);

    Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId);

    ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId);

    ListenableFuture<Void> recordUsage(UsageType type, String accountId, String projectId, String userId);

    long getUsageCurrentPeriod(String accountId);

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
        COMMENT,
        VOTE
    }
}
