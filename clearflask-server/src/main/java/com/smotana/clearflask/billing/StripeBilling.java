// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableScheduledFuture;
import com.google.common.util.concurrent.ListeningScheduledExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.InvoiceItem;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.web.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Invoice;
import com.stripe.model.InvoiceCollection;
import com.stripe.model.InvoiceLineItem;
import com.stripe.model.PaymentMethod;
import com.stripe.model.Price;
import com.stripe.model.SubscriptionCollection;
import com.stripe.model.SubscriptionItem;
import com.stripe.model.UsageRecord;
import com.stripe.net.RequestOptions;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerUpdateParams;
import com.stripe.param.InvoiceListParams;
import com.stripe.param.PaymentMethodAttachParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.SubscriptionCancelParams;
import com.stripe.param.SubscriptionCreateParams;
import com.stripe.param.SubscriptionListParams;
import com.stripe.param.SubscriptionUpdateParams;
import com.stripe.param.UsageRecordCreateOnSubscriptionItemParams;
import com.stripe.param.CustomerBalanceTransactionCollectionCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.LocalDate;
import org.killbill.billing.catalog.api.BillingPeriod;
import org.killbill.billing.catalog.api.Currency;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.catalog.api.ProductCategory;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.PhasePrice;
import org.killbill.billing.client.model.gen.PlanDetail;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.entitlement.api.Entitlement;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Direct Stripe billing implementation.
 * <p>
 * This implementation uses Stripe's APIs directly for:
 * - Customer management
 * - Subscription lifecycle (create, cancel, resume, change plan)
 * - Payment method management
 * - Usage-based billing (metered subscriptions)
 * - Invoice management
 */
@Slf4j
@Singleton
public class StripeBilling extends ManagedService implements Billing {

    public static final String TRACKED_USER_METER_NAME = "tracked_users";
    public static final String METADATA_CLEARFLASK_ACCOUNT_ID = "clearflask_account_id";
    public static final String METADATA_CLEARFLASK_PROJECT_ID = "clearflask_project_id";

    public interface Config {
        @DefaultValue("true")
        boolean usageRecordEnabled();

        @DefaultValue("86400000")
        long usageReportingIntervalMs();
    }

    @Inject
    private Config config;
    @Inject
    private StripeBillingConfig stripeBillingConfig;
    @Inject
    private AccountStore accountStore;
    @Inject
    private UserStore userStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private PlanVerifyStore planVerifyStore;

    private ListeningScheduledExecutorService executor;
    private ListenableScheduledFuture<?> usageReportingSchedule;

    @Override
    protected void serviceStart() throws Exception {
        executor = MoreExecutors.listeningDecorator(Executors.newScheduledThreadPool(2, new ThreadFactoryBuilder()
                .setNameFormat("StripeBilling-%d").build()));
    }

    @Override
    protected void serviceStop() throws Exception {
        if (usageReportingSchedule != null) {
            usageReportingSchedule.cancel(false);
        }
        if (executor != null) {
            executor.shutdown();
            executor.awaitTermination(5, TimeUnit.MINUTES);
        }
    }

    /**
     * Get the appropriate Stripe API key based on test mode
     */
    private String getApiKey() {
        if (BillingRouter.isForceStripeTestMode()) {
            return stripeBillingConfig.stripeTestApiKey();
        }
        return stripeBillingConfig.stripeLiveApiKey();
    }

    /**
     * Get RequestOptions configured for the appropriate Stripe environment
     */
    private RequestOptions getRequestOptions() {
        return RequestOptions.builder()
                .setApiKey(getApiKey())
                .build();
    }

    /**
     * Check if we're in test mode
     */
    private boolean isTestMode() {
        return BillingRouter.isForceStripeTestMode();
    }

