package com.smotana.clearflask.billing;


import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.api.model.BillingHistory;
import com.smotana.clearflask.api.model.BillingHistoryItem;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.stripe.exception.StripeException;
import com.stripe.model.*;
import com.stripe.param.*;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.AccountApi;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.model.gen.Account;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Comparator;
import java.util.Optional;
import java.util.stream.StreamSupport;

@Slf4j
@Singleton
public class KillBillingImpl implements Billing {

    public interface Config {
    }

    @Inject
    private Config config;
    @Inject
    private AccountStore accountStore;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;
    @Inject
    private CatalogApi kbCatalog;
    @Inject
    private AccountApi kbAccount;

    @Override
    public Customer createCustomer(String accountId, String email, String name) {

        return kbAccount.createAccount(new Account()
                .setExternalKey()
                .setName(name)
                .setEmail(email), RequestOptions.empty());

        try {
            return Customer.create(CustomerCreateParams.builder()
                    .setEmail(email)
                    .setName(name)
                    .setMetadata(ImmutableMap.of(METADATA_KEY_CUSTOMER_ACCOUNT_ID, accountId))
                    .build());
        } catch (StripeException ex) {
            log.error("Failed to create Stripe customer", ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor, try again later");
        }
    }

    @Override
    public Customer getCustomer(String customerId) {
        try {
            return Customer.retrieve(customerId);
        } catch (StripeException ex) {
            log.error("Failed to retrieve customer by id {}", customerId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Customer not found");
        }
    }

    @Override
    public Optional<String> getCustomerAccountId(Customer customer) {
        return Optional.ofNullable(customer.getMetadata().getOrDefault(METADATA_KEY_CUSTOMER_ACCOUNT_ID, null));
    }

    @Override
    public Subscription createSubscription(String customerId, String stripePriceId, long trialPeriodInDays) {
        try {
            return Subscription.create(SubscriptionCreateParams.builder()
                    .addAddInvoiceItem(SubscriptionCreateParams.AddInvoiceItem.builder()
                            .setPrice(stripePriceId)
                            .build())
                    .setCustomer(customerId)
                    .setTrialPeriodDays(trialPeriodInDays)
                    .build());
        } catch (StripeException ex) {
            log.error("Failed to create Stripe subscription on signup", ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to contact payment processor, try again later");
        }
    }

    @Override
    public Subscription getSubscription(String customerId) {
        Optional<Subscription> subscriptionOpt;
        try {
            subscriptionOpt = StreamSupport.stream(Subscription.list(SubscriptionListParams.builder()
                    .setStatus(SubscriptionListParams.Status.ALL)
                    .setCustomer(customerId)
                    .build())
                    .autoPagingIterable().spliterator(), false)
                    .max(Comparator.comparingLong(Subscription::getCreated));
        } catch (StripeException ex) {
            log.error("Failed to retrieve subscriptions by customer id {}", customerId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Subscription not found");
        }
        if (!subscriptionOpt.isPresent()) {
            log.error("Customer has no subscriptions {}", customerId);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Subscription not found");
        }
        return subscriptionOpt.get();
    }

    @Override
    public SubscriptionStatusEnum getSubscriptionStatusFrom(Customer customer, Subscription subscription) {
        switch (StripeSubscriptionStatus.byString.get(subscription.getStatus())) {
            case ACTIVE:
                if (subscription.getCancelAtPeriodEnd() == Boolean.TRUE) {
                    return SubscriptionStatusEnum.ACTIVENORENEWAL;
                } else {
                    return SubscriptionStatusEnum.ACTIVE;
                }
            case TRIALING:
                return SubscriptionStatusEnum.ACTIVETRIAL;
            case INCOMPLETE:
                if (customer.getSources().getData().isEmpty()) {
                    return SubscriptionStatusEnum.TRIALEXPIRED;
                }
            case PAST_DUE:
            case UNPAID:
                return SubscriptionStatusEnum.ACTIVEPAYMENTRETRY;
            case INCOMPLETE_EXPIRED:
                if (customer.getSources().getData().isEmpty()) {
                    return SubscriptionStatusEnum.TRIALEXPIRED;
                } else {
                    return SubscriptionStatusEnum.PAYMENTFAILED;
                }
            case CANCELED:
                if (customer.getDelinquent() == Boolean.TRUE) {
                    return SubscriptionStatusEnum.PAYMENTFAILED;
                } else {
                    return SubscriptionStatusEnum.CANCELLED;
                }
            default:
                log.error("Unknown subscription status {} for id {} customer id {}",
                        subscription.getStatus(), subscription.getId(), customer.getId());
                throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to process");
        }
    }

    @Override
    public void updatePaymentToken(String customerId, String paymentToken) {
        Customer customer = getCustomer(customerId);
        try {
            customer.update(CustomerUpdateParams.builder()
                    .setSource(paymentToken)
                    .build());
        } catch (StripeException ex) {
            log.error("Failed to update customer {} source {}", customerId, paymentToken, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to update payment method");
        }
    }

    @Override
    public Subscription cancelSubscription(String customerId) {
        Subscription subscription = getSubscription(customerId);
        switch (StripeSubscriptionStatus.byString.get(subscription.getStatus())) {
            case ACTIVE:
                try {
                    return subscription.update(SubscriptionUpdateParams.builder()
                            .setCancelAtPeriodEnd(Boolean.TRUE)
                            .build());
                } catch (StripeException ex) {
                    log.error("Failed to update subscription with cancel at period end with status {} id {} customer id {}",
                            subscription.getStatus(), subscription.getId(), customerId);
                    throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to cancel");
                }
            case TRIALING:
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Trial cannot be cancelled");
            case INCOMPLETE:
            case PAST_DUE:
            case UNPAID:
                try {
                    return subscription.cancel();
                } catch (StripeException e) {
                    log.error("Failed to cancel subscription with status {} id {} customer id {}",
                            subscription.getStatus(), subscription.getId(), customerId);
                    throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to cancel");
                }
            case INCOMPLETE_EXPIRED:
            case CANCELED:
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Subscription already cancelled");
            default:
                log.error("Unknown subscription status {} for id {} customer id {}",
                        subscription.getStatus(), subscription.getId(), customerId);
                throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to process");
        }
    }

    @Override
    public Subscription resumeSubscription(String customerId, String planPriceId) {
        Subscription subscription = getSubscription(customerId);
        switch (StripeSubscriptionStatus.byString.get(subscription.getStatus())) {
            case ACTIVE:
            case TRIALING:
            case INCOMPLETE:
            case PAST_DUE:
            case UNPAID:
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Subscription already active");
            case INCOMPLETE_EXPIRED:
            case CANCELED:
                return createSubscription(customerId, planPriceId, 0L);
            default:
                log.error("Unknown subscription status {} for id {} customer id {}",
                        subscription.getStatus(), subscription.getId(), customerId);
                throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to process");
        }
    }

    @Override
    public Subscription changePrice(String customerId, String stripePriceId) {
        Subscription subscription = getSubscription(customerId);
        switch (StripeSubscriptionStatus.byString.get(subscription.getStatus())) {
            case ACTIVE:
            case TRIALING:
                if (subscription.getItems().getData().size() != 1) {
                    log.error("Cannot change subscription {} price with unexpected number of items {}",
                            subscription.getId(), subscription.getItems().getData().size());
                    throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
                }
                try {
                    return subscription.update(SubscriptionUpdateParams.builder()
                            .addItem(SubscriptionUpdateParams.Item.builder()
                                    // Replace existing item by setting the same id
                                    .setId(subscription.getItems().getData().get(0).getId())
                                    .setPrice(stripePriceId)
                                    .build())
                            .setProrationBehavior(SubscriptionUpdateParams.ProrationBehavior.CREATE_PRORATIONS)
                            .build());
                } catch (StripeException ex) {
                    log.error("Failed to update subscription {} price {} for customerId {}", subscription.getId(), stripePriceId, customerId);
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                            "Failed to change price");
                }
            case INCOMPLETE:
            case PAST_DUE:
            case UNPAID:
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Cannot change price on subscription not in good standing");
            case INCOMPLETE_EXPIRED:
            case CANCELED:
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Cannot change price on inactive subscription");
            default:
                log.error("Unknown subscription status {} for id {} customer id {}",
                        subscription.getStatus(), subscription.getId(), customerId);
                throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                        "Failed to process");
        }
    }

    @Override
    public BillingHistory billingHistory(String customerId, Optional<String> cursorOpt) {
        InvoiceCollection invoiceList;
        try {
            invoiceList = Invoice.list(InvoiceListParams.builder()
                    .setCustomer(customerId)
                    .setStartingAfter(cursorOpt.map(serverSecretCursor::decryptString).orElse(null))
                    .build());
        } catch (StripeException e) {
            log.error("Failed to search invoices for customerId {} cursorOpt {}", customerId, cursorOpt);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to list invoices");
        }
        return new BillingHistory(
                (invoiceList.getHasMore() == Boolean.TRUE && !invoiceList.getData().isEmpty())
                        ? serverSecretCursor.encryptString(invoiceList.getData().get(invoiceList.getData().size() - 1).getId())
                        : null,
                invoiceList.getData().stream()
                        .map(i -> new BillingHistoryItem(
                                Instant.ofEpochSecond(i.getDueDate()),
                                i.getStatus(),
                                i.getAmountDue(),
                                i.getDescription(),
                                i.getHostedInvoiceUrl()))
                        .collect(ImmutableList.toImmutableList()));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Billing.class).to(KillBillingImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(KillBillingImpl.class);
            }
        };
    }
}
