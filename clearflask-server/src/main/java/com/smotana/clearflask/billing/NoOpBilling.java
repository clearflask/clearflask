// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Names;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
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

/**
 * Billing implementation for accounts that have no external billing provider.
 *
 * <p>Used for grandfathered $0 plans (lifetime deals, pitchground tiers, starter-unlimited,
 * cloud-free, teammate-unlimited, etc.). These accounts exist only as records in DynamoDB
 * (planid + status); no Stripe Customer, no KillBill subscription is required.
 *
 * <p>If such an account upgrades to a paid plan, BillingRouter intercepts the changePlan call
 * BEFORE it reaches NoOpBilling and re-routes the operation through StripeBilling, which then
 * creates a Stripe Customer and Subscription. From that point on the account has
 * stripeCustomerId set and is routed to StripeBilling for all future operations.
 *
 * <p>This class is the analogue of SelfHostBilling but for cloud accounts that don't pay.
 */
@Slf4j
@Singleton
public class NoOpBilling implements Billing {

    /**
     * Plan IDs that are considered "no external billing" — accounts on any of these are routed
     * to NoOpBilling instead of KillBilling/StripeBilling. All of these are $0 plans driven by
     * external marketplaces, lifetime deals, or grandfathered tiers.
     */
    public static final ImmutableSet<String> NOOP_BILLED_PLAN_IDS = ImmutableSet.of(
            "starter-unlimited",
            "standard-unlimited",
            "standard2-unlimited",
            "cloud-free",
            "teammate-unlimited",
            "pro-lifetime",
            "lifetime-lifetime",
            "lifetime2-lifetime",
            "pitchground-a-lifetime",
            "pitchground-b-lifetime",
            "pitchground-c-lifetime",
            "pitchground-d-lifetime",
            "pitchground-e-lifetime",
            // Comped Business accounts on a $0 flat-yearly price override. Unlike the catalog
            // $0 plans above, flat-yearly was historically a paid plan billed via KillBill with
            // a per-customer price override (KB slug flat-yearly-1). The handful of $0 comps are
            // migrated to NoOp (see OneShotFlatYearlyMigrator, which also normalizes their local
            // planid flat-yearly-1 -> flat-yearly so this set membership check matches).
            "flat-yearly");

    private static final UUID NOOP_KB_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Inject
    private AccountStore accountStore;

    @Override
    public void createAccountWithSubscriptionAsync(AccountStore.Account accountInDyn) {
        // No external billing system to update.
    }

