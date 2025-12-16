// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.RemoteLicenseStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.LocalDate;
import org.killbill.billing.catalog.api.BillingPeriod;
import org.killbill.billing.catalog.api.Currency;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.catalog.api.ProductCategory;
import org.killbill.billing.client.model.gen.*;
import org.killbill.billing.entitlement.api.Entitlement;

import javax.ws.rs.core.Response;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Slf4j
public class SelfHostBilling implements Billing {

    private static final UUID ACCOUNT_ID = UUID.fromString("250F25AE-327D-4DFD-B947-D5507073EAC9");

    public interface Config {
        @DefaultValue("John Doe")
        String accountName();

        @DefaultValue("johndoe@example.com")
        String accountEmail();

    }

    @Inject
    private Config config;
    @Inject
    private AccountStore accountStore;
    @Inject
    private RemoteLicenseStore remoteLicenseStore;

    @Override
    public void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn) {
        // No-op
    }

    @Override
    public Account getAccount(String accountId) {
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
        AccountStore.Account account = accountStore.getAccount(accountId, true).orElseThrow();
        return new Subscription(
                ACCOUNT_ID,
                ACCOUNT_ID,
                ACCOUNT_ID.toString(),
                ACCOUNT_ID,
                ACCOUNT_ID.toString(),
                LocalDate.parse("1970"),
                account.getPlanid(),
                ProductCategory.BASE,
                BillingPeriod.ANNUAL,
                PhaseType.EVERGREEN,
                null,
                account.getPlanid(), // Plan id is required for entitlement status in getEntitlementStatus
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
                        account.getPlanid(),
                        account.getPlanid(),
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
        return remoteLicenseStore.getSelfhostEntitlementStatus(subscription.getPlanName());
    }

    @Override
    public SubscriptionStatus updateAndGetEntitlementStatus(SubscriptionStatus currentStatus, Account account, Subscription subscription, String reason) {
        SubscriptionStatus newStatus = getEntitlementStatus(account, subscription);
        if (!newStatus.equals(currentStatus)) {
            log.info("Subscription status change {} -> {}, reason: {}, for {}",
                    currentStatus, newStatus, reason, account.getExternalKey());
            accountStore.updateStatus(account.getExternalKey(), newStatus);
        }
        return newStatus;
    }

    @Override
    public void updatePaymentToken(String accountId, Gateway type, String paymentToken) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Billing is not configured");
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
        throw new ApiException(Response.Status.BAD_REQUEST, "Billing is not configured");
    }

    @Override
    public Subscription resumeSubscription(String accountId) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Billing is not configured");
    }

    @Override
    public Subscription changePlan(String accountId, String planId, Optional<Long> recurringPriceOpt) {
        accountStore.setPlan(accountId, planId, Optional.empty());
        return getSubscription(accountId).setPlanName(planId);
    }

    @Override
    public Subscription changePlanToFlatYearly(String accountId, long yearlyPrice) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Billing is not configured");
    }

    @Override
    public boolean tryAutoUpgradePlan(AccountStore.Account account, String requiredPlanId) {
        if ("selfhost-licensed".equals(requiredPlanId)
                && remoteLicenseStore.validateLicenseRemotely(true).orElse(false)) {
            changePlan(account.getAccountId(), requiredPlanId, Optional.empty());
            return true;
        }
        return false;
    }

    @Override
    public Optional<AccountStore.Account> tryAutoUpgradeAfterSelfhostLicenseAdded(AccountStore.Account accountInDyn) {

        // Ensure right source plan
        switch (accountInDyn.getPlanid()) {
            case "self-host":
            case "selfhost-free":
                break;
            default:
                return Optional.empty();
        }

        // Ensure right entitlement
        switch (accountInDyn.getStatus()) {
            case ACTIVE:
            case ACTIVETRIAL:
                break;
            default:
                return Optional.empty();
        }

        // Perform upgrade
        String upgradeToPlan = "selfhost-licensed";
        try {
            changePlan(accountInDyn.getAccountId(), upgradeToPlan, Optional.empty());
        } catch (Throwable th) {
            log.error("Failed to auto upgrade accountId {} to plan {}",
                    accountInDyn.getAccountId(), upgradeToPlan, th);
            return Optional.empty();
        }

        return accountStore.getAccount(accountInDyn.getAccountId(), true);
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        return new Invoices(null, ImmutableList.of());
    }

    @Override
    public String getInvoiceHtml(UUID invoiceId, Optional<String> accountIdOpt) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Billing is not configured");
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
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
    public void creditAdjustment(String accountId, long amount, String description) {
        // No-op
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId) {
        // No-op
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, String userId) {
        // No-op
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, UserStore.UserModel user) {
        // No-op
    }

    @Override
    public void finalizeInvoice(String accountId, UUID invoiceId) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Billing is not configured");
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

    /**
     * Module that binds SelfHostBilling with a named annotation for use with BillingRouter.
     */
    public static Module moduleNamed() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Billing.class).annotatedWith(Names.named("selfhost")).to(SelfHostBilling.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
