// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.util.Extern;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.CustomerCollection;
import com.stripe.model.Subscription;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerListParams;
import com.stripe.param.CustomerUpdateParams;
import com.stripe.param.SubscriptionCreateParams;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

/**
 * One-time migration tool for cutting a single existing KillBill-billed customer over to
 * direct Stripe billing.
 *
 * <p>Steps (idempotent — safe to re-run):
 * <ol>
 *   <li>If {@code account.stripeCustomerId} is already set, log + return.
 *   <li>Find an existing Stripe Customer with metadata {@code clearflask_account_id=accountId}
 *       OR (fallback) by email match. Otherwise create a new one.
 *   <li>Detect the customer's existing default payment method (KillBill's Stripe plugin has
 *       likely already attached one). Set as default if not already.
 *   <li>Read the live KB subscription's {@code chargedThroughDate} via the injected
 *       KillBilling backend; use it as the Stripe subscription's {@code billing_cycle_anchor}
 *       so the customer is not double-charged for the current period.
 *   <li>Create the Stripe subscription with {@code proration_behavior=none} and the price
 *       matching the local {@code account.planid}. Tag the subscription with metadata
 *       {@code clearflask_migrated_from_killbill=true}.
 *   <li>Persist {@code account.stripeCustomerId} on the local Account.
 *   <li>Cancel the KillBill subscription end-of-term (no charge).
 * </ol>
 *
 * <p>Use {@code dryRun=true} first to print the planned actions without mutating Stripe or
 * KillBill, then run with {@code dryRun=false}.
 */
@Slf4j
@Singleton
public class OneShotStripeMigrator {

    @Inject
    private AccountStore accountStore;
    @Inject
    private KillBilling killBilling;
    @Inject
    private StripeBilling stripeBilling;

