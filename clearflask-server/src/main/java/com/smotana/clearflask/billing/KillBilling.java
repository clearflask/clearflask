package com.smotana.clearflask.billing;


import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.InvoiceItem;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.catalog.api.Currency;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.KillBillHttpClient;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.AccountApi;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.api.gen.InvoiceApi;
import org.killbill.billing.client.api.gen.SubscriptionApi;
import org.killbill.billing.client.model.PaymentMethods;
import org.killbill.billing.client.model.PlanDetails;
import org.killbill.billing.client.model.gen.*;
import org.killbill.billing.entitlement.api.Entitlement.EntitlementState;
import org.killbill.billing.invoice.api.InvoiceStatus;
import org.killbill.billing.util.api.AuditLevel;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static com.smotana.clearflask.billing.KillBillClientProvider.PAYMENT_TEST_PLUGIN_NAME;
import static com.smotana.clearflask.billing.KillBillClientProvider.STRIPE_PLUGIN_NAME;

@Slf4j
@Singleton
public class KillBilling implements Billing {

    public interface Config {
        @DefaultValue("30000")
        long callTimeoutInMillis();
    }

    @Inject
    private Config config;
    @Inject
    @Named("cursor")
    private ServerSecret serverSecretCursor;
    @Inject
    private AccountApi kbAccount;
    @Inject
    private SubscriptionApi kbSubscription;
    @Inject
    private InvoiceApi kbInvoice;
    @Inject
    private CatalogApi kbCatalog;
    @Inject
    private KillBillHttpClient kbClient;