    @Extern
    @Override
    public void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn) {
        executor.submit(() -> {
            try {
                createAccountWithSubscription(accountInDyn);
            } catch (Exception ex) {
                log.error("Failed to create Stripe customer/subscription for account {}", accountInDyn.getAccountId(), ex);
            }
        });
    }

    private void createAccountWithSubscription(AccountStore.Account accountInDyn) throws StripeException {
        // Create Stripe customer
        CustomerCreateParams.Builder customerParams = CustomerCreateParams.builder()
                .setEmail(accountInDyn.getEmail())
                .setName(accountInDyn.getName())
                .putMetadata(METADATA_CLEARFLASK_ACCOUNT_ID, accountInDyn.getAccountId());

        Customer customer = Customer.create(customerParams.build(), getRequestOptions());
        log.info("Created Stripe customer {} for account {}", customer.getId(), accountInDyn.getAccountId());

        // Store the Stripe customer ID in our database
        accountStore.setStripeCustomerId(accountInDyn.getAccountId(), customer.getId(), isTestMode());

        // Create subscription if not on free plan
        String planId = accountInDyn.getPlanid();
        if (!planStore.isFreePlan(planId)) {
            createSubscriptionForPlan(customer.getId(), planId, accountInDyn);
        }
    }

    private Subscription createSubscriptionForPlan(String customerId, String planId, AccountStore.Account account) throws StripeException {
        // Look up the Stripe Price ID for this plan
        String stripePriceId = planStore.getStripePriceId(planId)
                .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Plan not found in Stripe: " + planId));

        SubscriptionCreateParams.Builder subParams = SubscriptionCreateParams.builder()
                .setCustomer(customerId)
                .addItem(SubscriptionCreateParams.Item.builder()
                        .setPrice(stripePriceId)
                        .build())
                .putMetadata(METADATA_CLEARFLASK_ACCOUNT_ID, account.getAccountId());

        // Check if plan has trial period
        Optional<Long> trialDays = planStore.getTrialDays(planId);
        if (trialDays.isPresent() && trialDays.get() > 0) {
            subParams.setTrialPeriodDays(trialDays.get());
        }

        com.stripe.model.Subscription subscription = com.stripe.model.Subscription.create(subParams.build(), getRequestOptions());
        log.info("Created Stripe subscription {} for customer {} plan {}", subscription.getId(), customerId, planId);

        return convertToKillBillSubscription(subscription, account.getAccountId());
    }

    @Override
    public Account getAccount(String accountId) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Account has no Stripe customer");
            }

            Customer customer = Customer.retrieve(stripeCustomerId, getRequestOptions());
            return convertToKillBillAccount(customer, cfAccount);
        } catch (StripeException ex) {
            log.error("Failed to get Stripe customer for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to get billing account");
        }
    }

    @Override
    public Account getAccountByKbId(UUID accountIdKb) {
        // For Stripe accounts, we don't use KillBill UUIDs
        // This method should not be called for Stripe accounts
        throw new UnsupportedOperationException("getAccountByKbId not supported for Stripe accounts");
    }

    @Override
    public Subscription getSubscription(String accountId) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Account has no Stripe customer");
            }

            // Get active subscription for customer
            SubscriptionListParams params = SubscriptionListParams.builder()
                    .setCustomer(stripeCustomerId)
                    .setLimit(1L)
                    .build();

            SubscriptionCollection subscriptions = com.stripe.model.Subscription.list(params, getRequestOptions());
            if (subscriptions.getData().isEmpty()) {
                // Return a free plan subscription representation
                return createFreePlanSubscription(cfAccount);
            }

            com.stripe.model.Subscription subscription = subscriptions.getData().get(0);
            return convertToKillBillSubscription(subscription, accountId);
        } catch (StripeException ex) {
            log.error("Failed to get Stripe subscription for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to get subscription");
        }
    }

    @Override
    public Optional<String> getEndOfTermChangeToPlanId(Subscription subscription) {
        // Check if there's a scheduled subscription change
        // In Stripe, this would be in the subscription schedule or pending updates
        // For now, return empty - implement if needed
        return Optional.empty();
    }

    @Override
    public SubscriptionStatus getEntitlementStatus(Account account, Subscription subscription) {
        // Map Stripe subscription status to our SubscriptionStatus
        String status = subscription.getState().name();
        String planId = subscription.getPlanName();

        // Check if on free plan
        if (planStore.isFreePlan(planId)) {
            return SubscriptionStatus.ACTIVE;
        }

        switch (status) {
            case "ACTIVE":
                // Check if in trial
                if (subscription.getPhaseType() == PhaseType.TRIAL) {
                    return SubscriptionStatus.ACTIVETRIAL;
                }
                // Check if canceled but still active
                if (Boolean.TRUE.equals(subscription.getCancelledDate() != null)) {
                    return SubscriptionStatus.ACTIVENORENEWAL;
                }
                return SubscriptionStatus.ACTIVE;
            case "BLOCKED":
                return SubscriptionStatus.BLOCKED;
            case "CANCELLED":
                return SubscriptionStatus.CANCELLED;
            case "PENDING":
                return SubscriptionStatus.ACTIVETRIAL;
            default:
                log.warn("Unknown subscription status: {}", status);
                return SubscriptionStatus.ACTIVE;
        }
    }

    @Override
    public SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, Account account, Subscription subscription, String reason) {
        SubscriptionStatus newStatus = getEntitlementStatus(account, subscription);
        if (!newStatus.equals(currentStatus)) {
            log.info("Subscription status change {} -> {}, reason: {}, for {}", currentStatus, newStatus, reason, account.getExternalKey());
            accountStore.updateStatus(account.getExternalKey(), newStatus);
        }
        return newStatus;
    }

    @Override
    public void updatePaymentToken(String accountId, Gateway type, String paymentToken) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Account has no Stripe customer");
            }

            // Attach the payment method to the customer
            PaymentMethod paymentMethod = PaymentMethod.retrieve(paymentToken, getRequestOptions());
            paymentMethod.attach(PaymentMethodAttachParams.builder()
                    .setCustomer(stripeCustomerId)
                    .build(), getRequestOptions());

            // Set as default payment method
            Customer.retrieve(stripeCustomerId, getRequestOptions()).update(
                    CustomerUpdateParams.builder()
                            .setInvoiceSettings(CustomerUpdateParams.InvoiceSettings.builder()
                                    .setDefaultPaymentMethod(paymentToken)
                                    .build())
                            .build(),
                    getRequestOptions());

            log.info("Updated payment method for account {} customer {}", accountId, stripeCustomerId);
        } catch (StripeException ex) {
            log.error("Failed to update payment method for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to update payment method");
        }
    }

    @Override
    public Optional<AccountBillingPaymentActionRequired> getActions(UUID accountIdKb) {
        // For Stripe, check for incomplete payments
        // This method uses KillBill UUID, so should not be called for Stripe accounts
        return Optional.empty();
    }

    @Override
    public void syncActions(String accountId) {
        // Stripe handles this automatically through webhooks
    }

    @Override
    public Subscription cancelSubscription(String accountId) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Account has no Stripe customer");
            }

            // Get active subscription
            SubscriptionListParams params = SubscriptionListParams.builder()
                    .setCustomer(stripeCustomerId)
                    .setLimit(1L)
                    .build();

            SubscriptionCollection subscriptions = com.stripe.model.Subscription.list(params, getRequestOptions());
            if (subscriptions.getData().isEmpty()) {
                throw new ApiException(Response.Status.NOT_FOUND, "No active subscription found");
            }

            com.stripe.model.Subscription subscription = subscriptions.getData().get(0);

            // Cancel at end of period (graceful cancellation)
            subscription = subscription.update(SubscriptionUpdateParams.builder()
                    .setCancelAtPeriodEnd(true)
                    .build(), getRequestOptions());

            log.info("Cancelled subscription {} for account {} (at period end)", subscription.getId(), accountId);
            return convertToKillBillSubscription(subscription, accountId);
        } catch (StripeException ex) {
            log.error("Failed to cancel subscription for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to cancel subscription");
        }
    }

    @Override
    public Subscription resumeSubscription(String accountId) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Account has no Stripe customer");
            }

            // Get active subscription
            SubscriptionListParams params = SubscriptionListParams.builder()
                    .setCustomer(stripeCustomerId)
                    .setLimit(1L)
                    .build();

            SubscriptionCollection subscriptions = com.stripe.model.Subscription.list(params, getRequestOptions());
            if (subscriptions.getData().isEmpty()) {
                throw new ApiException(Response.Status.NOT_FOUND, "No subscription found");
            }

            com.stripe.model.Subscription subscription = subscriptions.getData().get(0);

            // Remove cancellation
            subscription = subscription.update(SubscriptionUpdateParams.builder()
                    .setCancelAtPeriodEnd(false)
                    .build(), getRequestOptions());

            log.info("Resumed subscription {} for account {}", subscription.getId(), accountId);
            return convertToKillBillSubscription(subscription, accountId);
        } catch (StripeException ex) {
            log.error("Failed to resume subscription for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to resume subscription");
        }
    }

    @Override
    public Subscription changePlan(String accountId, String planId, Optional<Long> recurringPriceOpt) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Account has no Stripe customer");
            }

            // Get the Stripe Price ID for the new plan
            String stripePriceId = planStore.getStripePriceId(planId)
                    .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Plan not found in Stripe: " + planId));

            // Get active subscription
            SubscriptionListParams params = SubscriptionListParams.builder()
                    .setCustomer(stripeCustomerId)
                    .setLimit(1L)
                    .build();

            SubscriptionCollection subscriptions = com.stripe.model.Subscription.list(params, getRequestOptions());

            com.stripe.model.Subscription subscription;
            if (subscriptions.getData().isEmpty()) {
                // No existing subscription, create new one
                subscription = com.stripe.model.Subscription.create(SubscriptionCreateParams.builder()
                        .setCustomer(stripeCustomerId)
                        .addItem(SubscriptionCreateParams.Item.builder()
                                .setPrice(stripePriceId)
                                .build())
                        .putMetadata(METADATA_CLEARFLASK_ACCOUNT_ID, accountId)
                        .build(), getRequestOptions());
            } else {
                // Update existing subscription
                subscription = subscriptions.getData().get(0);
                String existingItemId = subscription.getItems().getData().get(0).getId();

                subscription = subscription.update(SubscriptionUpdateParams.builder()
                        .addItem(SubscriptionUpdateParams.Item.builder()
                                .setId(existingItemId)
                                .setPrice(stripePriceId)
                                .build())
                        .setProrationBehavior(SubscriptionUpdateParams.ProrationBehavior.CREATE_PRORATIONS)
                        .build(), getRequestOptions());
            }

            // Update plan in our database
            accountStore.setPlan(accountId, planId, Optional.empty());

            log.info("Changed plan for account {} to {} subscription {}", accountId, planId, subscription.getId());
            return convertToKillBillSubscription(subscription, accountId);
        } catch (StripeException ex) {
            log.error("Failed to change plan for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to change plan");
        }
    }

    @Override
    public Subscription changePlanToFlatYearly(String accountId, long yearlyPrice) {
        // Create a custom price for the flat yearly subscription
        // This is typically used for enterprise/custom pricing
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Account has no Stripe customer");
            }

            // Create a one-time price for the flat yearly amount
            Price price = Price.create(PriceCreateParams.builder()
                    .setCurrency("usd")
                    .setUnitAmount(yearlyPrice)
                    .setProduct(stripeBillingConfig.proPlanProductId())
                    .setRecurring(PriceCreateParams.Recurring.builder()
                            .setInterval(PriceCreateParams.Recurring.Interval.YEAR)
                            .build())
                    .putMetadata("type", "flat_yearly")
                    .putMetadata(METADATA_CLEARFLASK_ACCOUNT_ID, accountId)
                    .build(), getRequestOptions());

            // Get or create subscription
            SubscriptionListParams params = SubscriptionListParams.builder()
                    .setCustomer(stripeCustomerId)
                    .setLimit(1L)
                    .build();

            SubscriptionCollection subscriptions = com.stripe.model.Subscription.list(params, getRequestOptions());

            com.stripe.model.Subscription subscription;
            if (subscriptions.getData().isEmpty()) {
                subscription = com.stripe.model.Subscription.create(SubscriptionCreateParams.builder()
                        .setCustomer(stripeCustomerId)
                        .addItem(SubscriptionCreateParams.Item.builder()
                                .setPrice(price.getId())
                                .build())
                        .putMetadata(METADATA_CLEARFLASK_ACCOUNT_ID, accountId)
                        .build(), getRequestOptions());
            } else {
                subscription = subscriptions.getData().get(0);
                String existingItemId = subscription.getItems().getData().get(0).getId();

                subscription = subscription.update(SubscriptionUpdateParams.builder()
                        .addItem(SubscriptionUpdateParams.Item.builder()
                                .setId(existingItemId)
                                .setPrice(price.getId())
                                .build())
                        .build(), getRequestOptions());
            }

            log.info("Changed to flat yearly plan for account {} price {}", accountId, yearlyPrice);
            return convertToKillBillSubscription(subscription, accountId);
        } catch (StripeException ex) {
            log.error("Failed to change to flat yearly plan for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to change plan");
        }
    }

    @Override
    public boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId) {
        // Auto-upgrade is complex and depends on business logic
        // For now, return false (no auto-upgrade available)
        return false;
    }

    @Override
    public Optional<AccountStore.Account> tryAutoUpgradeAfterSelfhostLicenseAdded(AccountStore.Account accountInDyn) {
        // Not applicable for direct Stripe billing
        return Optional.empty();
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                return new Invoices(null, ImmutableList.of());
            }

            InvoiceListParams.Builder paramsBuilder = InvoiceListParams.builder()
                    .setCustomer(stripeCustomerId)
                    .setLimit(20L);

            if (cursorOpt.isPresent()) {
                paramsBuilder.setStartingAfter(cursorOpt.get());
            }

            InvoiceCollection stripeInvoices = Invoice.list(paramsBuilder.build(), getRequestOptions());

            ImmutableList.Builder<InvoiceItem> invoices = ImmutableList.builder();
            for (Invoice stripeInvoice : stripeInvoices.getData()) {
                // Determine invoice status
                String status;
                if ("void".equals(stripeInvoice.getStatus())) {
                    status = "Void";
                } else if (stripeInvoice.getAmountRemaining() != null && stripeInvoice.getAmountRemaining() > 0) {
                    status = "Due";
                } else {
                    status = "Paid";
                }

                // Get description from line items or use default
                String description = stripeInvoice.getDescription();
                if (Strings.isNullOrEmpty(description) && stripeInvoice.getLines() != null) {
                    description = stripeInvoice.getLines().getData().stream()
                            .map(InvoiceLineItem::getDescription)
                            .filter(d -> !Strings.isNullOrEmpty(d))
                            .findFirst()
                            .orElse("Invoice");
                }

                // Convert created timestamp to LocalDate
                java.time.LocalDate invoiceDate = java.time.Instant.ofEpochSecond(stripeInvoice.getCreated())
                        .atZone(java.time.ZoneId.systemDefault())
                        .toLocalDate();

                invoices.add(new InvoiceItem(
                        invoiceDate,
                        status,
                        stripeInvoice.getAmountDue() != null ? stripeInvoice.getAmountDue() / 100.0 : 0.0,
                        description,
                        stripeInvoice.getId()));
            }

            String nextCursor = stripeInvoices.getHasMore() && !stripeInvoices.getData().isEmpty()
                    ? stripeInvoices.getData().get(stripeInvoices.getData().size() - 1).getId()
                    : null;

            return new Invoices(nextCursor, invoices.build());
        } catch (StripeException ex) {
            log.error("Failed to get invoices for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to get invoices");
        }
    }

    @Override
    public String getInvoiceHtml(UUID invoiceId, Optional<String> accountIdOpt) {
        try {
            // For Stripe, redirect to hosted invoice page
            Invoice invoice = Invoice.retrieve(invoiceId.toString(), getRequestOptions());
            return "<html><head><meta http-equiv=\"refresh\" content=\"0;url=" + invoice.getHostedInvoiceUrl() + "\"></head></html>";
        } catch (StripeException ex) {
            log.error("Failed to get invoice HTML for {}", invoiceId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to get invoice");
        }
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                return Optional.empty();
            }

            Customer customer = Customer.retrieve(stripeCustomerId, getRequestOptions());
            String defaultPaymentMethodId = customer.getInvoiceSettings() != null
                    ? customer.getInvoiceSettings().getDefaultPaymentMethod()
                    : null;

            if (Strings.isNullOrEmpty(defaultPaymentMethodId)) {
                return Optional.empty();
            }

            PaymentMethod paymentMethod = PaymentMethod.retrieve(defaultPaymentMethodId, getRequestOptions());
            return Optional.of(convertToPaymentMethodDetails(paymentMethod));
        } catch (StripeException ex) {
            log.error("Failed to get payment method for account {}", accountId, ex);
            return Optional.empty();
        }
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb) {
        // This uses KillBill UUID, not supported for Stripe
        throw new UnsupportedOperationException("getDefaultPaymentMethodDetails by KB UUID not supported for Stripe");
    }

    @Override
    public ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId) {
        // This should be implemented by StripePlanStore
        // Return empty for now, the PlanStore will handle this
        return ImmutableSet.of();
    }

    @Override
    public void creditAdjustment(String accountId, long amount, String description) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Account has no Stripe customer");
            }

            // Create a credit balance transaction
            CustomerBalanceTransactionCollectionCreateParams params = CustomerBalanceTransactionCollectionCreateParams.builder()
                    .setAmount(-amount) // Negative amount adds credit
                    .setCurrency("usd")
                    .setDescription(description)
                    .build();

            Customer customer = Customer.retrieve(stripeCustomerId, getRequestOptions());
            customer.balanceTransactions().create(params, getRequestOptions());

            log.info("Added credit adjustment {} for account {} description: {}", amount, accountId, description);
        } catch (StripeException ex) {
            log.error("Failed to add credit adjustment for account {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to add credit");
        }
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId) {
        recordUsageInternal(type, accountId, projectId, null);
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, String userId) {
        recordUsageInternal(type, accountId, projectId, userId);
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, UserModel user) {
        recordUsageInternal(type, accountId, projectId, user != null ? user.getUserId() : null);
    }

    private void recordUsageInternal(UsageType type, String accountId, String projectId, String userId) {
        if (!config.usageRecordEnabled()) {
            return;
        }

        // For tracked users, we only record on user creation/tracking
        if (type != UsageType.VOTE && type != UsageType.POST && type != UsageType.COMMENT) {
            return;
        }

        executor.submit(() -> {
            try {
                AccountStore.Account cfAccount = accountStore.getAccount(accountId, true).orElse(null);
                if (cfAccount == null || Strings.isNullOrEmpty(cfAccount.getStripeCustomerId())) {
                    return;
                }

                // Get the subscription
                SubscriptionListParams params = SubscriptionListParams.builder()
                        .setCustomer(cfAccount.getStripeCustomerId())
                        .setLimit(1L)
                        .build();

                SubscriptionCollection subscriptions = com.stripe.model.Subscription.list(params, getRequestOptions());
                if (subscriptions.getData().isEmpty()) {
                    return;
                }

                com.stripe.model.Subscription subscription = subscriptions.getData().get(0);

                // Find the metered subscription item
                for (SubscriptionItem item : subscription.getItems().getData()) {
                    if (item.getPrice() != null && "metered".equals(item.getPrice().getRecurring().getUsageType())) {
                        // Report usage
                        UsageRecord.createOnSubscriptionItem(
                                item.getId(),
                                UsageRecordCreateOnSubscriptionItemParams.builder()
                                        .setQuantity(1L)
                                        .setTimestamp(Instant.now().getEpochSecond())
                                        .setAction(UsageRecordCreateOnSubscriptionItemParams.Action.INCREMENT)
                                        .build(),
                                getRequestOptions());
                        break;
                    }
                }
            } catch (Exception ex) {
                log.warn("Failed to record usage for account {} type {}", accountId, type, ex);
            }
        });
    }

    @Override
    public void finalizeInvoice(String accountId, UUID invoiceId) {
        try {
            Invoice invoice = Invoice.retrieve(invoiceId.toString(), getRequestOptions());
            invoice.finalizeInvoice(getRequestOptions());
            log.info("Finalized invoice {} for account {}", invoiceId, accountId);
        } catch (StripeException ex) {
            log.error("Failed to finalize invoice {} for account {}", invoiceId, accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to finalize invoice");
        }
    }

    @Override
    public void closeAccount(String accountId) {
        try {
            AccountStore.Account cfAccount = accountStore.getAccount(accountId, true)
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

            String stripeCustomerId = cfAccount.getStripeCustomerId();
            if (Strings.isNullOrEmpty(stripeCustomerId)) {
                return; // No Stripe account to close
            }

            // Cancel all subscriptions
            SubscriptionListParams params = SubscriptionListParams.builder()
                    .setCustomer(stripeCustomerId)
                    .build();

            SubscriptionCollection subscriptions = com.stripe.model.Subscription.list(params, getRequestOptions());
            for (com.stripe.model.Subscription subscription : subscriptions.getData()) {
                subscription.cancel(SubscriptionCancelParams.builder().build(), getRequestOptions());
            }

            // Delete customer (or just mark as inactive - depending on data retention requirements)
            Customer customer = Customer.retrieve(stripeCustomerId, getRequestOptions());
            customer.delete(getRequestOptions());

            log.info("Closed Stripe account for {}", accountId);
        } catch (StripeException ex) {
            log.error("Failed to close Stripe account for {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to close account");
        }
    }

    // === Helper Methods ===

    private Account convertToKillBillAccount(Customer customer, AccountStore.Account cfAccount) {
        return new Account(
                UUID.nameUUIDFromBytes(customer.getId().getBytes()),
                cfAccount.getName(),
                cfAccount.getName().length(),
                cfAccount.getAccountId(), // externalKey
                cfAccount.getEmail(),
                0,
                Currency.USD,
                null,
                false,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null, false,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                ImmutableList.of());
    }

    private Subscription convertToKillBillSubscription(com.stripe.model.Subscription stripeSubscription, String accountId) {
        String planId = "unknown";
        PhaseType phaseType = PhaseType.EVERGREEN;

        if (!stripeSubscription.getItems().getData().isEmpty()) {
            SubscriptionItem item = stripeSubscription.getItems().getData().get(0);
            if (item.getPrice() != null && item.getPrice().getMetadata() != null) {
                planId = item.getPrice().getMetadata().getOrDefault("plan_id", item.getPrice().getId());
            }
        }

        // Check if in trial
        if (stripeSubscription.getTrialEnd() != null && stripeSubscription.getTrialEnd() > Instant.now().getEpochSecond()) {
            phaseType = PhaseType.TRIAL;
        }

        Entitlement.EntitlementState state = mapStripeSubscriptionStatus(stripeSubscription.getStatus());

        return new Subscription(
                UUID.nameUUIDFromBytes(stripeSubscription.getId().getBytes()),
                UUID.nameUUIDFromBytes(stripeSubscription.getCustomer().getBytes()),
                accountId, // externalKey
                UUID.nameUUIDFromBytes(stripeSubscription.getId().getBytes()),
                stripeSubscription.getId(),
                LocalDate.fromDateFields(new java.util.Date(stripeSubscription.getStartDate() * 1000)),
                planId,
                ProductCategory.BASE,
                BillingPeriod.MONTHLY,
                phaseType,
                null,
                planId, // planName
                state,
                Entitlement.EntitlementSourceType.NATIVE,
                null,
                stripeSubscription.getCancelAtPeriodEnd()
                        ? LocalDate.fromDateFields(new java.util.Date(stripeSubscription.getCurrentPeriodEnd() * 1000))
                        : null,
                LocalDate.fromDateFields(new java.util.Date(stripeSubscription.getStartDate() * 1000)),
                stripeSubscription.getCancelAtPeriodEnd()
                        ? LocalDate.fromDateFields(new java.util.Date(stripeSubscription.getCurrentPeriodEnd() * 1000))
                        : null,
                0,
                ImmutableList.of(),
                null,
                ImmutableList.of(),
                ImmutableList.of());
    }

    private Subscription createFreePlanSubscription(AccountStore.Account cfAccount) {
        return new Subscription(
                UUID.nameUUIDFromBytes(cfAccount.getAccountId().getBytes()),
                UUID.nameUUIDFromBytes(cfAccount.getAccountId().getBytes()),
                cfAccount.getAccountId(),
                UUID.nameUUIDFromBytes(cfAccount.getAccountId().getBytes()),
                cfAccount.getAccountId(),
                LocalDate.now(),
                cfAccount.getPlanid(),
                ProductCategory.BASE,
                BillingPeriod.NO_BILLING_PERIOD,
                PhaseType.EVERGREEN,
                null,
                cfAccount.getPlanid(),
                Entitlement.EntitlementState.ACTIVE,
                Entitlement.EntitlementSourceType.NATIVE,
                null,
                null,
                LocalDate.now(),
                null,
                0,
                ImmutableList.of(),
                null,
                ImmutableList.of(),
                ImmutableList.of());
    }

    private PaymentMethodDetails convertToPaymentMethodDetails(PaymentMethod paymentMethod) {
        Optional<String> cardBrand = Optional.empty();
        Optional<String> cardLast4 = Optional.empty();
        Optional<Long> cardExpiryYear = Optional.empty();
        Optional<Long> cardExpiryMonth = Optional.empty();

        if (paymentMethod.getCard() != null) {
            cardBrand = Optional.ofNullable(paymentMethod.getCard().getBrand());
            cardLast4 = Optional.ofNullable(paymentMethod.getCard().getLast4());
            cardExpiryYear = Optional.ofNullable(paymentMethod.getCard().getExpYear());
            cardExpiryMonth = Optional.ofNullable(paymentMethod.getCard().getExpMonth());
        }

        // Create a KillBill PaymentMethod wrapper
        org.killbill.billing.client.model.gen.PaymentMethod kbPaymentMethod = new org.killbill.billing.client.model.gen.PaymentMethod(
                UUID.nameUUIDFromBytes(paymentMethod.getId().getBytes()),
                paymentMethod.getId(),
                null,  // accountId
                true,  // isDefault
                "stripe",  // pluginName
                null,  // pluginDetail
                ImmutableList.of());  // auditLogs

        return new PaymentMethodDetails(
                Gateway.STRIPE,
                kbPaymentMethod,
                cardBrand,
                cardLast4,
                cardExpiryYear,
                cardExpiryMonth);
    }

    private Entitlement.EntitlementState mapStripeSubscriptionStatus(String status) {
        switch (status) {
            case "active":
            case "trialing":
                return Entitlement.EntitlementState.ACTIVE;
            case "canceled":
                return Entitlement.EntitlementState.CANCELLED;
            case "incomplete":
            case "incomplete_expired":
            case "past_due":
            case "unpaid":
                return Entitlement.EntitlementState.BLOCKED;
            default:
                return Entitlement.EntitlementState.ACTIVE;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Billing.class).annotatedWith(Names.named("stripe")).to(StripeBilling.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                install(StripeBillingConfig.module());
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(StripeBilling.class).asEagerSingleton();
            }
        };
    }
}
