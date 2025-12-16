// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.BillingRouter;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.billing.StripeBilling;
import com.smotana.clearflask.billing.StripeBillingConfig;
import com.smotana.clearflask.core.ClearFlaskCreditSync;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.*;
import com.stripe.net.Webhook;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Optional;
import java.util.Set;

/**
 * Webhook handler for Stripe events.
 * <p>
 * Handles subscription lifecycle, payment, and invoice events from Stripe.
 */
@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class StripeWebhookResource extends ManagedService {

    public static final String WEBHOOK_PATH = "/webhook/stripe";
    public static final String WEBHOOK_PATH_TEST = "/webhook/stripe/test";

    // Event types we handle
    private static final ImmutableSet<String> HANDLED_EVENTS = ImmutableSet.of(
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
            "customer.subscription.trial_will_end",
            "invoice.payment_succeeded",
            "invoice.payment_failed",
            "invoice.finalized",
            "payment_intent.succeeded",
            "payment_intent.payment_failed",
            "charge.refunded"
    );

    public interface Config {
        @DefaultValue("true")
        boolean verifySignature();

        @DefaultValue("false")
        boolean logAllEvents();

        @DefaultValue("300")
        long signatureToleranceSeconds();
    }

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;
    @Inject
    private Config config;
    @Inject
    private Gson gson;
    @Inject
    private AccountStore accountStore;
    @Inject
    private Billing billing;
    @Inject
    private StripeBillingConfig stripeBillingConfig;
    @Inject
    private ClearFlaskCreditSync clearFlaskCreditSync;
    @Inject
    private NotificationService notificationService;
    @Inject
    private PlanStore planStore;

    @Override
    protected void serviceStart() throws Exception {
        log.info("Stripe webhook resource started. Live endpoint: {}, Test endpoint: {}", WEBHOOK_PATH, WEBHOOK_PATH_TEST);
    }

    /**
     * Handle live Stripe webhook events
     */
    @POST
    @Path(WEBHOOK_PATH)
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    @Limit(requiredPermits = 1)
    public javax.ws.rs.core.Response webhookLive(
            String payload,
            @HeaderParam("Stripe-Signature") String signature) {
        return processWebhook(payload, signature, false);
    }

    /**
     * Handle test Stripe webhook events
     */
    @POST
    @Path(WEBHOOK_PATH_TEST)
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    @Limit(requiredPermits = 1)
    public javax.ws.rs.core.Response webhookTest(
            String payload,
            @HeaderParam("Stripe-Signature") String signature) {
        return processWebhook(payload, signature, true);
    }

    private javax.ws.rs.core.Response processWebhook(String payload, String signature, boolean isTestMode) {
        Event event;

        // Verify signature and parse event
        try {
            String webhookSecret = isTestMode
                    ? stripeBillingConfig.stripeWebhookSecretTest()
                    : stripeBillingConfig.stripeWebhookSecretLive();

            if (config.verifySignature() && !Strings.isNullOrEmpty(webhookSecret)) {
                event = Webhook.constructEvent(payload, signature, webhookSecret, config.signatureToleranceSeconds());
            } else {
                event = gson.fromJson(payload, Event.class);
            }
        } catch (SignatureVerificationException ex) {
            log.warn("Invalid Stripe webhook signature, isTestMode={}", isTestMode);
            return javax.ws.rs.core.Response.status(Response.Status.BAD_REQUEST).entity("Invalid signature").build();
        } catch (Exception ex) {
            log.error("Failed to parse Stripe webhook", ex);
            return javax.ws.rs.core.Response.status(Response.Status.BAD_REQUEST).entity("Invalid payload").build();
        }

        String eventType = event.getType();

        if (config.logAllEvents()) {
            log.info("Received Stripe webhook: type={}, id={}, isTestMode={}", eventType, event.getId(), isTestMode);
        } else {
            log.debug("Received Stripe webhook: type={}, id={}, isTestMode={}", eventType, event.getId(), isTestMode);
        }

        // Check if we handle this event type
        if (!HANDLED_EVENTS.contains(eventType)) {
            log.debug("Ignoring unhandled Stripe event type: {}", eventType);
            return javax.ws.rs.core.Response.ok().build();
        }

        try {
            // Set test mode flag for this request
            BillingRouter.setForceStripeTestMode(isTestMode);

            // Route to appropriate handler
            StripeObject stripeObject = event.getDataObjectDeserializer()
                    .getObject()
                    .orElse(null);

            if (stripeObject == null) {
                log.warn("Failed to deserialize Stripe event object: {}", eventType);
                return javax.ws.rs.core.Response.ok().build();
            }

            switch (eventType) {
                case "customer.subscription.created":
                case "customer.subscription.updated":
                case "customer.subscription.deleted":
                    handleSubscriptionEvent((Subscription) stripeObject, eventType);
                    break;
                case "customer.subscription.trial_will_end":
                    handleTrialWillEnd((Subscription) stripeObject);
                    break;
                case "invoice.payment_succeeded":
                    handleInvoicePaymentSuccess((Invoice) stripeObject);
                    break;
                case "invoice.payment_failed":
                    handleInvoicePaymentFailed((Invoice) stripeObject);
                    break;
                case "invoice.finalized":
                    handleInvoiceFinalized((Invoice) stripeObject);
                    break;
                case "payment_intent.succeeded":
                    handlePaymentIntentSucceeded((PaymentIntent) stripeObject);
                    break;
                case "payment_intent.payment_failed":
                    handlePaymentIntentFailed((PaymentIntent) stripeObject);
                    break;
                case "charge.refunded":
                    handleChargeRefunded((Charge) stripeObject);
                    break;
            }
        } finally {
            BillingRouter.clearThreadLocals();
        }

        return javax.ws.rs.core.Response.ok().build();
    }

    private void handleSubscriptionEvent(Subscription subscription, String eventType) {
        String customerId = subscription.getCustomer();
        Optional<AccountStore.Account> accountOpt = findAccountByStripeCustomerId(customerId);

        if (accountOpt.isEmpty()) {
            log.warn("Received subscription event for unknown customer: {}", customerId);
            return;
        }

        AccountStore.Account account = accountOpt.get();

        // Update subscription status
        SubscriptionStatus newStatus = mapStripeSubscriptionStatus(subscription);
        if (!account.getStatus().equals(newStatus)) {
            log.info("Subscription status change {} -> {} for account {} due to {}",
                    account.getStatus(), newStatus, account.getAccountId(), eventType);
            accountStore.updateStatus(account.getAccountId(), newStatus);
        }

        // Update plan if changed
        String currentPlanId = getPlanIdFromSubscription(subscription);
        if (!Strings.isNullOrEmpty(currentPlanId) && !currentPlanId.equals(account.getPlanid())) {
            log.info("Plan change {} -> {} for account {} due to {}",
                    account.getPlanid(), currentPlanId, account.getAccountId(), eventType);
            accountStore.setPlan(account.getAccountId(), currentPlanId, Optional.of(ImmutableMap.of()));
        }
    }

    private void handleTrialWillEnd(Subscription subscription) {
        String customerId = subscription.getCustomer();
        Optional<AccountStore.Account> accountOpt = findAccountByStripeCustomerId(customerId);

        if (accountOpt.isEmpty()) {
            return;
        }

        AccountStore.Account account = accountOpt.get();

        // Send trial ending notification
        int daysRemaining = 3; // Stripe sends this 3 days before trial ends
        notificationService.onTrialEnding(
                account.getAccountId(),
                account.getEmail(),
                daysRemaining);

        log.info("Trial will end for account {} in {} days", account.getAccountId(), daysRemaining);
    }

    private void handleInvoicePaymentSuccess(Invoice invoice) {
        String customerId = invoice.getCustomer();
        Optional<AccountStore.Account> accountOpt = findAccountByStripeCustomerId(customerId);

        if (accountOpt.isEmpty()) {
            return;
        }

        AccountStore.Account account = accountOpt.get();

        // Check if card is expiring soon
        boolean isCardExpiringSoon = checkCardExpiringSoon(customerId);

        // Send payment success notification
        notificationService.onInvoicePaymentSuccess(
                account.getAccountId(),
                account.getEmail(),
                invoice.getId(),
                isCardExpiringSoon);

        // Sync credit to ClearFlask feedback page
        try {
            String summary = "Credit for subscription payment";
            if (invoice.getLines() != null && !invoice.getLines().getData().isEmpty()) {
                InvoiceLineItem firstLine = invoice.getLines().getData().get(0);
                if (firstLine.getDescription() != null) {
                    summary = "Credit for " + firstLine.getDescription();
                }
            }

            clearFlaskCreditSync.process(
                    invoice.getId(),
                    account,
                    invoice.getAmountPaid() / 100.0, // Convert from cents
                    summary);
        } catch (Exception ex) {
            log.warn("Failed to sync credit for invoice {}", invoice.getId(), ex);
        }

        log.info("Invoice payment succeeded for account {}, invoice {}, amount {}",
                account.getAccountId(), invoice.getId(), invoice.getAmountPaid());
    }

    private void handleInvoicePaymentFailed(Invoice invoice) {
        String customerId = invoice.getCustomer();
        Optional<AccountStore.Account> accountOpt = findAccountByStripeCustomerId(customerId);

        if (accountOpt.isEmpty()) {
            return;
        }

        AccountStore.Account account = accountOpt.get();

        // Check if requires action (e.g., 3D Secure)
        boolean requiresAction = invoice.getPaymentIntent() != null
                && "requires_action".equals(invoice.getPaymentIntent());

        boolean hasPaymentMethod = hasPaymentMethod(customerId);

        notificationService.onPaymentFailed(
                account.getAccountId(),
                account.getEmail(),
                invoice.getAmountDue(),
                requiresAction,
                hasPaymentMethod);

        log.warn("Invoice payment failed for account {}, invoice {}, amount {}",
                account.getAccountId(), invoice.getId(), invoice.getAmountDue());
    }

    private void handleInvoiceFinalized(Invoice invoice) {
        log.debug("Invoice finalized: {}", invoice.getId());
        // Could send invoice ready notification if needed
    }

    private void handlePaymentIntentSucceeded(PaymentIntent paymentIntent) {
        log.debug("Payment intent succeeded: {}", paymentIntent.getId());
        // Most payment success handling is done via invoice events
    }

    private void handlePaymentIntentFailed(PaymentIntent paymentIntent) {
        log.debug("Payment intent failed: {}", paymentIntent.getId());
        // Most payment failure handling is done via invoice events
    }

    private void handleChargeRefunded(Charge charge) {
        String customerId = charge.getCustomer();
        Optional<AccountStore.Account> accountOpt = findAccountByStripeCustomerId(customerId);

        if (accountOpt.isEmpty()) {
            return;
        }

        log.info("Charge refunded for account {}, charge {}, amount {}",
                accountOpt.get().getAccountId(), charge.getId(), charge.getAmountRefunded());
    }

    // === Helper Methods ===

    private Optional<AccountStore.Account> findAccountByStripeCustomerId(String stripeCustomerId) {
        // Search for account with matching stripeCustomerId
        // This is a linear scan - in production, you'd want an index
        AccountStore.SearchAccountsResponse response = accountStore.searchAccounts(
                new com.smotana.clearflask.api.model.AccountSearchSuperAdmin()
                        .filterStripeCustomerId(stripeCustomerId),
                false,
                Optional.empty(),
                Optional.of(1));

        if (response.getAccounts().isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(response.getAccounts().get(0));
    }

    private SubscriptionStatus mapStripeSubscriptionStatus(Subscription subscription) {
        String status = subscription.getStatus();

        switch (status) {
            case "active":
                if (subscription.getCancelAtPeriodEnd()) {
                    return SubscriptionStatus.ACTIVENORENEWAL;
                }
                return SubscriptionStatus.ACTIVE;
            case "trialing":
                return SubscriptionStatus.ACTIVETRIAL;
            case "past_due":
                return SubscriptionStatus.ACTIVEPAYMENTRETRY;
            case "canceled":
            case "unpaid":
                return SubscriptionStatus.CANCELLED;
            case "incomplete":
            case "incomplete_expired":
                return SubscriptionStatus.BLOCKED;
            default:
                log.warn("Unknown Stripe subscription status: {}", status);
                return SubscriptionStatus.ACTIVE;
        }
    }

    private String getPlanIdFromSubscription(Subscription subscription) {
        if (subscription.getItems() == null || subscription.getItems().getData().isEmpty()) {
            return null;
        }

        SubscriptionItem item = subscription.getItems().getData().get(0);
        if (item.getPrice() == null) {
            return null;
        }

        // Try to get plan_id from metadata
        if (item.getPrice().getMetadata() != null) {
            String planId = item.getPrice().getMetadata().get(StripeBilling.METADATA_CLEARFLASK_ACCOUNT_ID);
            if (!Strings.isNullOrEmpty(planId)) {
                return planId;
            }
        }

        // Fall back to price ID
        return item.getPrice().getId();
    }

    private boolean checkCardExpiringSoon(String customerId) {
        try {
            Optional<Billing.PaymentMethodDetails> paymentMethodOpt = billing.getDefaultPaymentMethodDetails(customerId);
            if (paymentMethodOpt.isEmpty()) {
                return false;
            }

            Billing.PaymentMethodDetails pm = paymentMethodOpt.get();
            return KillBillResource.isCardExpiringSoon(
                    pm.getCardExpiryYear(),
                    pm.getCardExpiryMonth(),
                    30);
        } catch (Exception ex) {
            log.debug("Failed to check card expiry for customer {}", customerId);
            return false;
        }
    }

    private boolean hasPaymentMethod(String customerId) {
        try {
            return billing.getDefaultPaymentMethodDetails(customerId).isPresent();
        } catch (Exception ex) {
            return false;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeWebhookResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding()
                        .to(StripeWebhookResource.class);
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(StripeWebhookResource.class);
            }
        };
    }
}