    @Override
    public AccountWithSubscription createAccountWithSubscription(String accountId, String email, String name, String planId) {
        Account account;
        try {
            account = kbAccount.createAccount(new Account()
                    .setExternalKey(accountId)
                    .setName(name)
                    .setEmail(email)
                    .setCurrency(Currency.USD), KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to create KillBill Account for email {} name {}", email, name, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor, try again later", ex);
        }

        Subscription subscription;
        try {
            subscription = kbSubscription.createSubscription(new Subscription()
                            .setExternalKey(accountId)
                            .setAccountId(account.getAccountId())
                            .setPlanName(planId),
                    null,
                    null,
                    false,
                    false,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    null,
                    KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to create KillBill Subscription for accountId {} email {} name {}", account.getAccountId(), email, name, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor, try again later", ex);
        }

        return new AccountWithSubscription(account, subscription);
    }

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
                log.warn("Account doesn't exist by account id {}", accountId);
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Account doesn't exist");
            }
            return account;
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Account by id {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Account", ex);
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
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Account doesn't exist");
            }
            return account;
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Account by kb id {}", accountIdKb, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Account", ex);
        }
    }

    @Override
    public Subscription getSubscription(String accountId) {
        try {
            Subscription subscription = kbSubscription.getSubscriptionByKey(accountId, KillBillUtil.roDefault());
            if (subscription == null) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Subscription doesn't exist");
            }
            return subscription;
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Subscription by account id {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Subscription", ex);
        }
    }

    @Override
    public SubscriptionStatus getEntitlementStatus(Account account, Subscription subscription) {
        OverdueState overdueState = null;
        try {
            overdueState = kbAccount.getOverdueAccount(account.getAccountId(), KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to retrieve KillBill Overdue State from account id {}", account.getAccountId(), ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to process", ex);
        }
        // TODO All of this needs to be verified
        final SubscriptionStatus status;
        boolean hasOverdueBalance = account.getAccountBalance() != null && account.getAccountBalance().compareTo(BigDecimal.ZERO) > 0;
        boolean isOverdueCancelled = KillBillSync.OVERDUE_CANCELLED_STATE_NAME.equals(overdueState.getName());
        boolean isOverdueUnpaid = KillBillSync.OVERDUE_UNPAID_STATE_NAME.equals(overdueState.getName());
        if ((hasOverdueBalance && isOverdueCancelled)
                || EntitlementState.BLOCKED.equals(subscription.getState())
                || overdueState.isBlockChanges() == Boolean.TRUE) {
            status = SubscriptionStatus.BLOCKED;
        } else if (!hasOverdueBalance && (isOverdueCancelled || isOverdueUnpaid)) {
            status = SubscriptionStatus.TRIALEXPIRED;
        } else if (hasOverdueBalance && isOverdueUnpaid) {
            status = SubscriptionStatus.ACTIVEPAYMENTRETRY;
        } else if (PhaseType.TRIAL.equals(subscription.getPhaseType())) {
            status = SubscriptionStatus.ACTIVETRIAL;
        } else if (EntitlementState.PENDING.equals(subscription.getState())) {
            status = SubscriptionStatus.PENDING;
        } else if (EntitlementState.CANCELLED.equals(subscription.getState())
                || EntitlementState.EXPIRED.equals(subscription.getState())) {
            status = SubscriptionStatus.CANCELLED;
        } else if (EntitlementState.ACTIVE.equals(subscription.getState())
                && subscription.getCancelledDate() != null) {
            status = SubscriptionStatus.ACTIVENORENEWAL;
        } else if (EntitlementState.ACTIVE.equals(subscription.getState())) {
            status = SubscriptionStatus.ACTIVE;
        } else {
            status = SubscriptionStatus.BLOCKED;
            log.error("Could not determine subscription status, forcing {} for subsc id {} account id {} ext key {} from:\n -- account {}\n -- subscription {}\n -- overdueState {}",
                    status, subscription.getSubscriptionId(), account.getAccountId(), account.getExternalKey(), account, subscription, overdueState);
        }
        // TODO change to TRACE
        log.info("Calculated subscription status to be {} from:\n -- account {}\n -- subscription {}\n -- overdueState {}",
                status, account, subscription, overdueState);
        return status;
    }

    @Override
    public void updatePaymentToken(String accountId, Gateway gateway, String paymentToken) {
        try {
            UUID accountIdKb = getAccount(accountId).getAccountId();
            kbAccount.createPaymentMethod(
                    accountIdKb,
                    new PaymentMethod(
                            null,
                            null,
                            accountIdKb,
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
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to update payment method", ex);
        }
    }

    @Override
    public Subscription cancelSubscription(String accountId) {
        try {
            kbSubscription.cancelSubscriptionPlan(
                    getSubscription(accountId).getSubscriptionId(),
                    null,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    null,
                    null,
                    null,
                    ImmutableMap.of(),
                    KillBillUtil.roDefault());
            return getSubscription(accountId);
        } catch (KillBillClientException ex) {
            log.warn("Failed to cancel KillBill subscription for account id {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to cancel subscription", ex);
        }
    }

    @Override
    public Subscription undoPendingCancel(String accountId) {
        try {
            kbSubscription.uncancelSubscriptionPlan(
                    getSubscription(accountId).getSubscriptionId(),
                    null,
                    KillBillUtil.roDefault());
            return getSubscription(accountId);
        } catch (KillBillClientException ex) {
            log.warn("Failed to unCancel KillBill subscription for account id {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to un-cancel subscription", ex);
        }
    }

    @Override
    public Subscription changePlan(String accountId, String planId) {
        try {
            UUID accountIdKb = getAccount(accountId).getAccountId();
            kbSubscription.changeSubscriptionPlan(
                    getSubscription(accountId).getSubscriptionId(),
                    new Subscription()
                            .setExternalKey(accountId)
                            .setAccountId(accountIdKb)
                            .setPlanName(planId),
                    null,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    null,
                    null,
                    KillBillUtil.roDefault());
            return getSubscription(accountId);
        } catch (KillBillClientException ex) {
            log.warn("Failed to change KillBill plan account id {} planId {}", accountId, planId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to change plan", ex);
        }
    }

    @Override
    public Subscription activateSubscription(String accountId, String planId) {
        try {
            Subscription oldSubscription = getSubscription(accountId);
            switch (oldSubscription.getState()) {
                default:
                case PENDING:
                case ACTIVE:
                case BLOCKED:
                    throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                            "Previous subscription still active, cannot start a new subscription");
                case EXPIRED:
                case CANCELLED:
                    break;
            }

            return kbSubscription.createSubscription(
                    new Subscription()
                            .setExternalKey(accountId)
                            .setAccountId(oldSubscription.getAccountId())
                            .setPlanName(planId),
                    null,
                    null,
                    true,
                    false,
                    true,
                    TimeUnit.MILLISECONDS.toSeconds(config.callTimeoutInMillis()),
                    null,
                    KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to activate KillBill Subscription for accountId {} planId {}", accountId, planId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to activate subscription", ex);
        }
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
                                .collect(Collectors.joining(", "));
                        if (Strings.isNullOrEmpty(description)) {
                            description = "Unspecified";
                        }
                        return new InvoiceItem(
                                i.getInvoiceDate().toDate().toInstant(),
                                status,
                                i.getAmount().doubleValue(),
                                description,
                                // KillBill API returns string although it's always a number
                                Long.parseLong(i.getInvoiceNumber()));
                    })
                    .collect(ImmutableList.toImmutableList());

            return new Invoices(
                    Strings.isNullOrEmpty(result.getPaginationNextPageUri())
                            ? null : serverSecretCursor.encryptString(result.getPaginationNextPageUri()),
                    invoices);
        } catch (KillBillClientException ex) {
            log.warn("Failed to get invoices from KillBill for accountId {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to fetch invoices", ex);
        }
    }

    @Override
    public String getInvoiceHtml(String accountId, long invoiceNumber) {
        try {
            Invoice invoice = kbInvoice.getInvoiceByNumber((int) invoiceNumber, KillBillUtil.roDefault());
            if (invoice == null) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            UUID accountIdKb = getAccount(accountId).getAccountId();
            if (!invoice.getAccountId().equals(accountIdKb)) {
                log.warn("Requested HTML for invoiceNumber {} with account ext id {} id {} belonging to different account id {}",
                        invoiceNumber, accountId, accountIdKb, invoice.getAccountId());
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            if (invoice.getStatus() == InvoiceStatus.DRAFT) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            return kbInvoice.getInvoiceAsHTML(invoice.getInvoiceId(), KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to get invoice HTML from KillBill for accountId {} invoiceNumber {}", accountId, invoiceNumber, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to fetch invoice", ex);
        }
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
        try {
            UUID accountIdKb = getAccount(accountId).getAccountId();
            PaymentMethods paymentMethods = kbAccount.getPaymentMethodsForAccount(
                    accountIdKb,
                    true,
                    false,
                    null,
                    null,
                    KillBillUtil.roDefault());
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
                } else if (PAYMENT_TEST_PLUGIN_NAME.equals(paymentMethod.getPluginName())) {
                    cardLast4 = Optional.of("????");
                    cardBrand = Optional.of("???????");
                    cardExpiryMonth = Optional.of(1L);
                    cardExpiryYear = Optional.of(2099L);
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
            log.warn("Failed to get payment method details from KillBill for accountId {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
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
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor", ex);
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Billing.class).to(KillBilling.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