    @Override
    public Account getAccount(String accountId) {
        AccountStore.Account a = accountStore.getAccount(accountId, true)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));
        return synthAccount(a);
    }

    @Override
    public Account getAccountByKbId(UUID accountIdKb) {
        // NoOpBilling accounts have no real KB UUID. Callers passing a UUID are
        // legacy paths from the KillBill webhook era and can be answered with
        // a synthetic shell.
        return synthAccount(null);
    }

    @Override
    public Subscription getSubscription(String accountId) {
        AccountStore.Account a = accountStore.getAccount(accountId, true)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));
        return synthSubscription(a);
    }

    @Override
    public Optional<String> getEndOfTermChangeToPlanId(Subscription subscription) {
        return Optional.empty();
    }

    @Override
    public SubscriptionStatus getEntitlementStatus(Account account, Subscription subscription) {
        AccountStore.Account a = accountStore.getAccount(account.getExternalKey(), true)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));
        // Grandfathered customers are always considered active.
        return a.getStatus() == null ? SubscriptionStatus.ACTIVE : a.getStatus();
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
        throw new ApiException(Response.Status.BAD_REQUEST, "Your plan does not require a payment method");
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
        // For grandfathered accounts the only meaningful "cancel" is to delete the account.
        // We model cancel as a no-op that returns the synthetic subscription unchanged.
        return getSubscription(accountId);
    }

    @Override
    public Subscription resumeSubscription(String accountId) {
        return getSubscription(accountId);
    }

    @Override
    public Subscription changePlan(String accountId, String planId, Optional<Long> recurringPriceOpt) {
        // BillingRouter intercepts upgrades to paid (Stripe-billed) plans BEFORE this method
        // is reached. By the time we get here we know the target plan is also a NoOp plan
        // (e.g. switching between two grandfathered tiers, or accepting a coupon that grants
        // a different lifetime plan). Just update the local plan id.
        if (!NOOP_BILLED_PLAN_IDS.contains(planId)) {
            throw new ApiException(Response.Status.BAD_REQUEST,
                    "Cannot switch directly from a grandfathered plan to plan " + planId
                            + " via NoOpBilling. Routing should send this through StripeBilling.");
        }
        accountStore.setPlan(accountId, planId, Optional.empty());
        return getSubscription(accountId).setPlanName(planId);
    }

    @Override
    public Subscription changePlanToFlatYearly(String accountId, long yearlyPrice) {
        throw new ApiException(Response.Status.BAD_REQUEST, "Custom yearly pricing is not available on this plan");
    }

    @Override
    public boolean tryAutoUpgradePlan(AccountStore.Account accountInDyn, String requiredPlanId) {
        return false;
    }

    @Override
    public Optional<AccountStore.Account> tryAutoUpgradeAfterSelfhostLicenseAdded(AccountStore.Account accountInDyn) {
        return Optional.empty();
    }

    @Override
    public Invoices getInvoices(String accountId, Optional<String> cursorOpt) {
        return new Invoices(null, ImmutableList.of());
    }

    @Override
    public String getInvoiceHtml(UUID invoiceId, Optional<String> accountIdOpt) {
        throw new ApiException(Response.Status.NOT_FOUND, "No invoices on this plan");
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(String accountId) {
        return Optional.empty();
    }

    @Override
    public Optional<PaymentMethodDetails> getDefaultPaymentMethodDetails(UUID accountIdKb) {
        return Optional.empty();
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
        // No-op
    }

    @Override
    public void closeAccount(String accountId) {
        // No external billing artifacts to clean up; the AccountStore deletion handles the rest.
    }

    private Account synthAccount(AccountStore.Account a) {
        if (a == null) {
            return new Account(NOOP_KB_ID, "", 0, NOOP_KB_ID.toString(), "",
                    0, Currency.USD, null, false,
                    null, null, null, null, null,
                    null, null, null, null,
                    null, null, null, null, false,
                    BigDecimal.ZERO, BigDecimal.ZERO, ImmutableList.of());
        }
        return new Account(NOOP_KB_ID, a.getName(), a.getName() == null ? 0 : a.getName().length(),
                a.getAccountId(), a.getEmail(),
                0, Currency.USD, null, false,
                null, null, null, null, null,
                null, null, null, null,
                null, null, null, null, false,
                BigDecimal.ZERO, BigDecimal.ZERO, ImmutableList.of());
    }

    private Subscription synthSubscription(AccountStore.Account a) {
        return new Subscription(
                NOOP_KB_ID,
                NOOP_KB_ID,
                a.getAccountId(),
                NOOP_KB_ID,
                a.getAccountId(),
                LocalDate.parse("1970-01-01"),
                a.getPlanid(),
                ProductCategory.BASE,
                BillingPeriod.NO_BILLING_PERIOD,
                PhaseType.EVERGREEN,
                null,
                a.getPlanid(),
                Entitlement.EntitlementState.ACTIVE,
                Entitlement.EntitlementSourceType.NATIVE,
                null,
                LocalDate.parse("2070-01-01"),
                LocalDate.parse("1970-01-01"),
                null,
                0,
                ImmutableList.of(),
                null,
                ImmutableList.of(new PhasePrice(
                        a.getPlanid(),
                        a.getPlanid(),
                        PhaseType.EVERGREEN.name(),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        ImmutableList.of())),
                ImmutableList.of());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(NoOpBilling.class).asEagerSingleton();
                bind(Billing.class).annotatedWith(Names.named("noop")).to(NoOpBilling.class);
            }
        };
    }
}
