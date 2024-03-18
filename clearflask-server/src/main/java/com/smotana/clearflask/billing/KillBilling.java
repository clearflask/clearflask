// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.base.Suppliers;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.ListenableScheduledFuture;
import com.google.common.util.concurrent.ListeningScheduledExecutorService;
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
import com.smotana.clearflask.web.resource.ProjectResource;
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
import org.killbill.billing.client.api.gen.*;
import org.killbill.billing.client.model.*;
import org.killbill.billing.client.model.gen.*;
import org.killbill.billing.entitlement.api.Entitlement;
import org.killbill.billing.entitlement.api.Entitlement.EntitlementState;
import org.killbill.billing.entitlement.api.SubscriptionEventType;
import org.killbill.billing.invoice.api.InvoiceItemType;
import org.killbill.billing.invoice.api.InvoiceStatus;
import org.killbill.billing.util.api.AuditLevel;
import org.killbill.billing.util.tag.ControlTagType;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import static com.smotana.clearflask.api.model.SubscriptionStatus.*;
import static com.smotana.clearflask.billing.KillBillClientProvider.STRIPE_PLUGIN_NAME;

@Slf4j
@Singleton
public class KillBilling extends ManagedService implements Billing {

    /**
     * If changed, also change in catalogXXX.xml
     */
    public static final String TRACKED_USER_UNIT_NAME = "tracked-user";
    /**
     * If changed, also change in catalogXXX.xml
     */
    public static final String TRACKED_TEAMMATE_UNIT_NAME = "tracked-teammate";

    public interface Config {
        @DefaultValue("60000")
        long callTimeoutInMillis();

        @DefaultValue("true")
        boolean usageRecordEnabled();

        @DefaultValue("false")
        boolean usageRecordKbIdempotentEnabled();

        @DefaultValue("true")
        boolean finalizeInvoiceEnabled();

        /**
         * Used in testing for deterministic number of invoices
         */
        @DefaultValue("true")
        boolean reuseDraftInvoices();

        /**
         * Retry creating account again assuming it failed before
         */
        @DefaultValue("true")
        boolean createAccountIfNotExists();

        /**
         * Retry creating subscription again assuming it failed before
         */
        @DefaultValue("true")
        boolean createSubscriptionIfNotExists();

        @DefaultValue("P1D")
        Duration scanUncommitedInvoicesScheduleFrequency();

        @DefaultValue("P1D")
        Duration scanUncommitedInvoicesCommitOlderThan();

        @DefaultValue("P7D")
        Duration scanUncommitedInvoicesCommitYoungerThan();

        @DefaultValue("true")
        boolean enableDeleteProjectForBlockedAccount();
    }

    @Inject
    private Config config;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;
    @Inject
    private AccountApi kbAccount;
    @Inject
    private CreditApi kbCredit;
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
    private ProjectResource projectResource;
    @Inject
    private PlanStore planStore;
    @Inject
    private PlanVerifyStore planVerifyStore;
    @Inject
    private UserStore userStore;
    @Inject
    private NotificationService notificationService;

    private ListeningScheduledExecutorService usageExecutor;
    private ListeningScheduledExecutorService accountCreationExecutor;
    private ListenableScheduledFuture commitUncommitedInvoicesSchedule;

    @Override
    protected void serviceStart() throws Exception {
        usageExecutor = MoreExecutors.listeningDecorator(Executors.newScheduledThreadPool(2, new ThreadFactoryBuilder()
                .setNameFormat("KillBilling-usage-%d").build()));
        accountCreationExecutor = MoreExecutors.listeningDecorator(Executors.newScheduledThreadPool(2, new ThreadFactoryBuilder()
                .setNameFormat("KillBilling-account-creation-%d").build()));

        commitUncommitedInvoicesSchedule = usageExecutor.scheduleAtFixedRate(
                this::commitUncommitedInvoices,
                (long) (config.scanUncommitedInvoicesScheduleFrequency().toMillis() * ThreadLocalRandom.current().nextDouble()),
                config.scanUncommitedInvoicesScheduleFrequency().toMillis(), TimeUnit.MILLISECONDS);
    }

