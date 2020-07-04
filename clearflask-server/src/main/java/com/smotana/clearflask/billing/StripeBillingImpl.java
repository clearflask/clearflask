package com.smotana.clearflask.billing;


import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.gson.JsonSyntaxException;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.util.SerializableEnum;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.Subscription;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerUpdateParams;
import com.stripe.param.SubscriptionCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;
import rx.Observable;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;

import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;

import static com.google.common.base.Preconditions.checkNotNull;

@Slf4j
@Singleton
public class StripeBillingImpl extends ManagedService implements StripeBilling {

    private enum SubscriptionStatus {
        INCOMPLETE("incomplete"),
        INCOMPLETE_EXPIRED("incomplete_expired"),
        TRIALING("trialing"),
        ACTIVE("active"),
        PAST_DUE("past_due"),
        CANCELED("canceled"),
        UNPAID("unpaid");
        public static final ImmutableMap<String, SubscriptionStatus> byString = Arrays.stream(SubscriptionStatus.class.getEnumConstants())
                .collect(ImmutableMap.toImmutableMap(SubscriptionStatus::getStatusStr, e -> e));
        private final String statusStr;

        SubscriptionStatus(String statusStr) {
            this.statusStr = statusStr;
        }

        public String getStatusStr() {
            return statusStr;
        }
    }

    private static final String METADATA_KEY_CUSTOMER_ACCOUNT_ID = "accountId";

    public interface Config {
        @NoDefaultValue
        String apiKeySecret();

        @NoDefaultValue
        Observable<String> apiKeySecretObservable();

        @NoDefaultValue
        String endpointSecret();
    }

    @Inject
    private Config config;
    @Inject
    private AccountStore accountStore;

    @Override
    protected void serviceStart() throws Exception {
        checkNotNull(Strings.emptyToNull(config.apiKeySecret()), "Stripe api key cannot be empty");
        config.apiKeySecretObservable().subscribe(s -> Stripe.apiKey = s);
        Stripe.apiKey = config.apiKeySecret();
    }

    @Override
    public Event parseEvent(HttpServletRequest request) {
        String payload = null;
        try {
            payload = IOUtils.toString(request.getReader());
        } catch (IOException ex) {
            log.error("Stripe webhook cannot read payload", ex);
            throw new WebApplicationException(Response.Status.BAD_REQUEST);
        }
        String sigHeader = request.getHeader("Stripe-Signature");
        try {
            return Webhook.constructEvent(payload, sigHeader, config.endpointSecret());
        } catch (JsonSyntaxException ex) {
            log.error("Stripe webhook invalid payload {}", payload, ex);
            throw new WebApplicationException(Response.Status.BAD_REQUEST);
        } catch (SignatureVerificationException ex) {
            log.error("Stripe webhook invalid signature {}", payload, ex);
            throw new WebApplicationException(Response.Status.BAD_REQUEST);
        }
    }

    @Override
    public Customer createCustomer(String accountId, String email, String name) {
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
    public void updatedSubscription(Customer customer, Subscription subscription) {
        Optional<String> accountIdOpt = getCustomerAccountId(customer);
        if (!accountIdOpt.isPresent()) {
            log.error("Customer Stripe object {} missing metadata {}", customer.getId(), METADATA_KEY_CUSTOMER_ACCOUNT_ID);
            throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
        }
        Optional<AccountStore.Account> accountOpt = accountStore.getAccountByAccountId(accountIdOpt.get());
        if (!accountOpt.isPresent()) {
            log.error("No account found for Customer Stripe object {} with accountId {}", customer.getId(), accountIdOpt.get());
            throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
        }
        if (!accountOpt.get().getStripeSubId().equals(subscription.getId())) {
            log.error("Account {} with subscription {} received a subscription event from a different subscription id {}",
                    accountOpt.get().getAccountId(), accountOpt.get().getStripeSubId(), subscription.getId());
            throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
        }
        SubscriptionStatus subscriptionStatus = SubscriptionStatus.byString.get(subscription.getStatus());
        if (subscriptionStatus == null) {
            log.error("Unknown subscription status {} for customerId {}", subscription.getStatus(), customer.getId());
            throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
        }
        switch (subscriptionStatus) {
            case ACTIVE:
            case TRIALING:
                // Allow all features
                break;
            case UNPAID:
            case PAST_DUE:
            case INCOMPLETE:
                break;
            case INCOMPLETE_EXPIRED:
            case CANCELED:
                // Restrict account, allow resubscribe
                break;
            default:
                log.error("Unhandled subscription status {} for customerId {}", subscription.getStatus(), customer.getId());
                throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
        }

        //  TODO        accountOpt.get().
    }

    @Override
    public Customer updatedPayment(Customer customer, Subscription subscription, String paymentToken) {
        try {
            return customer.update(CustomerUpdateParams.builder()
                    .setSource(paymentToken)
                    .build());
        } catch (StripeException ex) {
            log.error("Failed to update customer {} payment source", customer.getId(), ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to contact payment processor");
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeBilling.class).to(StripeBillingImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(StripeBillingImpl.class);
            }
        };
    }
}
