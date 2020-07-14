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
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.AccountApi;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.api.gen.SubscriptionApi;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.PaymentMethodPluginDetail;
import org.killbill.billing.client.model.gen.Subscription;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Singleton
public class KillBilling implements Billing {

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
    @Inject
    private SubscriptionApi kbSubscription;

    @Override
    public AccountWithSubscription createAccountWithSubscription(String email, String name, String accountExternalKey, String subscriptionExternalKey, String planId) {
        Account account;
        try {
            account = kbAccount.createAccount(new Account()
                    .setExternalKey(accountExternalKey)
                    .setName(name)
                    .setEmail(email), RequestOptions.empty());
        } catch (KillBillClientException ex) {
            log.error("Failed to create KillBill Account for email {} name {}", email, name, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor, try again later");
        }

        Subscription subscription;
        try {
            subscription = kbSubscription.createSubscription(new Subscription()
                            .setExternalKey(subscriptionExternalKey)
                            .setAccountId(account.getAccountId())
                            .setPlanName(planId),
                    null,
                    null,
                    false,
                    false,
                    false,
                    null,
                    null,
                    RequestOptions.empty());
        } catch (KillBillClientException ex) {
            log.error("Failed to create KillBill Subscription for accountId {} email {} name {}", account.getAccountId(), email, name, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor, try again later");
        }

        return new AccountWithSubscription(account, subscription);
    }

    @Override
    public Account getAccount(String accountExternalKey) {
        try {
            return kbAccount.getAccountByKey(accountExternalKey, RequestOptions.empty());
        } catch (KillBillClientException ex) {
            log.error("Failed to retrieve KillBill Account by external id {}", accountExternalKey, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Account");
        }
    }

    @Override
    public Subscription getSubscription(String subscriptionExternalKey) {
        try {
            return kbSubscription.getSubscriptionByKey(subscriptionExternalKey, RequestOptions.empty());
        } catch (KillBillClientException ex) {
            log.error("Failed to retrieve KillBill Subscription by external id {}", subscriptionExternalKey, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Subscription");
        }
    }

    @Override
    public SubscriptionStatusEnum getSubscriptionStatusFrom(Account account, Subscription subscription) {
        // TODO All of this needs to be verified
        switch (subscription.getState()) {
            case ACTIVE:
                if (subscription.getCancelledDate() != null) {
                    return SubscriptionStatusEnum.ACTIVENORENEWAL;
                } else if (PhaseType.TRIAL.equals(subscription.getPhaseType())) {
                    return SubscriptionStatusEnum.ACTIVETRIAL;
                } else {
                    return SubscriptionStatusEnum.ACTIVE;
                }
            case BLOCKED:
                if (PhaseType.TRIAL.equals(subscription.getPhaseType())) {
                    return SubscriptionStatusEnum.TRIALEXPIRED;
                } else {
                    return SubscriptionStatusEnum.PAYMENTFAILED;
                }
            case EXPIRED:
            case PENDING:
            case CANCELLED:
                return SubscriptionStatusEnum.CANCELLED;
            default:
                log.error("Unsupported subscription state {} for ext id {} account ext id {}",
                        subscription.getState(), subscription.getExternalKey(), account.getExternalKey());
                throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to process");
        }
    }

    @Override
    public void updatePaymentToken(String accountExternalKey, Gateway gateway, String paymentToken) {
        try {
            Account account = kbAccount.getAccountByKey(accountExternalKey, RequestOptions.empty());
            kbAccount.createPaymentMethod(
                    account.getAccountId(),
                    new PaymentMethod(
                            null,
                            null,
                            account.getAccountId(),
                            true,
                            gateway.getPluginName(),
                            new PaymentMethodPluginDetail(),
                            ImmutableList.of()),
                    true,
                    true,
                    null,
                    ImmutableMap.of("token", paymentToken),
                    RequestOptions.empty());
        } catch (KillBillClientException ex) {
            log.error("Failed to update KillBill payment token for account external id {}", accountExternalKey, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to update payment method");
        }
    }

    @Override
    public Subscription cancelSubscription(String subscriptionExternalKey) {
        try {
            Subscription subscription = kbSubscription.getSubscriptionByKey(subscriptionExternalKey, RequestOptions.empty());
            kbSubscription.cancelSubscriptionPlan(
                    subscription.getSubscriptionId(),
                    null,
                    true,
                    15L,
                    null,
                    null,
                    null,
                    ImmutableMap.of(),
                    RequestOptions.empty());
            return kbSubscription.getSubscription(subscription.getSubscriptionId(), RequestOptions.empty());
        } catch (KillBillClientException ex) {
            log.error("Failed to cancel KillBill subscription for subscription external id {}", subscriptionExternalKey, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to cancel subscription");
        }
    }

    @Override
    public Subscription enableSubscription(String accountExternalKey, String subscriptionExternalKey, String planId) {
        try {
            Subscription subscription = kbSubscription.getSubscriptionByKey(subscriptionExternalKey, RequestOptions.empty());


        } catch (KillBillClientException ex) {
            log.error("Failed to enable KillBill subscription for account external id {} subscription external key {}",
                    accountExternalKey, subscriptionExternalKey, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to enable subscription");
        }


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
                bind(Billing.class).to(KillBilling.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(KillBilling.class);
            }
        };
    }
}
