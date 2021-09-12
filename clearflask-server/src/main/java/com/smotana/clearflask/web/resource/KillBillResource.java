// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.KillBillSync;
import com.smotana.clearflask.billing.KillBillUtil;
import com.smotana.clearflask.core.ClearFlaskCreditSync;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.ObjectType;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.api.gen.InvoiceApi;
import org.killbill.billing.client.api.gen.PaymentApi;
import org.killbill.billing.client.api.gen.TenantApi;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.Invoice;
import org.killbill.billing.client.model.gen.InvoiceItem;
import org.killbill.billing.client.model.gen.Payment;
import org.killbill.billing.client.model.gen.PaymentTransaction;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.client.model.gen.TenantKeyValue;
import org.killbill.billing.invoice.api.InvoiceStatus;
import org.killbill.billing.notification.plugin.api.ExtBusEventType;
import org.killbill.billing.notification.plugin.api.PaymentMetadata;
import rx.Observable;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class KillBillResource extends ManagedService {

    public static final String WEBHOOK_PATH = "/webhook/killbill";

    public interface Config {
        /**
         * See {@link ExtBusEventType} for all options
         */
        @DefaultValue(value = "ACCOUNT_CHANGE" +
                ",SUBSCRIPTION_CREATION" +
                ",SUBSCRIPTION_PHASE" +
                ",SUBSCRIPTION_CHANGE" +
                ",SUBSCRIPTION_CANCEL" +
                ",SUBSCRIPTION_UNCANCEL" +
                ",SUBSCRIPTION_BCD_CHANGE" +
                ",PAYMENT_SUCCESS" +
                ",PAYMENT_FAILED" +
                ",INVOICE_CREATION" +
                ",INVOICE_PAYMENT_SUCCESS", innerType = String.class)
        Set<String> eventsToListenFor();

        Observable<Set<String>> eventsToListenForObservable();

        @DefaultValue(value = "1", innerType = Long.class)
        Optional<Long> warnIfWebhookCountNotEquals();

        @DefaultValue("false")
        boolean logWhenEventIsUnnecessary();

        @DefaultValue("true")
        boolean registerWebhookOnStartup();

        @DefaultValue("")
        String overrideWebhookDomain();

        @DefaultValue("0")
        long overrideWebhookPort();

        @DefaultValue("true")
        boolean useHttps();
    }

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;
    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Gson gson;
    @Inject
    private AccountStore accountStore;
    @Inject
    private Billing billing;
    @Inject
    private TenantApi kbTenant;
    @Inject
    private InvoiceApi kbInvoice;
    @Inject
    private PaymentApi kbPayment;
    @Inject
    private ClearFlaskCreditSync clearFlaskCreditSync;
    @Inject
    private NotificationService notificationService;

    private ImmutableSet<ExtBusEventType> eventsToListenForCached = ImmutableSet.of();

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(KillBillSync.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        if (config.registerWebhookOnStartup()) {
            String domain = Optional.ofNullable(Strings.emptyToNull(config.overrideWebhookDomain())).orElse(configApp.domain());
            String port = config.overrideWebhookPort() == 0 ? "" : (":" + config.overrideWebhookPort());
            String protocol = config.useHttps() ? "https://" : "http://";
            String webhookPath = protocol + domain + port + "/api" + Application.RESOURCE_VERSION + WEBHOOK_PATH;
            log.info("Registering KillBill webhook on {}", webhookPath);
            TenantKeyValue tenantKeyValue = kbTenant.registerPushNotificationCallback(webhookPath, KillBillUtil.roDefault());
            Optional<Long> expectedWebhookCount = config.warnIfWebhookCountNotEquals();
            if (expectedWebhookCount.isPresent()) {
                long actualWebhookCount = tenantKeyValue == null || tenantKeyValue.getValues() == null || tenantKeyValue.getValues().isEmpty()
                        ? 0 : tenantKeyValue.getValues().size();
                if (expectedWebhookCount.get() != actualWebhookCount) {
                    log.warn("Expecting {} webhooks but found {}, webhooks {}",
                            expectedWebhookCount.get(), actualWebhookCount,
                            tenantKeyValue != null ? tenantKeyValue.getValues() : null);
                }
            }
        }

        config.eventsToListenForObservable().subscribe(eventsToListenFor -> {
            updateEventsToListenFor(eventsToListenFor == null ? ImmutableSet.of() : eventsToListenFor, false);
        });
        updateEventsToListenFor(config.eventsToListenFor() == null ? ImmutableSet.of() : config.eventsToListenFor(), true);
    }

    @POST
    @Path(WEBHOOK_PATH)
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    @Limit(requiredPermits = 1)
    public void webhook(String payload) {
        Event event = gson.fromJson(payload, Event.class);

        if (!eventsToListenForCached.contains(event.eventType)) {
            return;
        }

        if (event.getAccountId() == null) {
            log.warn("Received KillBill event with no account id {}", event);
            return;
        }

        Account kbAccount = billing.getAccountByKbId(event.getAccountId());
        if (kbAccount == null) {
            log.warn("Received event for non-existent KillBill account with kb id {}", event.getAccountId());
            return;
        }
        String accountId = kbAccount.getExternalKey();
        Subscription kbSubscription = billing.getSubscription(accountId);
        if (kbSubscription == null) {
            log.warn("Received event for non-existent KillBill subscription, KillBill account exists, with account id {} kb id {}", accountId, kbAccount.getAccountId());
            return;
        }
        Optional<AccountStore.Account> accountOpt = accountStore.getAccount(accountId, false);
        if (!accountOpt.isPresent()) {
            log.warn("Received event for non-existent account, KillBill account and subscription exist, with account id {}", accountId);
            return;
        }

        boolean changesMade = false;

        if (ExtBusEventType.INVOICE_CREATION.equals(event.eventType)) {
            billing.finalizeInvoice(accountOpt.get().getAccountId(), event.getObjectId());
            changesMade = true;
        }

        if (ExtBusEventType.INVOICE_PAYMENT_SUCCESS.equals(event.eventType)) {
            processInvoiceCreditSync(accountOpt.get(), event);
            changesMade = true;
        }

        SubscriptionStatus newStatus = billing.updateAndGetEntitlementStatus(
                accountOpt.get().getStatus(),
                kbAccount,
                kbSubscription,
                "KillBill event" + event.getEventType());
        if (!accountOpt.get().getStatus().equals(newStatus)) {
            changesMade = true;
        }

        if (ExtBusEventType.PAYMENT_FAILED.equals(event.eventType)) {
            processPaymentFailed(accountOpt.get(), event);
            changesMade = true;
        }

        if (!kbSubscription.getPlanName().equals(accountOpt.get().getPlanid())) {
            log.info("KillBill event {} caused accountId {} plan change {} -> {}",
                    event.getEventType(), accountId, accountOpt.get().getPlanid(), kbSubscription.getPlanName());
            accountStore.setPlan(accountId, kbSubscription.getPlanName());
            changesMade = true;
        }

        if (!changesMade) {
            if (config.logWhenEventIsUnnecessary() && LogUtil.rateLimitAllowLog("killbillresource-eventUnnecessary")) {
                log.info("KillBill event {} was unnecessary {}", event.getEventType(), event);
            }
        }
    }

    private void processPaymentFailed(AccountStore.Account account, Event event) {
        Payment payment = null;
        try {
            payment = kbPayment.getPayment(
                    event.getObjectId(),
                    true,
                    true,
                    null,
                    null,
                    KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to fetch payment, paymentId {} eventType {}",
                    event.objectId, event.getEventType(), ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, ex);
        }
        PaymentMetadata paymentMetadata = gson.fromJson(event.metaData, PaymentMetadata.class);
        PaymentTransaction paymentTransaction = payment.getTransactions().stream()
                .filter(pt -> pt.getTransactionId().equals(paymentMetadata.getPaymentTransactionId()))
                .findAny()
                .get();
        long amount = paymentTransaction.getAmount().longValueExact();
        boolean requiresAction = paymentTransaction.getProperties() != null && paymentTransaction.getProperties().stream()
                .anyMatch(pluginProperty -> "status".equals(pluginProperty.getKey())
                        && "requires_action".equals(pluginProperty.getValue()));

        Optional<Billing.PaymentMethodDetails> defaultPaymentMethodOpt = billing.getDefaultPaymentMethodDetails(account.getAccountId());
        boolean hasPaymentMethod = defaultPaymentMethodOpt.isPresent();

        notificationService.onPaymentFailed(
                account.getAccountId(),
                account.getEmail(),
                amount,
                requiresAction,
                hasPaymentMethod);
    }

    private void processInvoiceCreditSync(AccountStore.Account account, Event event) {

        if (event.getObjectType() != ObjectType.INVOICE) {
            log.warn("Expected {} event to have object type {}, but found {}",
                    event.getEventType(), ObjectType.INVOICE, event.objectType);
            throw new ApiException(Response.Status.BAD_REQUEST);
        }

        Invoice invoice = null;
        try {
            invoice = kbInvoice.getInvoice(event.objectId, KillBillUtil.roDefault());
        } catch (KillBillClientException ex) {
            log.warn("Failed to fetch invoice, invoiceId {} eventType {}",
                    event.objectId, event.getEventType(), ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, ex);
        }

        if (!InvoiceStatus.COMMITTED.equals(invoice.getStatus())) {
            log.debug("Not processing invoice in non-committed status, invoiceId {}",
                    event.objectId);
            return;
        }

        Optional<String> planNameOpt = invoice.getItems().stream()
                .map(InvoiceItem::getPrettyPlanName)
                .findAny();
        String summary = planNameOpt.map(n -> "Credit for " + n + " plan").orElse("Credit for payment");

        try {
            clearFlaskCreditSync.process(
                    invoice.getInvoiceId().toString(),
                    account,
                    invoice.getAmount().doubleValue(),
                    summary);
        } catch (Exception ex) {
            log.warn("Failed to sync credit, invoiceId {} eventType {}",
                    event.objectId, event.getEventType(), ex);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, ex);
        }
    }

    private void updateEventsToListenFor(Set<String> eventsToListenForStr, boolean doThrow) {
        ImmutableSet.Builder<ExtBusEventType> eventsToListenForBuilder = ImmutableSet.builderWithExpectedSize(eventsToListenForStr.size());
        for (String eventToListenFor : eventsToListenForStr) {
            try {
                eventsToListenForBuilder.add(ExtBusEventType.valueOf(eventToListenFor));
            } catch (IllegalArgumentException ex) {
                log.error("Misconfiguration of eventsToListenForStr");
                if (doThrow) {
                    throw ex;
                }
                return;
            }
        }
        eventsToListenForCached = eventsToListenForBuilder.build();
    }

    @Value
    @AllArgsConstructor
    public static class Event {
        @NonNull
        @GsonNonNull
        ExtBusEventType eventType;

        ObjectType objectType;

        UUID objectId;

        UUID accountId;

        String metaData;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(KillBillResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding()
                        .to(KillBillResource.class);
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(KillBillResource.class);
            }
        };
    }
}
