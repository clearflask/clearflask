package com.smotana.clearflask.billing;


import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.api.model.BillingHistory;
import com.smotana.clearflask.api.model.Invoices;
import lombok.Value;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.Subscription;

import java.util.Optional;

@Singleton
public interface Billing {

    AccountWithSubscription createAccountWithSubscription(String email, String name, String accountExternalKey, String subscriptionExternalKey, String planId);

    Account getAccount(String accountExternalKey);

    Subscription getSubscription(String accountExternalKey);

    SubscriptionStatusEnum getSubscriptionStatusFrom(Account accountExternalKey, Subscription subscriptionExternalKey);

    void updatePaymentToken(String accountExternalKey, Gateway type, String paymentToken);

    Subscription cancelSubscription(String subscriptionExternalKey);

    /**
     * Used in all use cases:
     * - Uncancelling subscription pending cancellation
     * - Changing existing subscription to another subscription
     * - Subscribing a new subscription (From a previously cancelled one)
     */
    Subscription enableSubscription(String accountExternalKey, String subscriptionExternalKey, String planId);

    Invoices billingHistory(String customerId, Optional<String> cursorOpt);

    BillingHistory billingHistory(String customerId, Optional<String> cursorOpt);

    @Value
    class AccountWithSubscription {
        Account account;
        Subscription subscription;
    }

    enum Gateway {
        STRIPE("killbill-stripe"),
        NOOP("__EXTERNAL_PAYMENT__");

        private final String pluginName;

        Gateway(String pluginName) {
            this.pluginName = pluginName;
        }

        public String getPluginName() {
            return pluginName;
        }
    }
}
