// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.billing;


import com.google.common.base.Strings;
import com.google.common.base.Suppliers;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.ListeningExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.InvoiceItem;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.web.ApiException;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.ErrorCode;
import org.killbill.billing.catalog.api.BillingActionPolicy;
import org.killbill.billing.catalog.api.Currency;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.catalog.api.ProductCategory;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.KillBillHttpClient;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.AccountApi;
import org.killbill.billing.client.api.gen.BundleApi;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.api.gen.InvoiceApi;
import org.killbill.billing.client.api.gen.PaymentApi;
import org.killbill.billing.client.api.gen.PaymentMethodApi;
import org.killbill.billing.client.api.gen.SubscriptionApi;
import org.killbill.billing.client.api.gen.UsageApi;
import org.killbill.billing.client.model.Bundles;
import org.killbill.billing.client.model.PaymentMethods;
import org.killbill.billing.client.model.Payments;
import org.killbill.billing.client.model.PlanDetails;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.EventSubscription;
import org.killbill.billing.client.model.gen.Invoice;
import org.killbill.billing.client.model.gen.OverdueState;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.PaymentMethodPluginDetail;
import org.killbill.billing.client.model.gen.PaymentTransaction;
import org.killbill.billing.client.model.gen.PhasePrice;
import org.killbill.billing.client.model.gen.PlanDetail;
import org.killbill.billing.client.model.gen.PluginProperty;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.client.model.gen.SubscriptionUsageRecord;
import org.killbill.billing.client.model.gen.UnitUsageRecord;
import org.killbill.billing.client.model.gen.UsageRecord;
import org.killbill.billing.entitlement.api.Entitlement;
import org.killbill.billing.entitlement.api.Entitlement.EntitlementState;
import org.killbill.billing.entitlement.api.SubscriptionEventType;
import org.killbill.billing.invoice.api.InvoiceItemType;
import org.killbill.billing.invoice.api.InvoiceStatus;
import org.killbill.billing.util.api.AuditLevel;
import org.killbill.billing.util.tag.ControlTagType;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import static com.smotana.clearflask.api.model.SubscriptionStatus.*;
import static com.smotana.clearflask.billing.KillBillClientProvider.STRIPE_PLUGIN_NAME;

@Slf4j
@Singleton
public class KillBilling extends ManagedService implements Billing {

    /** If changed, also change in catalogXXX.xml */
    private static final String TRACKED_USER_UNIT_NAME = "tracked-user";

    public interface Config {
        @DefaultValue("60000")
        long callTimeoutInMillis();

        @DefaultValue("true")
        boolean usageRecordEnabled();

        @DefaultValue("false")
        boolean usageRecordKbIdempotentEnabled();

        @DefaultValue("true")
        boolean finalizeInvoiceEnabled();

        /** Used in testing for deterministic number of invoices */
        @DefaultValue("true")
        boolean reuseDraftInvoices();

        /** Retry creating account again assuming it failed before */
        @DefaultValue("true")
        boolean createAccountIfNotExists();

        /** Retry creating subscription again assuming it failed before */
        @DefaultValue("true")
        boolean createSubscriptionIfNotExists();
    }

    @Inject
    private Config config;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;
    @Inject
    private AccountApi kbAccount;
    @Inject
    private BundleApi kbBundle;
    @Inject
    private SubscriptionApi kbSubscription;
    @Inject
    private InvoiceApi kbInvoice;
    @Inject
    private PaymentApi kbPayment;
    @Inject
    private CatalogApi kbCatalog;
    @Inject
    private UsageApi kbUsage;
    @Inject
    private KillBillHttpClient kbClient;
    @Inject
    private PaymentMethodApi kbPaymentMethod;
    @Inject
    private AccountStore accountStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private UserStore userStore;
    @Inject
    private NotificationService notificationService;

    private ListeningExecutorService usageExecutor;
    private ListeningExecutorService accountCreationExecutor;

    @Override
    protected void serviceStart() throws Exception {
        usageExecutor = MoreExecutors.listeningDecorator(Executors.newScheduledThreadPool(2, new ThreadFactoryBuilder()
                .setNameFormat("KillBilling-usage-%d").build()));
        accountCreationExecutor = MoreExecutors.listeningDecorator(Executors.newScheduledThreadPool(2, new ThreadFactoryBuilder()
                .setNameFormat("KillBilling-account-creation-%d").build()));
    }

    @Override
    protected void serviceStop() throws Exception {
        usageExecutor.shutdown();
        accountCreationExecutor.shutdown();

        usageExecutor.awaitTermination(5, TimeUnit.MINUTES);
        accountCreationExecutor.awaitTermination(5, TimeUnit.MINUTES);
    }