    @Extern
    public String migrate(String accountId, boolean dryRun) throws StripeException {
        StringBuilder report = new StringBuilder("OneShotStripeMigrator: accountId=").append(accountId)
                .append(" dryRun=").append(dryRun).append("\n");

        AccountStore.Account a = accountStore.getAccount(accountId, false)
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + accountId));
        report.append("  local account: planid=").append(a.getPlanid())
                .append(" status=").append(a.getStatus())
                .append(" stripeCustomerId=").append(a.getStripeCustomerId()).append("\n");

        if (!Strings.isNullOrEmpty(a.getStripeCustomerId())) {
            report.append("  already migrated; nothing to do.\n");
            return report.toString();
        }

        // 2. Find or create Stripe Customer
        Customer customer = findOrCreateCustomer(a, dryRun, report);

        // 3. Default payment method
        String defaultPmId = customer.getInvoiceSettings() == null
                ? null : customer.getInvoiceSettings().getDefaultPaymentMethod();
        if (Strings.isNullOrEmpty(defaultPmId)) {
            // Look for any payment method on this Customer.
            com.stripe.model.PaymentMethodCollection pms = com.stripe.model.PaymentMethod.list(
                    com.stripe.param.PaymentMethodListParams.builder()
                            .setCustomer(customer.getId())
                            .setType(com.stripe.param.PaymentMethodListParams.Type.CARD)
                            .build());
            if (!pms.getData().isEmpty()) {
                defaultPmId = pms.getData().get(0).getId();
                report.append("  found existing payment method: ").append(defaultPmId).append("\n");
                if (!dryRun) {
                    customer.update(CustomerUpdateParams.builder()
                            .setInvoiceSettings(CustomerUpdateParams.InvoiceSettings.builder()
                                    .setDefaultPaymentMethod(defaultPmId)
                                    .build())
                            .build());
                }
            } else {
                report.append("  WARNING: no payment method on Stripe customer; subscription will be created in 'incomplete' state and the customer will need to add a card.\n");
            }
        } else {
            report.append("  default payment method: ").append(defaultPmId).append("\n");
        }

        // 4. Compute trial_end from KB chargedThroughDate. Using trial_end (not
        // billing_cycle_anchor) because the customer has effectively pre-paid through
        // chargedThroughDate via KillBill, so we must DEFER the first Stripe charge
        // until that date. billing_cycle_anchor in Stripe can only move the cycle
        // earlier than the natural billing date and is rejected when later; trial_end
        // is the documented migration pattern for "don't charge until X".
        //
        // Side effect: Stripe sub.status will be "trialing" until trial_end. The mapper
        // recognizes the META_MIGRATED_FROM_KILLBILL marker and surfaces this as ACTIVE
        // (not ACTIVETRIAL) so the UI doesn't claim the paying customer is in a trial.
        Long trialEndEpoch = null;
        try {
            org.killbill.billing.client.model.gen.Subscription kbSub = killBilling.getSubscription(accountId);
            if (kbSub != null && kbSub.getChargedThroughDate() != null) {
                trialEndEpoch = kbSub.getChargedThroughDate().toDateTimeAtStartOfDay().getMillis() / 1000;
                report.append("  KB chargedThroughDate=").append(kbSub.getChargedThroughDate())
                        .append(" -> Stripe trial_end epoch=").append(trialEndEpoch).append("\n");
            }
        } catch (Exception ex) {
            report.append("  WARNING: could not read KB subscription (").append(ex.getMessage())
                    .append("); proceeding without trial_end (Stripe will charge immediately).\n");
        }

        // 5. Create Stripe subscription
        String priceId = stripeBilling.resolvePriceId(a.getPlanid())
                .orElseThrow(() -> new IllegalStateException(
                        "Plan " + a.getPlanid() + " is not configured in Stripe; run StripeProvisioner.upsertAll first"));
        report.append("  resolved Stripe price: ").append(priceId).append("\n");

        SubscriptionCreateParams.Builder subParams = SubscriptionCreateParams.builder()
                .setCustomer(customer.getId())
                .addItem(SubscriptionCreateParams.Item.builder().setPrice(priceId).build())
                .setProrationBehavior(SubscriptionCreateParams.ProrationBehavior.NONE)
                .putMetadata(StripeBilling.META_CLEARFLASK_ACCOUNT_ID, accountId)
                .putMetadata(StripeBilling.META_CLEARFLASK_PLAN_ID, a.getPlanid())
                .putMetadata(StripeBilling.META_MIGRATED_FROM_KILLBILL, "true");
        if (trialEndEpoch != null) {
            subParams.setTrialEnd(trialEndEpoch);
            // Don't surface a "trial ended" email at the actual end of this synthetic trial;
            // this is a migration handoff, not a real trial.
            subParams.setTrialSettings(SubscriptionCreateParams.TrialSettings.builder()
                    .setEndBehavior(SubscriptionCreateParams.TrialSettings.EndBehavior.builder()
                            .setMissingPaymentMethod(SubscriptionCreateParams.TrialSettings.EndBehavior.MissingPaymentMethod.CANCEL)
                            .build())
                    .build());
        }

        if (dryRun) {
            report.append("  DRY RUN: would create Stripe subscription with the above params and set account.stripeCustomerId=")
                    .append(customer.getId()).append("\n");
            return report.toString();
        }

        Subscription sub = Subscription.create(subParams.build());
        report.append("  CREATED Stripe subscription: ").append(sub.getId())
                .append(" status=").append(sub.getStatus()).append("\n");

        // 6. Set stripeCustomerId — router now sends all calls for this account to Stripe
        accountStore.setStripeCustomerId(accountId, Optional.of(customer.getId()));
        report.append("  set account.stripeCustomerId=").append(customer.getId()).append("\n");

        // 7. Cancel KillBill subscription end-of-term
        try {
            killBilling.cancelSubscription(accountId);
            report.append("  cancelled KB subscription (end-of-term)\n");
        } catch (Exception ex) {
            report.append("  WARNING: failed to cancel KB subscription: ").append(ex.getMessage())
                    .append(" -- cancel manually via KB admin.\n");
        }
        report.append("OK\n");
        log.info(report.toString());
        return report.toString();
    }

    private Customer findOrCreateCustomer(AccountStore.Account a, boolean dryRun, StringBuilder report) throws StripeException {
        // Search by email.
        CustomerListParams listParams = CustomerListParams.builder()
                .setEmail(a.getEmail())
                .setLimit(10L)
                .build();
        CustomerCollection list = Customer.list(listParams);
        if (list.getData() != null) {
            for (Customer c : list.getData()) {
                report.append("  found Stripe customer by email: ").append(c.getId()).append("\n");
                if (!dryRun && (c.getMetadata() == null
                        || !a.getAccountId().equals(c.getMetadata().get(StripeBilling.META_CLEARFLASK_ACCOUNT_ID)))) {
                    c.update(CustomerUpdateParams.builder()
                            .putMetadata(StripeBilling.META_CLEARFLASK_ACCOUNT_ID, a.getAccountId())
                            .build());
                    report.append("  updated metadata.clearflask_account_id\n");
                }
                return c;
            }
        }
        if (dryRun) {
            report.append("  DRY RUN: would create new Stripe customer for ").append(a.getEmail()).append("\n");
            // Return a synthetic placeholder for the rest of the dry-run report
            Customer placeholder = new Customer();
            placeholder.setId("cus_DRYRUN_PLACEHOLDER");
            placeholder.setEmail(a.getEmail());
            return placeholder;
        }
        Customer created = Customer.create(CustomerCreateParams.builder()
                .setEmail(a.getEmail())
                .setName(a.getName())
                .putMetadata(StripeBilling.META_CLEARFLASK_ACCOUNT_ID, a.getAccountId())
                .putMetadata(StripeBilling.META_MIGRATED_FROM_KILLBILL, "true")
                .build());
        report.append("  CREATED new Stripe customer: ").append(created.getId()).append("\n");
        return created;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OneShotStripeMigrator.class).asEagerSingleton();
            }
        };
    }
}
