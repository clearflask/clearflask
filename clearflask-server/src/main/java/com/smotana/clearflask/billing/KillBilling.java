package com.smotana.clearflask.billing;


import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Lists;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.api.model.InvoiceItem;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.LocalDate;
import org.killbill.billing.catalog.api.Currency;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.api.gen.AccountApi;
import org.killbill.billing.client.api.gen.CatalogApi;
import org.killbill.billing.client.api.gen.InvoiceApi;
import org.killbill.billing.client.api.gen.SubscriptionApi;
import org.killbill.billing.client.model.PaymentMethods;
import org.killbill.billing.client.model.PlanDetails;
import org.killbill.billing.client.model.gen.*;
import org.killbill.billing.invoice.api.InvoiceStatus;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.util.*;
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
            log.error("Failed to create KillBill Account for email {} name {}", email, name, ex);
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
            log.error("Failed to create KillBill Subscription for accountId {} email {} name {}", account.getAccountId(), email, name, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to contact payment processor, try again later", ex);
        }

        return new AccountWithSubscription(account, subscription);
    }

    @Override
    public Account getAccount(String accountId) {
        try {
            Account account = kbAccount.getAccountByKey(accountId, KillBillUtil.roDefault());
            if (account == null) {
                log.warn("Account doesn't exist by account id {}", accountId);
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Account doesn't exist");
            }
            return account;
        } catch (KillBillClientException ex) {
            log.error("Failed to retrieve KillBill Account by id {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Account", ex);
        }
    }

    @Override
    public Account getAccountByKbId(UUID accountIdKb) {
        try {
            Account account = kbAccount.getAccount(accountIdKb, KillBillUtil.roDefault());
            if (account == null) {
                log.warn("Account doesn't exist by account kb id {}", accountIdKb);
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Account doesn't exist");
            }
            return account;
        } catch (KillBillClientException ex) {
            log.error("Failed to retrieve KillBill Account by kb id {}", accountIdKb, ex);
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
            log.error("Failed to retrieve KillBill Subscription by account id {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to fetch Subscription", ex);
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
                log.error("Unsupported subscription state {} for id {} account id {}",
                        subscription.getState(), subscription.getSubscriptionId(), account.getAccountId());
                throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to process");
        }
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
            log.error("Failed to update KillBill payment token for account id {}", accountId, ex);
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
            log.error("Failed to cancel KillBill subscription for account id {}", accountId, ex);
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
            log.error("Failed to unCancel KillBill subscription for account id {}", accountId, ex);
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
            log.error("Failed to change KillBill plan account id {} planId {}", accountId, planId, ex);
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
            log.error("Failed to activate KillBill Subscription for accountId {} planId {}", accountId, planId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to activate subscription", ex);
        }
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        LocalDate endDate = cursorOpt
                .map(serverSecretCursor::decryptString)
                .map(LocalDate::parse)
                .orElseGet(LocalDate::now);
        LocalDate startDate = endDate.minusMonths(6);

        try {
            UUID accountIdKb = getAccount(accountId).getAccountId();
            org.killbill.billing.client.model.Invoices result = kbAccount.getInvoicesForAccount(
                    accountIdKb,
                    startDate,
                    endDate,
                    false, // "We don't support fetching migration invoices and specifying a start date" -kb
                    false,
                    true,
                    null,
                    KillBillUtil.roDefault()
            );
            ArrayList<InvoiceItem> invoices = Lists.newArrayList();
            do {
                invoices.addAll(result.stream()
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
                                    i.getInvoiceId().toString());
                        })
                        .collect(ImmutableList.toImmutableList()));
            } while ((result = result.getNext()) != null);
            invoices.sort(Comparator.comparing(InvoiceItem::getDate).reversed());

            return new Invoices(
                    invoices.isEmpty() ? null : serverSecretCursor.encryptString(startDate.minusDays(1).toString()),
                    invoices);
        } catch (KillBillClientException ex) {
            log.error("Failed to get invoices from KillBill for accountId {}", accountId, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR,
                    "Failed to fetch invoices", ex);
        }
    }

    @Override
    public String getInvoiceHtml(String accountId, String invoiceId) {
        try {
            UUID invoiceIdUuid = UUID.fromString(invoiceId);
            Invoice invoice = kbInvoice.getInvoice(invoiceIdUuid, KillBillUtil.roDefault());
            if (invoice == null) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            UUID accountIdKb = getAccount(accountId).getAccountId();
            if (!invoice.getAccountId().equals(accountIdKb)) {
                log.warn("Requested HTML for invoice id {} with account ext id {} id {} belonging to different account id {}",
                        invoiceId, accountId, accountIdKb, invoice.getAccountId());
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            if (invoice.getStatus() == InvoiceStatus.DRAFT) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST,
                        "Invoice doesn't exist");
            }
            return kbInvoice.getInvoiceAsHTML(invoiceIdUuid, KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.error("Failed to get invoice HTML from KillBill for accountId {} invoiceId {}", accountId, invoiceId, ex);
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
            log.error("Failed to get payment method details from KillBill for accountId {}", accountId, ex);
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
            log.error("Failed to get available base plans for account id {}", accountId, ex);
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