    @Extern
    @Override
    public void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn) {
        accountCreationExecutor.submit(() -> {
            try {
                Account account = createAccount(accountInDyn);
                createSubscription(accountInDyn, account);
            } catch (Exception ex) {
                log.warn("Failed to create account with subscription", ex);
            }
        });
    }

    @Extern
    private Account createAccount(AccountStore.Account accountInDyn) {
        Account account;
        try {
            account = kbAccount.createAccount(new Account()
                    .setExternalKey(accountInDyn.getAccountId())
                    .setName(accountInDyn.getName())
                    .setEmail(accountInDyn.getEmail())
                    .setCurrency(Currency.USD), KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to create KillBill Account for email {} name {}", accountInDyn.getEmail(), accountInDyn.getName(), ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor, try again later", ex);
        }

        if (PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(accountInDyn.getPlanid())) {
            try {
                kbAccount.createAccountTags(
                        account.getAccountId(),
                        getDraftInvoicingTagIds(),
                        KillBillUtil.roDefault());
            } catch (KillBillClientException ex) {
                log.warn("Failed to attach tags to KillBill Account for email {} name {}",
                        accountInDyn.getEmail(), accountInDyn.getName(), ex);
                throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                        "Failed to contact payment processor, try again later", ex);
            }
        }

        return account;
    }

    @Extern
    private Subscription createSubscription(AccountStore.Account accountInDyn, Account account) {
        Subscription subscription;
        try {
            subscription = kbSubscription.createSubscription(new Subscription()
                            .setBundleExternalKey(accountInDyn.getAccountId())
                            .setAccountId(account.getAccountId())
                            .setPhaseType(PlanStore.PLANS_WITHOUT_TRIAL.contains(accountInDyn.getPlanid())
                                    ? PhaseType.EVERGREEN
                                    : PhaseType.TRIAL)
                            .setPlanName(accountInDyn.getPlanid()),
                    null,
                    null,
                    false,
                    false,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    null,
                    KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to create KillBill Subscription for accountId {} email {} name {}",
                    account.getAccountId(), accountInDyn.getEmail(), accountInDyn.getName(), ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor, try again later", ex);
        }

        updateAndGetEntitlementStatus(accountInDyn.getStatus(), account, subscription, "Subscription creation");

        return subscription;
    }

    @Extern
    @Override
    public Account getAccount(String accountId) {
        try {
            Account account = kbAccount.getAccountByKey(
                    accountId,
                    true,
                    true,
                    AuditLevel.NONE,
                    KillBillUtil.roDefault());
            if (account == null) {
                if (config.createAccountIfNotExists()) {
                    Optional<AccountStore.Account> accountInDynOpt = accountStore.getAccount(accountId, false);
                    if (accountInDynOpt.isPresent()) {
                        log.warn("Account doesn't exist in KB by account id {}, creating...", accountId);
                        return createAccount(accountInDynOpt.get());
                    } else {
                        log.warn("Account doesn't exist in KB by account id {}, can't create either it doesnt exist in db either", accountId);
                    }
                } else {
                    log.warn("Account doesn't exist by in KB account id {}, throwing...", accountId);
                }
                throw new ApiException(Response.Status.BAD_REQUEST,
                        "Failed to contact payment processor, try again later");
            }
            return account;
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Account by id {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Account", ex);
        }
    }

    @Override
    public Account getAccountByKbId(UUID accountIdKb) {
        try {
            Account account = kbAccount.getAccount(
                    accountIdKb,
                    true,
                    true,
                    AuditLevel.NONE,
                    KillBillUtil.roDefault());
            if (account == null) {
                log.warn("Account doesn't exist by account kb id {}", accountIdKb);
                throw new ApiException(Response.Status.BAD_REQUEST,
                        "Account doesn't exist");
            }
            return account;
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Account by kb id {}", accountIdKb, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Account", ex);
        }
    }

    @Extern
    @Override
    public Subscription getSubscription(String accountId) {
        Optional<Subscription> subscriptionOpt = Optional.empty();

        if (!subscriptionOpt.isPresent()) {
            subscriptionOpt = getSubscriptionByBundleExternalKey(accountId, false);
        }

        if (!subscriptionOpt.isPresent()) {
            subscriptionOpt = getSubscriptionByBundleExternalKey(accountId, true);
        }

        if (!subscriptionOpt.isPresent()) {
            subscriptionOpt = getSubscriptionByExternalKey(accountId);
        }

        if (!subscriptionOpt.isPresent() && config.createSubscriptionIfNotExists()) {
            Account account = getAccount(accountId);
            Optional<AccountStore.Account> accountInDynOpt = accountStore.getAccount(accountId, false);
            if (accountInDynOpt.isPresent()) {
                subscriptionOpt = Optional.of(createSubscription(accountInDynOpt.get(), account));
            } else {
                log.warn("Cannot create missing subscription if account doesn't exist for accountId {}", accountId);
            }
        }

        if (subscriptionOpt.isPresent()) {
            return subscriptionOpt.get();
        } else {
            log.warn("No subscription found for accountId {}", accountId);
            throw new ApiException(Response.Status.BAD_REQUEST, "Failed to contact payment processor, try again later");
        }
    }

    private Optional<Subscription> getSubscriptionByBundleExternalKey(String externalKey, boolean includeDeleted) {
        try {
            Bundles bundles = kbBundle.getBundleByKey(
                    externalKey,
                    includeDeleted,
                    null,
                    KillBillUtil.roDefault());
            return bundles.stream()
                    .flatMap(bundle -> bundle.getSubscriptions().stream())
                    .filter(subs -> ProductCategory.BASE.equals(subs.getProductCategory()))
                    .max(Comparator
                            .<Subscription, Boolean>comparing(subscription -> subscription.getState() != EntitlementState.CANCELLED)
                            .thenComparing(Subscription::getBillingStartDate)
                            .thenComparing(Subscription::getSubscriptionId));
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Subscription by bundle external key {}", externalKey, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Subscription", ex);
        }
    }

    /**
     * @Deprecated New subscriptions are not using externalkey anymore,
     * bundle external keys are used instead.
     */
    @Deprecated
    private Optional<Subscription> getSubscriptionByExternalKey(String externalKey) {
        try {
            return Optional.ofNullable(kbSubscription.getSubscriptionByKey(externalKey, KillBillUtil.roDefault()));
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Subscription by external key {}", externalKey, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Subscription", ex);
        }
    }

    @Override
    public Optional<String> getEndOfTermChangeToPlanId(Subscription subscription) {
        return subscription.getEvents().stream()
                .filter(e -> SubscriptionEventType.CHANGE.equals(e.getEventType()))
                .map(EventSubscription::getPlan)
                // Find last as there may be multiple change events
                .reduce((a, b) -> b)
                .map(planName -> subscription.getPlanName().equals(planName) ? null : planName);
    }

    /**
     * Note: Any changes to the logic needs to be updated here and properly tested.
     *
     * Preview below state diagram with https://www.planttext.com/
     *
     * [*] --> ActiveTrial
     *
     * ActiveTrial : - Phase is TRIAL
     * ActiveTrial --> Active : Reach MAU limit (With payment)
     * ActiveTrial --> NoPaymentMethod : Reach MAU limit (Without payment)
     * ActiveTrial --> ActiveTrial : Add payment
     * ActiveTrial --> ActiveTrial : Change plan
     * ActiveTrial --> [*] : Delete account
     *
     * Active : - Subscription active
     * Active : - No outstanding balance
     * Active : - Not overdue
     * Active --> ActivePaymentRetry : Outstanding balance
     * Active --> ActiveNoRenewal : Cancel subscription
     * Active --> Active : Update payment
     * Active --> Active : Change plan
     * Active --> [*] : Delete account
     *
     * Blocked : - Not TRIAL phase
     * Blocked : - Phase is BLOCKED
     * Blocked :   or Overdue cancelled
     * Blocked --> [*] : Delete account
     *
     * Cancelled : Subscription is cancelled
     * Cancelled --> Active : User resumes
     * Cancelled --> Active : Update payment method
     * Cancelled --> [*] : Delete account
     *
     * ActiveNoRenewal : Subscription pending cancel
     * ActiveNoRenewal --> Active : User resumes
     * ActiveNoRenewal --> Cancelled : Expires
     * ActiveNoRenewal --> Active : Update payment method
     * ActiveNoRenewal --> [*] : Delete account
     *
     * NoPaymentMethod : - No payment method
     * NoPaymentMethod : - Outstanding balance
     * NoPaymentMethod : - Not overdue cancelled
     * NoPaymentMethod --> Active : Add payment
     * NoPaymentMethod --> [*] : Delete account
     *
     * ActivePaymentRetry : - Has payment method
     * ActivePaymentRetry : - Outstanding balance
     * ActivePaymentRetry : - Overdue unpaid
     * ActivePaymentRetry : - Not overdue cancelled
     * ActivePaymentRetry --> Blocked : Overdue Cancelled
     * ActivePaymentRetry --> Active : Update payment method
     * ActivePaymentRetry --> [*] : Delete account
     */
    @Override
    public SubscriptionStatus getEntitlementStatus(Account account, Subscription subscription) {
        OverdueState overdueState = null;
        try {
            overdueState = kbAccount.getOverdueAccount(account.getAccountId(), KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Overdue State from account id {}", account.getAccountId(), ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to process", ex);
        }
        // TODO All of this needs to be verified
        final SubscriptionStatus status;
        boolean hasOutstandingBalance = account.getAccountBalance() != null && account.getAccountBalance().compareTo(BigDecimal.ZERO) > 0;
        boolean isOverdueCancelled = KillBillSync.OVERDUE_CANCELLED_STATE_NAME.equals(overdueState.getName());
        boolean isOverdueUnpaid = KillBillSync.OVERDUE_UNPAID_STATE_NAME.equals(overdueState.getName());
        Supplier<Boolean> hasPaymentMethod = Suppliers.memoize(() -> getDefaultPaymentMethodDetails(account.getAccountId()).isPresent())::get;

        if (EntitlementState.BLOCKED.equals(subscription.getState()) || isOverdueCancelled) {
            status = BLOCKED;
        } else if (PhaseType.TRIAL.equals(subscription.getPhaseType())) {
            status = ACTIVETRIAL;
        } else if (subscription.getState() == EntitlementState.ACTIVE
                && subscription.getCancelledDate() == null
                && !hasOutstandingBalance
                && !isOverdueUnpaid
                && !isOverdueCancelled) {
            status = ACTIVE;
        } else if (EntitlementState.CANCELLED.equals(subscription.getState())) {
            status = CANCELLED;
        } else if (EntitlementState.ACTIVE.equals(subscription.getState())
                && subscription.getCancelledDate() != null) {
            status = ACTIVENORENEWAL;
        } else if (hasPaymentMethod.get()
                && hasOutstandingBalance
                && !isOverdueUnpaid) {
            status = ACTIVEPAYMENTRETRY;
        } else if (!hasPaymentMethod.get()
                && hasOutstandingBalance
                && !isOverdueCancelled) {
            status = NOPAYMENTMETHOD;
        } else {
            status = BLOCKED;
            log.error("Could not determine subscription status, forcing {} for subsc id {} account id {} ext key {} from:\n -- account {}\n -- subscription {}\n -- overdueState {}\n -- hasPaymentMethod {}",
                    status, subscription.getSubscriptionId(), account.getAccountId(), account.getExternalKey(), account, subscription, overdueState, hasPaymentMethod.get());
        }
        if (log.isTraceEnabled()) {
            log.trace("Calculated subscription status to be {} from:\n -- account {}\n -- subscription {}\n -- overdueState {}\n -- hasPaymentMethod {}",
                    status, account, subscription, overdueState, hasPaymentMethod.get());
        }
        return status;
    }

    @Override
    public SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, Account account, Subscription subscription, String reason) {
        SubscriptionStatus newStatus = getEntitlementStatus(account, subscription);
        if (!newStatus.equals(currentStatus)) {
            log.info("Subscription status change {} -> {}, reason: {}, for {}",
                    currentStatus, newStatus, reason, account.getExternalKey());
            accountStore.updateStatus(account.getExternalKey(), newStatus);
            // Trial ends email notification
            if (ACTIVETRIAL.equals(currentStatus)) {
                Optional<PaymentMethodDetails> paymentOpt = getDefaultPaymentMethodDetails(account.getAccountId());
                notificationService.onTrialEnded(account.getExternalKey(), account.getEmail(), paymentOpt.isPresent());
            }
        }
        return newStatus;
    }

    @Override
    public void updatePaymentToken(String accountId, Gateway gateway, String paymentToken) {
        try {
            Account accountInKb = getAccount(accountId);
            SubscriptionStatus status = updateAndGetEntitlementStatus(accountStore.getAccount(accountId, false).get().getStatus(), accountInKb, getSubscription(accountId), "Update payment token");
            if (status == BLOCKED) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to update payment token");
            }

            kbAccount.createPaymentMethod(
                    accountInKb.getAccountId(),
                    new PaymentMethod(
                            null,
                            null,
                            accountInKb.getAccountId(),
                            true,
                            gateway.getPluginName(),
                            new PaymentMethodPluginDetail(),
                            ImmutableList.of()),
                    true,
                    true,
                    null,
                    ImmutableMap.of("token", paymentToken),
                    KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to update KillBill payment token for account id {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to update payment method", ex);
        }
    }

    @Extern
    @Override
    public Optional<AccountBillingPaymentActionRequired> getActions(UUID accountIdKb) {
        try {
            Payments payments = kbAccount.getPaymentsForAccount(
                    accountIdKb,
                    true,
                    true,
                    null,
                    null,
                    KillBillUtil.roDefault());
            Optional<PaymentTransaction> transactionOpt = payments.stream()
                    .flatMap(payment -> payment.getTransactions().stream())
                    .filter(paymentTransaction -> paymentTransaction.getProperties() != null)
                    .filter(paymentTransaction -> paymentTransaction.getProperties().stream()
                            .anyMatch(pluginProperty -> "status".equals(pluginProperty.getKey())
                                    && "requires_action".equals(pluginProperty.getValue())))
                    .findFirst();
            if (!transactionOpt.isPresent()) {
                return Optional.empty();
            }

            Optional<String> paymentIntentIdOpt = transactionOpt.get().getProperties().stream()
                    .filter(pluginProperty -> "id".equals(pluginProperty.getKey()))
                    .map(PluginProperty::getValue)
                    .findAny();
            if (!paymentIntentIdOpt.isPresent()) {
                log.warn("Payment transaction in KillBill missing payment intent id for accountIdKb {} transaction {}", accountIdKb, transactionOpt.get().getTransactionId());
                return Optional.empty();
            }

            PaymentIntent paymentIntent = PaymentIntent.retrieve(paymentIntentIdOpt.get());
            if (!"requires_action".equals(paymentIntent.getStatus())
                    || paymentIntent.getNextAction() == null) {
                log.warn("Payment intent in KillBill unresolved while Stripe is resolved, triggering sync for accountIdKb {}", accountIdKb);
                syncActions(accountIdKb);
                return Optional.empty();
            }

            return Optional.of(getPaymentStripeAction(paymentIntent.getClientSecret()));
        } catch (KillBillClientException | StripeException ex) {
            log.warn("Failed to get actions from KillBill/Stripe accountId {}", accountIdKb, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to retrieve payment status", ex);
        }
    }

    @Extern
    @Override
    public void syncActions(String accountId) {
        this.syncActions(getAccount(accountId).getAccountId());
    }

    private void syncActions(UUID accountIdKb) {
        try {
            // Fetching intent with plugin info will trigger plugin to sync with gateway and resolve
            // https://groups.google.com/g/killbilling-users/c/5HsAApGm81k/m/uzMcip_tAwAJ
            kbAccount.getPaymentsForAccount(
                    accountIdKb,
                    true,
                    true,
                    null,
                    null,
                    KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve payments from KillBill to sync actions for accountIdKb {}", accountIdKb, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to synchronize", ex);
        }
    }

    @Extern
    @Override
    public Subscription cancelSubscription(String accountId) {
        try {
            Account accountInKb = getAccount(accountId);
            Subscription subscriptionInKb = getSubscription(accountId);

            SubscriptionStatus status = updateAndGetEntitlementStatus(accountStore.getAccount(accountId, false).get().getStatus(), accountInKb, subscriptionInKb, "Cancel subscription");
            if (status != ACTIVE) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to cancel, delete account instead");
            }

            kbSubscription.cancelSubscriptionPlan(
                    subscriptionInKb.getSubscriptionId(),
                    null,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    Entitlement.EntitlementActionPolicy.END_OF_TERM,
                    BillingActionPolicy.END_OF_TERM,
                    null,
                    ImmutableMap.of(),
                    KillBillUtil.roDefault());
            return getSubscription(accountId);
        } catch (KillBillClientException ex) {
            log.warn("Failed to cancel KillBill subscription for account id {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to cancel subscription", ex);
        }
    }

    @Extern
    @Override
    public Subscription resumeSubscription(String accountId) {
        try {
            Account accountInKb = getAccount(accountId);
            Subscription subscriptionInKb = getSubscription(accountId);

            SubscriptionStatus status = updateAndGetEntitlementStatus(accountStore.getAccount(accountId, false).get().getStatus(), accountInKb, subscriptionInKb, "Resume subscription");
            if (status != ACTIVENORENEWAL && status != CANCELLED) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to resume subscription");
            }

            if (subscriptionInKb.getState() == EntitlementState.ACTIVE
                    && subscriptionInKb.getCancelledDate() != null) {
                kbSubscription.uncancelSubscriptionPlan(
                        subscriptionInKb.getSubscriptionId(),
                        null,
                        KillBillUtil.roDefault());
            } else if (subscriptionInKb.getState() == EntitlementState.CANCELLED) {
                return kbSubscription.createSubscription(
                        new Subscription()
                                .setBundleExternalKey(accountId)
                                .setAccountId(subscriptionInKb.getAccountId())
                                .setPlanName(subscriptionInKb.getPlanName())
                                .setPriceOverrides(subscriptionInKb.getPriceOverrides())
                                .setPhaseType(subscriptionInKb.getPhaseType()),
                        null,
                        null,
                        true,
                        false,
                        true,
                        TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                        null,
                        KillBillUtil.roDefault());
            }

            return getSubscription(accountId);
        } catch (KillBillClientException ex) {
            log.warn("Failed to resume KillBill subscription for account id {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to resume subscription", ex);
        }
    }

    @Extern
    @Override
    public Subscription changePlan(String accountId, String planId) {
        try {
            Account accountInKb = getAccount(accountId);
            Subscription subscriptionInKb = getSubscription(accountId);

            SubscriptionStatus status = updateAndGetEntitlementStatus(accountStore.getAccount(accountId, false).get().getStatus(), accountInKb, subscriptionInKb, "Change plan");
            if (status != ACTIVETRIAL && status != ACTIVE) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to change plan with status " + status);
            }

            PhaseType newPhase;
            if (PlanStore.TEAMMATE_PLAN_ID.equals(subscriptionInKb.getPlanName())) {
                // Teammate plan is essentially a non-plan plan,
                // user had no trial yet, so let's give them a trial
                // to prevent creating new accounts
                newPhase = PhaseType.TRIAL;
            } else {
                // Even though we are using START_OF_SUBSCRIPTION changeAlignment
                // we manually transition from TRIAL to EVERGREEN.
                // So changing plans here, we need to override the correct phase,
                // otherwise we may end up going from OLD PLAN EVERGREEN -> NEW PLAN TRIAL
                switch (subscriptionInKb.getPhaseType()) {
                    case TRIAL:
                        if (PlanStore.PLANS_WITHOUT_TRIAL.contains(planId)) {
                            newPhase = PhaseType.EVERGREEN;
                        } else {
                            newPhase = PhaseType.TRIAL;
                        }
                        break;
                    default:
                    case DISCOUNT:
                    case FIXEDTERM:
                        if (LogUtil.rateLimitAllowLog("killbilling-change-plan-unknown-phase-align")) {
                            log.warn("Changing plan from {} phase, not sure how to align, account id {}",
                                    subscriptionInKb.getPhaseType(), subscriptionInKb.getAccountId());
                        }
                        newPhase = subscriptionInKb.getPhaseType();
                        break;
                    case EVERGREEN:
                        newPhase = PhaseType.EVERGREEN;
                        break;
                }
            }

            boolean oldPlanHasTrackedUsers = PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(subscriptionInKb.getPlanName());
            boolean newPlanHasTrackedUsers = PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(planId);

            ImmutableList<UUID> draftInvoicingTagIds = getDraftInvoicingTagIds();
            if (!oldPlanHasTrackedUsers && newPlanHasTrackedUsers) {
                kbAccount.createAccountTags(
                        accountInKb.getAccountId(),
                        draftInvoicingTagIds,
                        KillBillUtil.roDefault());
            }

            kbSubscription.changeSubscriptionPlan(
                    subscriptionInKb.getSubscriptionId(),
                    new Subscription()
                            .setSubscriptionId(subscriptionInKb.getSubscriptionId())
                            .setBundleExternalKey(accountId)
                            .setAccountId(accountInKb.getAccountId())
                            .setPlanName(planId)
                            .setPhaseType(newPhase),
                    null,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    null,
                    null,
                    KillBillUtil.roDefault());

            if (oldPlanHasTrackedUsers && !newPlanHasTrackedUsers) {
                kbAccount.deleteAccountTags(
                        accountInKb.getAccountId(),
                        draftInvoicingTagIds,
                        KillBillUtil.roDefault());
            }

            return getSubscription(accountId);
        } catch (KillBillClientException ex) {
            log.warn("Failed to change KillBill plan for account id {} planId {}", accountId, planId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to change plan", ex);
        }
    }

    private static final String FLAT_YEARLY_PLAN_NAME = "flat-yearly";

    @Override
    public Subscription changePlanToFlatYearly(String accountId, long yearlyPrice) {
        try {
            Account accountInKb = getAccount(accountId);
            Subscription subscriptionInKb = getSubscription(accountId);

            kbSubscription.changeSubscriptionPlan(
                    subscriptionInKb.getSubscriptionId(),
                    new Subscription()
                            .setSubscriptionId(subscriptionInKb.getSubscriptionId())
                            .setBundleExternalKey(accountId)
                            .setAccountId(accountInKb.getAccountId())
                            .setPlanName(FLAT_YEARLY_PLAN_NAME)
                            .setPhaseType(PhaseType.EVERGREEN)
                            .setPriceOverrides(ImmutableList.of(
                                    new PhasePrice(
                                            FLAT_YEARLY_PLAN_NAME,
                                            FLAT_YEARLY_PLAN_NAME + "-evergreen",
                                            PhaseType.EVERGREEN.name(),
                                            null,
                                            BigDecimal.valueOf(yearlyPrice),
                                            null))),
                    null,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    BillingActionPolicy.IMMEDIATE,
                    null,
                    KillBillUtil.roDefault());

            boolean oldPlanHasTrackedUsers = PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(subscriptionInKb.getPlanName());
            if (oldPlanHasTrackedUsers) {
                kbAccount.deleteAccountTags(
                        accountInKb.getAccountId(),
                        getDraftInvoicingTagIds(),
                        KillBillUtil.roDefault());
            }

            return getSubscription(accountId);
        } catch (KillBillClientException ex) {
            log.warn("Failed to change KillBill plan to flat yearly for account id {} yearlyPrice {}", accountId, yearlyPrice, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to change plan", ex);
        }
    }

    @Override
    public boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId) {
        boolean allowUpgrade = false;
        if (ACTIVETRIAL.equals(accountInDyn.getStatus())
                && getDefaultPaymentMethodDetails(accountInDyn.getAccountId()).isEmpty()
                && "standard2-monthly".equals(requiredPlanId)) {
            allowUpgrade = true;
        } else if (PlanStore.TEAMMATE_PLAN_ID.equals(accountInDyn.getPlanid())
                && ImmutableSet.of("growth2-monthly", "standard2-monthly").equals(requiredPlanId)) {
            allowUpgrade = true;
        }

        if (allowUpgrade) {
            usageExecutor.submit(() -> {
                try {
                    changePlan(accountInDyn.getAccountId(), requiredPlanId);
                } catch (Throwable th) {
                    log.error("Failed to auto upgrade accountId {} to plan {}",
                            accountInDyn.getAccountId(), requiredPlanId, th);
                }
            });
        }

        return allowUpgrade;
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        try {
            Optional<String> nextPaginationUrlOpt = cursorOpt
                    .map(serverSecretCursor::decryptString);

            org.killbill.billing.client.model.Invoices result;
            if (!nextPaginationUrlOpt.isPresent()) {
                UUID accountIdKb = getAccount(accountId).getAccountId();
                result = kbAccount.getInvoicesForAccount(
                        accountIdKb,
                        null,
                        null,
                        false, // "We don't support fetching migration invoices and specifying a start date" -kb
                        false,
                        true,
                        null,
                        KillBillUtil.roDefault());
            } else {
                result = kbClient.doGet(nextPaginationUrlOpt.get(), org.killbill.billing.client.model.Invoices.class, RequestOptions.empty());
            }

            ImmutableList<InvoiceItem> invoices = result.stream()
                    .filter(i -> i.getStatus() != InvoiceStatus.DRAFT)
                    .map(i -> {
                        String status;
                        if (i.getStatus() == InvoiceStatus.VOID) {
                            status = "Void";
                        } else if (i.getBalance().compareTo(BigDecimal.ZERO) > 0) {
                            status = "Unpaid";
                        } else {
                            status = "Paid";
                        }
                        String description = i.getItems().stream()
                                .map(org.killbill.billing.client.model.gen.InvoiceItem::getPrettyPlanName)
                                .filter(p -> !Strings.isNullOrEmpty(p))
                                .map(planStore::prettifyPlanName)
                                .collect(Collectors.joining(", "));
                        if (Strings.isNullOrEmpty(description)) {
                            description = "Unspecified";
                        }
                        return new InvoiceItem(
                                LocalDate.of(
                                        i.getInvoiceDate().getYear(),
                                        i.getInvoiceDate().getMonthOfYear(),
                                        i.getInvoiceDate().getDayOfMonth()),
                                status,
                                i.getAmount().doubleValue(),
                                description,
                                i.getInvoiceId().toString());
                    })
                    .collect(ImmutableList.toImmutableList());

            return new Invoices(
                    Strings.isNullOrEmpty(result.getPaginationNextPageUri())
                            ? null : serverSecretCursor.encryptString(result.getPaginationNextPageUri()),
                    invoices);
        } catch (KillBillClientException ex) {
            log.warn("Failed to get invoices from KillBill for accountId {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to fetch invoices", ex);
        }
    }

    @Extern
    @Override
    public String getInvoiceHtml(String accountId, UUID invoiceId) {
        try {
            Invoice invoice = kbInvoice.getInvoice(invoiceId, KillBillUtil.roDefault());
            if (invoice == null) {
                throw new ApiException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            UUID accountIdKb = getAccount(accountId).getAccountId();
            if (!invoice.getAccountId().equals(accountIdKb)) {
                log.warn("Requested HTML for invoiceId {} with account ext id {} id {} belonging to different account id {}",
                        invoiceId, accountId, accountIdKb, invoice.getAccountId());
                throw new ApiException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            if (invoice.getStatus() == InvoiceStatus.DRAFT) {
                throw new ApiException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            String invoiceHtml = kbInvoice.getInvoiceAsHTML(invoice.getInvoiceId(), KillBillUtil.roDefault());
            for (org.killbill.billing.client.model.gen.InvoiceItem item : invoice.getItems()) {
                String phaseName = item.getPhaseName();
                String prettyPlanName = item.getPrettyPlanName();
                if (Strings.isNullOrEmpty(phaseName) || Strings.isNullOrEmpty(prettyPlanName)) {
                    continue;
                }
                prettyPlanName = planStore.prettifyPlanName(prettyPlanName);
                invoiceHtml = invoiceHtml.replaceAll(phaseName, prettyPlanName);
            }
            // TODO make this more robust
            invoiceHtml = invoiceHtml.replaceAll("growth2-tracked-users", "Tracked Users");
            invoiceHtml = invoiceHtml.replaceAll("standard2-tracked-users", "Tracked Users");
            return invoiceHtml;
        } catch (KillBillClientException ex) {
            log.warn("Failed to get invoice HTML from KillBill for accountId {} invoiceId {}", accountId, invoiceId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to fetch invoice", ex);
        }
    }

    @Extern
    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
        UUID accountIdKb = getAccount(accountId).getAccountId();
        return getDefaultPaymentMethodDetails(accountIdKb);
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb) {
        try {
            PaymentMethods paymentMethods = kbAccount.getPaymentMethodsForAccount(
                    accountIdKb,
                    true,
                    false,
                    null,
                    null,
                    KillBillUtil.roDefault());
            log.trace("Payment methods for kbAccountId {}: {}", accountIdKb, paymentMethods);
            Optional<PaymentMethod> defaultPaymentMethodOpt;
            do {
                defaultPaymentMethodOpt = paymentMethods.stream()
                        .filter(PaymentMethod::isDefault)
                        .findAny();
            } while (!defaultPaymentMethodOpt.isPresent()
                    && (paymentMethods = paymentMethods.getNext()) != null);

            return defaultPaymentMethodOpt.map(paymentMethod -> {
                Optional<String> cardBrand = Optional.empty();
                Optional<String> cardLast4 = Optional.empty();
                Optional<Long> cardExpiryMonth = Optional.empty();
                Optional<Long> cardExpiryYear = Optional.empty();
                if (STRIPE_PLUGIN_NAME.equals(paymentMethod.getPluginName())
                        && paymentMethod.getPluginInfo() != null && paymentMethod.getPluginInfo().getProperties() != null) {
                    for (PluginProperty prop : paymentMethod.getPluginInfo().getProperties()) {
                        switch (prop.getKey()) {
                            case "card_last4":
                                cardLast4 = Optional.of(prop.getValue());
                                break;
                            case "card_brand":
                                cardBrand = Optional.of(prop.getValue());
                                break;
                            case "card_exp_month":
                                cardExpiryMonth = Optional.of(Long.valueOf(prop.getValue()));
                                break;
                            case "card_exp_year":
                                cardExpiryYear = Optional.of(Long.valueOf(prop.getValue()));
                                break;
                        }
                    }
                }

                Gateway gateway = Arrays.stream(Gateway.values())
                        .filter(g -> g.getPluginName().equals(paymentMethod.getPluginName()))
                        .findAny()
                        .orElse(Gateway.OTHER);
                return new PaymentMethodDetails(
                        gateway,
                        paymentMethod,
                        cardBrand,
                        cardLast4,
                        cardExpiryYear,
                        cardExpiryMonth);
            });
        } catch (KillBillClientException ex) {
            log.warn("Failed to get payment method details from KillBill for accountIdKb {}", accountIdKb, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to fetch payment method", ex);
        }
    }

    @Override
    public ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId) {
        try {
            Optional<UUID> accountIdKb = accountId.map(this::getAccount).map(Account::getAccountId);
            PlanDetails planDetails = kbCatalog.getAvailableBasePlans(accountIdKb.orElse(null), KillBillUtil.roDefault());
            return planDetails == null || planDetails.isEmpty()
                    ? ImmutableSet.of() : ImmutableSet.copyOf(planDetails);
        } catch (KillBillClientException ex) {
            log.warn("Failed to get available base plans for account id {}", accountId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor", ex);
        }
    }

    @Override
    public ListenableFuture<Void> recordUsage(UsageType type, String accountId, String projectId, String userId) {
        return recordUsage(type, accountId, projectId, userId, Optional.empty());
    }

    @Override
    public ListenableFuture<Void> recordUsage(UsageType type, String accountId, String projectId, UserModel user) {
        return recordUsage(type, accountId, projectId, user.getUserId(), Optional.of(user));
    }

    private ListenableFuture<Void> recordUsage(UsageType type, String accountId, String projectId, String userId, Optional<UserModel> userOpt) {
        if (!config.usageRecordEnabled()) {
            return Futures.immediateFuture(null);
        }
        if ((userOpt.isPresent() && userOpt.get().getIsTracked() == Boolean.TRUE)) {
            return Futures.immediateFuture(null);
        }
        return usageExecutor.submit(() -> {
            try {
                if (!config.usageRecordEnabled()) {
                    return null;
                }
                if (!userOpt.isPresent() && userStore.getUser(projectId, userId).get().getIsTracked() == Boolean.TRUE) {
                    return null;
                }
                userStore.setUserTracked(projectId, userId);
            } catch (Throwable th) {
                if (LogUtil.rateLimitAllowLog("killbilling-usage-record-fail")) {
                    log.warn("Failed to execute usage recording", th);
                }
            }
            return null;
        });
    }

    @Override
    public void finalizeInvoice(String accountId, UUID invoiceId) {
        try {
            if (!config.finalizeInvoiceEnabled()) {
                return;
            }

            Invoice invoice = kbInvoice.getInvoice(invoiceId, KillBillUtil.roDefault());
            if (!InvoiceStatus.DRAFT.equals(invoice.getStatus())) {
                return;
            }

            Subscription subscription = getSubscription(accountId);
            Optional<org.joda.time.LocalDate> cancelledDateOpt = Optional.ofNullable(subscription.getCancelledDate());

            boolean doUpdateInvoice = false;
            Supplier<Long> userCountSupplier = Suppliers.memoize(() -> accountStore.getUserCountForAccount(accountId));
            HashSet<String> idempotentKeys = Sets.newHashSet();
            for (var invoiceItem : invoice.getItems()) {
                if (!PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains((invoiceItem.getPlanName()))) {
                    continue;
                }
                if (!InvoiceItemType.USAGE.equals(invoiceItem.getItemType())) {
                    continue;
                }

                org.joda.time.LocalDate recordDate = invoiceItem.getStartDate().equals(invoiceItem.getEndDate())
                        ? invoiceItem.getStartDate() : invoiceItem.getEndDate().minusDays(1);
                String idempotentKey = TRACKED_USER_UNIT_NAME + '-' + recordDate.toString();
                if (!idempotentKeys.add(idempotentKey)) {
                    continue;
                }

                if (userCountSupplier.get() <= 0L) {
                    break;
                }

                // Killbill doesnt allow recording usage after entitlement ends
                // Backdate usage to cancellation instead.
                if (cancelledDateOpt.isPresent() && recordDate.isAfter(cancelledDateOpt.get())) {
                    log.debug("Recording usage for cancelled subscription with backdating to {}, accountId {} invoiceId {} planId {} recordDate {}",
                            recordDate, invoice.getAccountId(), invoice.getInvoiceId(), invoiceItem.getPlanName(), recordDate);
                    recordDate = cancelledDateOpt.get();
                }

                try {
                    kbUsage.recordUsage(new SubscriptionUsageRecord(
                            invoiceItem.getSubscriptionId(),
                            idempotentKey,
                            ImmutableList.of(new UnitUsageRecord(
                                    TRACKED_USER_UNIT_NAME,
                                    ImmutableList.of(new UsageRecord(
                                            recordDate,
                                            userCountSupplier.get()
                                    ))))), KillBillUtil.roDefault());
                } catch (KillBillClientException ex) {
                    if (ex.getBillingException() == null
                            || ex.getBillingException().getCode() == null
                            || ex.getBillingException().getCode() != ErrorCode.USAGE_RECORD_TRACKING_ID_ALREADY_EXISTS.getCode()) {
                        throw ex;
                    }
                    // If it exists already, no need to update invoice
                    log.trace("Recorded usage already exists for tracked users, accountId {} invoiceId {} planId {} recordDate {}",
                            invoice.getAccountId(), invoice.getInvoiceId(), invoiceItem.getPlanName(), recordDate);
                    continue;
                }
                doUpdateInvoice = true;
                log.debug("Recorded usage {} tracked users, accountId {} invoiceId {} planId {} recordDate {}",
                        userCountSupplier.get(), invoice.getAccountId(), invoice.getInvoiceId(), invoiceItem.getPlanName(), recordDate);
            }

            Optional<Invoice> newInvoiceOpt = Optional.empty();
            if (doUpdateInvoice) {
                newInvoiceOpt = Optional.of(kbInvoice.createFutureInvoice(
                        invoice.getAccountId(),
                        null,
                        KillBillUtil.roDefault()));
            }

            log.info("Committing invoice for accountId {} invoiceId {}",
                    invoice.getAccountId(), invoice.getInvoiceId());
            kbInvoice.commitInvoice(invoiceId, KillBillUtil.roDefault());

            if (newInvoiceOpt.isPresent()
                    && !newInvoiceOpt.get().getInvoiceId().equals(invoiceId)
                    && InvoiceStatus.DRAFT.equals(newInvoiceOpt.get().getStatus())) {
                log.info("Committing usage invoice for accountId {} invoiceId {}",
                        invoice.getAccountId(), newInvoiceOpt.get().getInvoiceId());
                kbInvoice.commitInvoice(newInvoiceOpt.get().getInvoiceId(), KillBillUtil.roDefault());
            }
        } catch (KillBillClientException ex) {
            log.warn("Failed to finalize invoice, accountId {} invoiceId {}",
                    accountId, invoiceId, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, ex);
        }
    }

    @Extern
    @Override
    public void closeAccount(String accountId) {
        UUID accountIdKb = getAccount(accountId).getAccountId();
        try {
            kbAccount.closeAccount(
                    accountIdKb,
                    true,
                    true,
                    false,
                    true,
                    KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to close KillBill accountIdKb {}", accountIdKb, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to close account", ex);
        }
    }

    ImmutableList<UUID> getDraftInvoicingTagIds() {
        return config.reuseDraftInvoices()
                ? ImmutableList.of(
                ControlTagType.AUTO_INVOICING_DRAFT.getId(),
                ControlTagType.AUTO_INVOICING_REUSE_DRAFT.getId())
                : ImmutableList.of(ControlTagType.AUTO_INVOICING_DRAFT.getId());
    }

    /** If changed, also change in BillingPage.tsx */
    private AccountBillingPaymentActionRequired getPaymentStripeAction(String paymentIntentClientSecret) {
        return new AccountBillingPaymentActionRequired("stripe-next-action", ImmutableMap.of(
                "paymentIntentClientSecret", paymentIntentClientSecret));
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
