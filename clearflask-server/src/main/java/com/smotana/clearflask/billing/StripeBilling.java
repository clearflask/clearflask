package com.smotana.clearflask.billing;


import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.api.model.BillingHistory;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.Subscription;

import javax.servlet.http.HttpServletRequest;
import java.util.Optional;

@Singleton
public interface StripeBilling {

    Event parseWebhookEvent(HttpServletRequest request);

    Customer createCustomer(String accountId, String email, String name);

    Customer getCustomer(String customerId);

    Optional<String> getCustomerAccountId(Customer customer);

    Subscription createSubscription(String customerId, String stripePriceId, long trialPeriodInDays);

    Subscription getSubscription(String customerId);

    SubscriptionStatusEnum getSubscriptionStatusFrom(Customer customer, Subscription subscription);

    void updatePaymentToken(String customerId, String paymentToken);

    Subscription cancelSubscription(String customerId);

    Subscription resumeSubscription(String customerId, String planPriceId);

    Subscription changePrice(String customerId, String stripePriceId);

    BillingHistory billingHistory(String customerId, Optional<String> cursorOpt);
}
