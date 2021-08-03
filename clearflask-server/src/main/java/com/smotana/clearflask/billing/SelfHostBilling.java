package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.ApiException;
import org.joda.time.LocalDate;
import org.killbill.billing.catalog.api.BillingPeriod;
import org.killbill.billing.catalog.api.Currency;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.catalog.api.ProductCategory;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.PaymentMethod;
import org.killbill.billing.client.model.gen.PaymentMethodPluginDetail;
import org.killbill.billing.client.model.gen.PhasePrice;
import org.killbill.billing.client.model.gen.PlanDetail;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.entitlement.api.Entitlement;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

public class SelfHostBilling implements Billing {

    private static UUID ACCOUNT_ID = UUID.fromString("250F25AE-327D-4DFD-B947-D5507073EAC9");

    public interface Config {
        @DefaultValue("John Doe")
        String accountName();

        @DefaultValue("johndoe@example.com")
        String accountEmail();

    }

    @Inject
    private Config config;

    @Override
    public void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public Account getAccount(String accountId) {
        if (!ACCOUNT_ID.toString().equals(accountId)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Account not found");
        }
        return new Account(
                ACCOUNT_ID,
                config.accountName(),
                config.accountName().length(),
                ACCOUNT_ID.toString(),
                config.accountEmail(),
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

    @Override
    public Account getAccountByKbId(UUID accountIdKb) {
        return getAccount(accountIdKb.toString());
    }

    @Override
    public Subscription getSubscription(String accountId) {
        if (!ACCOUNT_ID.toString().equals(accountId)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Account not found");
        }
        return new Subscription(
                ACCOUNT_ID,
                ACCOUNT_ID,
                ACCOUNT_ID.toString(),
                ACCOUNT_ID,
                ACCOUNT_ID.toString(),
                LocalDate.parse("1970"),
                SelfHostPlanStore.SELF_HOST_PLAN.getBasePlanId(),
                ProductCategory.BASE,
                BillingPeriod.ANNUAL,
                PhaseType.EVERGREEN,
                null,
                SelfHostPlanStore.SELF_HOST_PLAN.getBasePlanId(),
                Entitlement.EntitlementState.ACTIVE,
                Entitlement.EntitlementSourceType.NATIVE,
                null,
                LocalDate.parse("2070"),
                LocalDate.parse("1970"),
                null,
                0,
                ImmutableList.of(),
                null,
                ImmutableList.of(new PhasePrice(
                        SelfHostPlanStore.SELF_HOST_PLAN.getBasePlanId(),
                        SelfHostPlanStore.SELF_HOST_PLAN.getBasePlanId(),
                        PhaseType.EVERGREEN.name(),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        ImmutableList.of())),
                ImmutableList.of());
    }

    @Override
    public Optional<String> getEndOfTermChangeToPlanId(Subscription subscription) {
        return Optional.empty();
    }

    @Override
    public SubscriptionStatus getEntitlementStatus(Account account, Subscription subscription) {
        return SubscriptionStatus.ACTIVE;
    }

    @Override
    public SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, Account account, Subscription subscription, String reason) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public void updatePaymentToken(String accountId, Gateway type, String paymentToken) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public Optional<AccountBillingPaymentActionRequired> getActions(UUID accountIdKb) {
        return Optional.empty();
    }

    @Override
    public void syncActions(String accountId) {
        // No-op
    }

    @Override
    public Subscription cancelSubscription(String accountId) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public Subscription resumeSubscription(String accountId) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public Subscription changePlan(String accountId, String planId) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public Subscription changePlanToFlatYearly(String accountId, long yearlyPrice) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        return new Invoices(null, ImmutableList.of());
    }

    @Override
    public String getInvoiceHtml(String accountId, UUID invoiceId) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
        if (!ACCOUNT_ID.toString().equals(accountId)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Account not found");
        }
        return Optional.of(new PaymentMethodDetails(
                Gateway.EXTERNAL,
                new PaymentMethod(
                        ACCOUNT_ID,
                        ACCOUNT_ID.toString(),
                        ACCOUNT_ID,
                        true,
                        Gateway.EXTERNAL.getPluginName(),
                        new PaymentMethodPluginDetail(
                                ACCOUNT_ID.toString(),
                                true,
                                ImmutableList.of()),
                        ImmutableList.of()),
                Optional.empty(),
                Optional.empty(),
                Optional.empty(),
                Optional.empty()));
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb) {
        return getDefaultPaymentMethodDetails(accountIdKb.toString());
    }

    @Override
    public ImmutableSet<PlanDetail> getAvailablePlans(Optional<String> accountId) {
        return ImmutableSet.of();
    }

    @Override
    public ListenableFuture<Void> recordUsage(UsageType type, String accountId, String projectId, String userId) {
        return Futures.immediateVoidFuture();
    }

    @Override
    public ListenableFuture<Void> recordUsage(UsageType type, String accountId, String projectId, UserStore.UserModel user) {
        return Futures.immediateVoidFuture();
    }

    @Override
    public void finalizeInvoice(String accountId, UUID invoiceId) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    @Override
    public void closeAccount(String accountId) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed");
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Billing.class).to(SelfHostBilling.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