    @Override
    protected void serviceStop() throws Exception {
        commitUncommitedInvoicesSchedule.cancel(false);

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
            log.trace("Creating account {}", accountInDyn);
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

        if (PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(accountInDyn.getPlanid())
                || PlanStore.RECORD_TEAMMATES_FOR_PLANS.contains(accountInDyn.getPlanid())) {
            try {
                log.trace("Attaching invoicing tags to new KillBill Account for email {} name {}",
                        accountInDyn.getEmail(), accountInDyn.getName());
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

    private Optional<List<PhasePrice>> getUserChosenPriceOverrides(String accountId, String planId, Optional<Long> recurringPriceOpt) {
        if (!PlanStore.ALLOW_USER_CHOOSE_PRICING_FOR_PLANS.contains(planId)) {
            if (recurringPriceOpt.isPresent()) {
                log.warn("Account {} requested a recurring price for a plan {} that doesn't support it",
                        accountId, planId);
                throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                        "Failed to setup your subscription, try again later");
            }
            return Optional.empty();
        }
        if (recurringPriceOpt.isEmpty()) {
            return Optional.empty();
        }
        if (recurringPriceOpt.get() > PlanStore.ALLOW_USER_CHOOSE_PRICING_MAX) {
            log.warn("Account {} requested monthly price above allowed limit {}",
                    accountId, recurringPriceOpt.get());
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to setup your subscription, try again later");
        }
        if (recurringPriceOpt.get() < PlanStore.ALLOW_USER_CHOOSE_PRICING_MIN) {
            log.warn("Account {} requested monthly price below allowed limit {}",
                    accountId, recurringPriceOpt.get());
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to setup your subscription, try again later");
        }
        return Optional.of(ImmutableList.of(
                new PhasePrice(
                        planId,
                        planId + "-evergreen",
                        PhaseType.EVERGREEN.name(),
                        null,
                        BigDecimal.valueOf(recurringPriceOpt.get()),
                        null)));
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
                            .setPlanName(accountInDyn.getPlanid())
                            .setPriceOverrides(getUserChosenPriceOverrides(
                                    accountInDyn.getAccountId(),
                                    accountInDyn.getPlanid(),
                                    Optional.ofNullable(accountInDyn.getRequestedRecurringPrice()))
                                    .orElse(null)),
                    null,
                    null,
                    false,
                    false,
                    false,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    null,
                    KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            if (Optional.ofNullable(ex.getBillingException()).flatMap(ex2 -> Optional.ofNullable(ex2.getCode()))
                    .filter(code -> code.equals(ErrorCode.SUB_CREATE_BP_EXISTS.getCode()))
                    .isPresent()) {
                // If already exists, return it
                Optional<Subscription> subscriptionOpt = getSubscriptionByBundleExternalKey(accountInDyn.getAccountId(), false);
                if (subscriptionOpt.isPresent()) {
                    return subscriptionOpt.get();
                }
            }
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
        return getAccount(accountId, false);
    }

    private Account getAccount(String accountId, boolean isSecondAttempt) {
        try {
            Account account = kbAccount.getAccountByKey(
                    accountId,
                    true,
                    true,
                    AuditLevel.NONE,
                    KillBillUtil.roDefault());
            if (account == null) {
                if (!isSecondAttempt && config.createAccountIfNotExists()) {
                    Optional<AccountStore.Account> accountInDynOpt = accountStore.getAccount(accountId, false);
                    if (accountInDynOpt.isPresent()) {
                        log.warn("Account doesn't exist in KB by account id {}, creating...", accountId);
                        try {
                            return createAccount(accountInDynOpt.get());
                        } catch (ApiException ex) {
                            if (ex.getCause() instanceof KillBillClientException
                                    && Strings.nullToEmpty(ex.getCause().getMessage()).contains("Account already exists for key")) {
                                log.warn("Account apparently existed after all so let's fetch it from KB by account id {}, fetching...", accountId);
                                return getAccount(accountId, true);
                            } else {
                                throw ex;
                            }
                        }
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
     * <p>
     * Preview below state diagram with https://www.planttext.com/
     * <p>
     * [*] --> ActiveTrial
     * <p>
     * ActiveTrial : - Phase is TRIAL
     * ActiveTrial --> Active : Reach MAU limit (With payment)
     * ActiveTrial --> NoPaymentMethod : Reach MAU limit (Without payment)
     * ActiveTrial --> ActiveTrial : Add payment
     * ActiveTrial --> ActiveTrial : Change plan
     * ActiveTrial --> [*] : Delete account
     * <p>
     * Active : - Subscription active
     * Active : - No outstanding balance
     * Active : - Not overdue
     * Active --> Limited : Plan exceeds limits
     * Active --> ActivePaymentRetry : Outstanding balance
     * Active --> ActiveNoRenewal : Cancel subscription
     * Active --> Active : Update payment
     * Active --> Active : Change plan
     * Active --> [*] : Delete account
     * <p>
     * Limited : - Subscription active
     * Limited : - Limited functionality
     * Limited : - ie exceeded plan max posts
     * Limited --> Active : Plan within limits
     * Limited --> [*] : Delete account
     * <p>
     * Blocked : - Not TRIAL phase
     * Blocked : - Phase is BLOCKED
     * Blocked :   or Overdue cancelled
     * Blocked --> [*] : Delete account
     * <p>
     * Cancelled : Subscription is cancelled
     * Cancelled --> Active : User resumes
     * Cancelled --> Active : Update payment method
     * Cancelled --> [*] : Delete account
     * <p>
     * ActiveNoRenewal : Subscription pending cancel
     * ActiveNoRenewal --> Active : User resumes
     * ActiveNoRenewal --> Cancelled : Expires
     * ActiveNoRenewal --> Active : Update payment method
     * ActiveNoRenewal --> [*] : Delete account
     * <p>
     * NoPaymentMethod : - No payment method
     * NoPaymentMethod : - Outstanding balance
     * NoPaymentMethod : - Not overdue cancelled
     * NoPaymentMethod --> Active : Add payment
     * NoPaymentMethod --> [*] : Delete account
     * <p>
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
        final SubscriptionStatus status;
        boolean hasOutstandingBalance = account.getAccountBalance() != null && account.getAccountBalance().compareTo(BigDecimal.ZERO) > 0;
        boolean isOverdueUnpaid = KillBillSync.OVERDUE_UNPAID_STATE_NAME.equals(overdueState.getName());
        // When user pays, outstanding balance goes to zero while
        // it takes some time for overdue unpaid to clear.
        // Use isUnpaid that covers this scenario.
        boolean isUnpaid = hasOutstandingBalance && isOverdueUnpaid;
        boolean isOverdueCancelled = KillBillSync.OVERDUE_CANCELLED_STATE_NAME.equals(overdueState.getName());
        Supplier<Boolean> hasPaymentMethod = Suppliers.memoize(() -> getDefaultPaymentMethodDetails(account.getAccountId()).isPresent())::get;
        Supplier<Boolean> isLimited = Suppliers.memoize(() -> isAccountLimited(account.getExternalKey(), subscription.getPlanName()))::get;
        if (EntitlementState.BLOCKED.equals(subscription.getState())
                || isOverdueCancelled) {
            status = BLOCKED;
        } else if (PhaseType.TRIAL.equals(subscription.getPhaseType())) {
            status = isLimited.get() ? LIMITED : ACTIVETRIAL;
        } else if (EntitlementState.ACTIVE.equals(subscription.getState())
                && subscription.getCancelledDate() == null
                && !isUnpaid) {
            status = isLimited.get() ? LIMITED : ACTIVE;
        } else if (EntitlementState.CANCELLED.equals(subscription.getState())) {
            status = CANCELLED;
        } else if (EntitlementState.ACTIVE.equals(subscription.getState())
                && subscription.getCancelledDate() != null) {
            status = isLimited.get() ? LIMITED : ACTIVENORENEWAL;
        } else if (hasPaymentMethod.get()
                && isUnpaid) {
            status = ACTIVEPAYMENTRETRY;
        } else if (!hasPaymentMethod.get()
                && isUnpaid) {
            status = NOPAYMENTMETHOD;
        } else {
            status = ACTIVE;
            log.error("Could not determine subscription status, forcing {} for subsc id {} account id {} ext key {} from:\n -- account {}\n -- subscription {}\n -- overdueState {}\n -- hasPaymentMethod {}\n -- isLimited {}",
                    status, subscription.getSubscriptionId(), account.getAccountId(), account.getExternalKey(), account, subscription, overdueState, hasPaymentMethod.get(), isLimited.get());
        }
        if (log.isTraceEnabled()) {
            log.trace("Calculated subscription status to be {} from:\n -- account {}\n -- subscription {}\n -- overdueState {}\n -- hasPaymentMethod {}",
                    status, account, subscription, overdueState, hasPaymentMethod.get());
        }
        return status;
    }

    private boolean isAccountLimited(String accountId, String planId) {
        try {
            planVerifyStore.verifyAccountMeetsLimits(planId, accountId);
        } catch (ApiException ex) {
            return true;
        }
        return false;
    }

    @Override
    public SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, Account account, Subscription subscription, String reason) {
        SubscriptionStatus newStatus = getEntitlementStatus(account, subscription);
        if (!newStatus.equals(currentStatus)) {
            log.info("Subscription status change {} -> {}, reason: {}, for {}",
                    currentStatus, newStatus, reason, account.getExternalKey());
            accountStore.updateStatus(account.getExternalKey(), newStatus);
            if (ACTIVETRIAL.equals(currentStatus)) {
                // Trial ends email notification
                if (accountStore.shouldSendTrialEndedNotification(account.getExternalKey(), subscription.getPlanName())) {
                    Optional<PaymentMethodDetails> paymentOpt = getDefaultPaymentMethodDetails(account.getAccountId());
                    notificationService.onTrialEnded(account.getExternalKey(), account.getEmail(), paymentOpt.isPresent());
                }
            } else if (BLOCKED.equals(currentStatus)) {
                // Delete all projects to free up resources
                if (config.enableDeleteProjectForBlockedAccount()) {
                    AccountStore.Account accountInDyn = accountStore.getAccount(account.getExternalKey(), false).get();
                    accountInDyn.getProjectIds()
                            .forEach(projectId -> projectResource.projectDeleteAdmin(accountInDyn, projectId));
                } else {
                    log.error("ACTION REQUIRED: Project not deleted for blocked account, status {} account {} email {} reason {}",
                            currentStatus, account.getExternalKey(), account.getEmail(), reason);
                }
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
    public Subscription changePlan(String accountId, String planId, Optional<Long> recurringPriceOpt) {
        try {
            Account accountInKb = getAccount(accountId);
            Subscription subscriptionInKb = getSubscription(accountId);

            SubscriptionStatus status = updateAndGetEntitlementStatus(accountStore.getAccount(accountId, false).get().getStatus(), accountInKb, subscriptionInKb, "Change plan");
            if (status != ACTIVETRIAL && status != ACTIVE && status != LIMITED) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to change plan when not in good standing: " + status);
            }

            boolean newPlanHasNoTrial = PlanStore.PLANS_WITHOUT_TRIAL.contains(planId);

            PhaseType newPhase;
            if (!newPlanHasNoTrial && PlanStore.TEAMMATE_PLAN_ID.equals(subscriptionInKb.getPlanName())) {
                // Teammate plan is essentially a non-plan plan,
                // user had no trial yet, so let's give them a trial
                // to prevent creating new accounts
                newPhase = PhaseType.TRIAL;
            } else if (!newPlanHasNoTrial && "starter-unlimited".equals(subscriptionInKb.getPlanName())) {
                // Started plan has a limit of ideas, users can switch one time
                // to a paid plan and they deserve their trial. Some users may switch to
                // a paid plan before using their starter plan for two weeks
                newPhase = PhaseType.TRIAL;
            } else {
                // Even though we are using START_OF_SUBSCRIPTION changeAlignment
                // we manually transition from TRIAL to EVERGREEN.
                // So changing plans here, we need to override the correct phase,
                // otherwise we may end up going from OLD PLAN EVERGREEN -> NEW PLAN TRIAL
                switch (subscriptionInKb.getPhaseType()) {
                    case TRIAL:
                        if (newPlanHasNoTrial) {
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

            boolean oldPlanHasTracking = PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(subscriptionInKb.getPlanName())
                    || PlanStore.RECORD_TEAMMATES_FOR_PLANS.contains(subscriptionInKb.getPlanName());
            boolean newPlanHasTracking = PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(planId)
                    || PlanStore.RECORD_TEAMMATES_FOR_PLANS.contains(planId);

            ImmutableList<UUID> draftInvoicingTagIds = getDraftInvoicingTagIds();
            if (!oldPlanHasTracking && newPlanHasTracking) {
                log.trace("Attaching invoicing tags to changed plan for KillBill Account {} name {}",
                        accountInKb.getAccountId(), accountInKb.getName());
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
                            .setPhaseType(newPhase)
                            .setPriceOverrides(getUserChosenPriceOverrides(accountId, planId, recurringPriceOpt)
                                    .orElse(null)),
                    null,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    null,
                    null,
                    KillBillUtil.roDefault());

            if (oldPlanHasTracking && !newPlanHasTracking) {
                log.trace("Removing invoicing tags to changed plan for KillBill Account {} name {}",
                        accountInKb.getAccountId(), accountInKb.getName());
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

            boolean oldPlanHasTracking = PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(subscriptionInKb.getPlanName())
                    || PlanStore.RECORD_TEAMMATES_FOR_PLANS.contains(subscriptionInKb.getPlanName());
            if (oldPlanHasTracking) {
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

    /**
     * If changed, also change in UpgradeWrapper.tsx:canAutoUpgrade
     */
    @Override
    public boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId) {
        boolean allowUpgrade = false;
        if (ACTIVETRIAL.equals(accountInDyn.getStatus())
                && getDefaultPaymentMethodDetails(accountInDyn.getAccountId()).isEmpty()) {
            allowUpgrade = true;
            // Disabled for teammate plan
            //        } else if (PlanStore.TEAMMATE_PLAN_ID.equals(accountInDyn.getPlanid())) {
            //            allowUpgrade = true;
        }

        if (allowUpgrade) {
            usageExecutor.submit(() -> {
                try {
                    changePlan(accountInDyn.getAccountId(), requiredPlanId, Optional.empty());
                } catch (Throwable th) {
                    log.error("Failed to auto upgrade accountId {} to plan {}",
                            accountInDyn.getAccountId(), requiredPlanId, th);
                }
            });
        }

        return allowUpgrade;
    }

    @Override
    public Optional<AccountStore.Account> tryAutoUpgradeAfterSelfhostLicenseAdded(AccountStore.Account accountInDyn) {
        return Optional.empty(); // Not for Killbill, only for selfhosted
    }

    /**
     * TODO sort invoices by newest
     * This is helpful: https://groups.google.com/g/killbilling-users/c/P0gwkdTarTA/m/Ol0WSE1iBgAJ
     */
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
                        null,
                        KillBillUtil.roDefault());
            } else {
                result = kbClient.doGet(nextPaginationUrlOpt.get(), org.killbill.billing.client.model.Invoices.class, KillBillUtil.roDefault());
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

    /**
     * Fetch invoice HTML from KillBill. If accountId is specified, ensure that the invoice belongs to that account.
     */
    @Extern
    @Override
    public String getInvoiceHtml(UUID invoiceId, Optional<String> accountIdOpt) {
        try {
            Invoice invoice = kbInvoice.getInvoice(invoiceId, KillBillUtil.roDefault());
            if (invoice == null) {
                throw new ApiException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            if (accountIdOpt.isPresent()) {
                UUID accountIdKb = getAccount(accountIdOpt.get()).getAccountId();
                if (!invoice.getAccountId().equals(accountIdKb)) {
                    throw new ApiException(Response.Status.BAD_REQUEST,
                            "You need to log in to the right account to view this invoice");
                }
            }
            if (invoice.getStatus() == InvoiceStatus.DRAFT) {
                throw new ApiException(Response.Status.BAD_REQUEST,
                        "Invoice is still in draft");
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
            invoiceHtml = invoiceHtml.replaceAll("standard3-teammates", "Teammates");
            return invoiceHtml;
        } catch (KillBillClientException ex) {
            log.warn("Failed to get invoice HTML from KillBill for invoiceId {} accountIdOpt {}", invoiceId, accountIdOpt, ex);
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
    public void creditAdjustment(String accountId, long amount, String description) {
        try {
            UUID accountIdKb = getAccount(accountId).getAccountId();

            org.killbill.billing.client.model.gen.InvoiceItem invoiceItem = new org.killbill.billing.client.model.gen.InvoiceItem()
                    .setAccountId(accountIdKb)
                    .setAmount(BigDecimal.valueOf(Math.abs(amount)))
                    .setDescription(description);
            InvoiceItems invoiceItems = new InvoiceItems();
            invoiceItems.add(invoiceItem);
            if (amount > 0L) {
                kbCredit.createCredits(
                        invoiceItems,
                        true,
                        null,
                        KillBillUtil.roDefault());
            } else if (amount < 0L) {
                kbInvoice.createExternalCharges(
                        accountIdKb,
                        invoiceItems,
                        org.joda.time.LocalDate.now(),
                        true,
                        null,
                        KillBillUtil.roDefault());
            }
        } catch (KillBillClientException ex) {
            log.warn("Failed to set credits of {} to account id {} description {}",
                    amount, accountId, description, ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to adjust credits", ex);
        }
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId) {
        recordUsage(type, accountId, projectId, Optional.empty(), Optional.empty());
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, String userId) {
        recordUsage(type, accountId, projectId, Optional.of(userId), Optional.empty());
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, UserModel user) {
        recordUsage(type, accountId, projectId, Optional.of(user.getUserId()), Optional.of(user));
    }

    private void recordUsage(UsageType type, String accountId, String projectId, Optional<String> userIdOpt, Optional<UserModel> userOpt) {
        userIdOpt.ifPresent(s -> recordTrackedUsers(type, accountId, projectId, s, userOpt));
        recordPostCountChanged(type, accountId);
    }

    private void recordTrackedUsers(UsageType type, String accountId, String projectId, String userId, Optional<UserModel> userOpt) {
        if (!config.usageRecordEnabled()) {
            return;
        }
        if ((userOpt.isPresent() && userOpt.get().getIsTracked() == Boolean.TRUE)) {
            return;
        }
        usageExecutor.submit(() -> {
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

    private void recordPostCountChanged(UsageType type, String accountId) {
        if (!config.usageRecordEnabled()) {
            return;
        }
        boolean increased;
        switch (type) {
            case POST:
                increased = true;
                break;
            case POST_DELETED:
                increased = false;
                break;
            default:
                return;
        }
        AccountStore.Account account = accountStore.getAccount(accountId, true).get();
        if (!"starter-unlimited".equals(account.getPlanid())) {
            return;
        }
        if (SubscriptionStatus.LIMITED.equals(account.getStatus()) == increased) {
            return;
        }
        usageExecutor.submit(() -> {
            try {
                if (!config.usageRecordEnabled()) {
                    return null;
                }
                Optional<AccountStore.Account> accountOpt = accountStore.getAccount(accountId, false);
                if (accountOpt.isEmpty()) {
                    return null;
                }
                updateAndGetEntitlementStatus(
                        accountOpt.get().getStatus(),
                        getAccount(accountId),
                        getSubscription(accountId),
                        "Post delete");
            } catch (Throwable th) {
                if (LogUtil.rateLimitAllowLog("killbilling-usage-record-post-delete-fail")) {
                    log.warn("Failed to execute post delete usage recording", th);
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
            log.trace("Received invoice to finalize for account {} invoiceId {}", accountId, invoiceId);

            Invoice invoice = kbInvoice.getInvoice(invoiceId, KillBillUtil.roDefault());
            if (!InvoiceStatus.DRAFT.equals(invoice.getStatus())) {
                log.trace("Invoice not finalizing for status {} for account {} invoiceId {}", invoice.getStatus(), accountId, invoiceId);
                return;
            }

            Subscription subscription = getSubscription(accountId);

            boolean doUpdateInvoice = false;
            Supplier<Long> userCountSupplier = Suppliers.memoize(() -> accountStore.getUserCountForAccount(accountId));
            Supplier<Long> teammateCountSupplier = Suppliers.memoize(() -> accountStore.getTeammateCountForAccount(accountId));
            HashSet<String> idempotentKeys = Sets.newHashSet();
            for (var invoiceItem : invoice.getItems()) {
                if (!InvoiceItemType.USAGE.equals(invoiceItem.getItemType())) {
                    continue;
                }

                boolean recordTrackedUsers = PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains((invoiceItem.getPlanName()));
                boolean recordTeammates = PlanStore.RECORD_TEAMMATES_FOR_PLANS.contains((invoiceItem.getPlanName()));
                if (!recordTrackedUsers && !recordTeammates) {
                    continue;
                }

                org.joda.time.LocalDate recordDate = invoiceItem.getStartDate().equals(invoiceItem.getEndDate())
                        ? invoiceItem.getStartDate() : invoiceItem.getEndDate().minusDays(1);
                Optional<org.joda.time.LocalDate> cancelledDateOpt = Optional.ofNullable(subscription.getCancelledDate());
                // Killbill doesnt allow recording usage after entitlement ends
                // Backdate usage to cancellation instead.
                if (cancelledDateOpt.isPresent() && recordDate.isAfter(cancelledDateOpt.get())) {
                    log.debug("Recording usage for cancelled subscription with backdating to {}, accountId {} invoiceId {} planId {} recordDate {}",
                            recordDate, invoice.getAccountId(), invoice.getInvoiceId(), invoiceItem.getPlanName(), recordDate);
                    recordDate = cancelledDateOpt.get();
                }

                if (recordTeammates) {
                    String idempotentKey = TRACKED_TEAMMATE_UNIT_NAME + '-' + recordDate.toString();
                    if (idempotentKeys.add(idempotentKey)) {
                        try {
                            kbUsage.recordUsage(new SubscriptionUsageRecord(
                                    invoiceItem.getSubscriptionId(),
                                    idempotentKey,
                                    ImmutableList.of(new UnitUsageRecord(
                                            TRACKED_TEAMMATE_UNIT_NAME,
                                            ImmutableList.of(new UsageRecord(
                                                    recordDate,
                                                    teammateCountSupplier.get()
                                            ))))), KillBillUtil.roDefault());
                            doUpdateInvoice = true;
                            log.info("Recorded usage {} teammates, accountId {} invoiceId {} planId {} recordDate {}",
                                    teammateCountSupplier.get(), invoice.getAccountId(), invoice.getInvoiceId(), invoiceItem.getPlanName(), recordDate);
                        } catch (KillBillClientException ex) {
                            if (ex.getBillingException() == null
                                    || ex.getBillingException().getCode() == null
                                    || ex.getBillingException().getCode() != ErrorCode.USAGE_RECORD_TRACKING_ID_ALREADY_EXISTS.getCode()) {
                                throw ex;
                            }
                            // If it exists already, no need to update invoice
                            log.trace("Recorded usage already exists for teammates, accountId {} invoiceId {} planId {} recordDate {}",
                                    invoice.getAccountId(), invoice.getInvoiceId(), invoiceItem.getPlanName(), recordDate);
                        }
                    }
                }

                if (recordTrackedUsers) {
                    String idempotentKey = TRACKED_USER_UNIT_NAME + '-' + recordDate.toString();
                    if (idempotentKeys.add(idempotentKey) && userCountSupplier.get() > 0L) {
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
                            doUpdateInvoice = true;
                            log.info("Recorded usage {} tracked users, accountId {} invoiceId {} planId {} recordDate {}",
                                    userCountSupplier.get(), invoice.getAccountId(), invoice.getInvoiceId(), invoiceItem.getPlanName(), recordDate);
                        } catch (KillBillClientException ex) {
                            if (ex.getBillingException() == null
                                    || ex.getBillingException().getCode() == null
                                    || ex.getBillingException().getCode() != ErrorCode.USAGE_RECORD_TRACKING_ID_ALREADY_EXISTS.getCode()) {
                                throw ex;
                            }
                            // If it exists already, no need to update invoice
                            log.trace("Recorded usage already exists for tracked users, accountId {} invoiceId {} planId {} recordDate {}",
                                    invoice.getAccountId(), invoice.getInvoiceId(), invoiceItem.getPlanName(), recordDate);
                        }
                    }
                }
            }

            Optional<Invoice> newInvoiceOpt = Optional.empty();
            if (doUpdateInvoice) {
                newInvoiceOpt = Optional.ofNullable(kbInvoice.createFutureInvoice(
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

    @Extern
    private void commitUncommitedInvoices() {
        try {
            Optional<org.killbill.billing.client.model.Invoices> invoicesOpt = Optional.of(kbInvoice.getInvoices(
                    0L,
                    // Negative limit searches backwards (https://groups.google.com/g/killbilling-users/c/P0gwkdTarTA/m/Ol0WSE1iBgAJ)
                    -100L,
                    null,
                    KillBillUtil.roDefault()));
            Instant olderThan = Instant.now().minus(config.scanUncommitedInvoicesCommitOlderThan());
            Instant youngerThan = Instant.now().minus(config.scanUncommitedInvoicesCommitYoungerThan());

            OUTER:
            do {
                for (Invoice invoice : invoicesOpt.get()) {
                    if (invoice.getInvoiceDate().toDate().toInstant().isBefore(youngerThan)) {
                        break OUTER;
                    }
                    if (invoice.getInvoiceDate().toDate().toInstant().isAfter(olderThan)) {
                        continue;
                    }
                    if (!InvoiceStatus.DRAFT.equals(invoice.getStatus())) {
                        continue;
                    }
                    String accountId = getAccountByKbId(invoice.getAccountId()).getExternalKey();
                    finalizeInvoice(accountId, invoice.getInvoiceId());
                }
                invoicesOpt = invoicesOpt.flatMap(invoices -> {
                    try {
                        return Optional.ofNullable(invoices.getNext());
                    } catch (KillBillClientException ex) {
                        throw new RuntimeException(ex);
                    }
                });
            } while (invoicesOpt.isPresent());
        } catch (Exception ex) {
            log.warn("Failed to process commitUncommitedInvoices", ex);
        }
    }

    private ImmutableList<UUID> getDraftInvoicingTagIds() {
        return config.reuseDraftInvoices()
                ? ImmutableList.of(
                ControlTagType.AUTO_INVOICING_DRAFT.getId(),
                ControlTagType.AUTO_INVOICING_REUSE_DRAFT.getId())
                : ImmutableList.of(ControlTagType.AUTO_INVOICING_DRAFT.getId());
    }

    /**
     * If changed, also change in BillingPage.tsx
     */
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
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(KillBilling.class).asEagerSingleton();
            }
        };
    }
}
