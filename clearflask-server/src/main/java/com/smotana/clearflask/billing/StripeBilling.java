package com.smotana.clearflask.billing;


import com.google.inject.Singleton;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.Subscription;

import javax.servlet.http.HttpServletRequest;
import java.util.Optional;

@Singleton
public interface StripeBilling {

    Event parseEvent(HttpServletRequest request);

    Customer createCustomer(String accountId, String email, String name);

    Customer getCustomer(String customerId);

    Optional<String> getCustomerAccountId(Customer customer);

    Subscription createSubscription(String customerId, String stripePriceId, long trialPeriodInDays);

    void updatedSubscription(Customer customer, Subscription subscription);

    Customer updatedPayment(Customer customer, String paymentToken);
}
