// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.util.concurrent.ListeningScheduledExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.util.Extern;
import com.stripe.exception.StripeException;
import com.stripe.model.Subscription;
import com.stripe.param.SubscriptionListParams;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Daily safety-net job that reconciles {@code account.status} against the live Stripe
 * {@code Subscription.status} for every Stripe-billed account. Catches drift caused by
 * missed webhooks.
 *
 * <p>Webhooks are the primary status push; live reads on the billing page are the secondary
 * check. This job is the third layer — runs once a day, lists active Stripe subscriptions,
 * and updates DynamoDB if it disagrees with Stripe.
 */
@Slf4j
@Singleton
public class StripeSyncService extends ManagedService {

    public interface Config {
        /**
         * Default false so a fresh KillBill-primary deploy makes zero Stripe API calls.
         * Operator flips to true alongside {@code BillingRouter.useStripeForNewSignups} or
         * just before migrating an existing paying customer. Without this, the daily
         * reconcile would list all Stripe subs every 24h (harmless but wasted calls when
         * no account has stripeCustomerId yet).
         */
        @DefaultValue("false")
        boolean enabled();

        @DefaultValue("PT24H")
        Duration runEvery();

        @DefaultValue("PT5M")
        Duration startupDelay();

        @DefaultValue("100")
        long pageSize();
    }

    @Inject
    private Config config;
    @Inject
    private AccountStore accountStore;
    @Inject
    private Billing billing;

    private ListeningScheduledExecutorService executor;

    @Override
    protected void serviceStart() {
        if (!config.enabled()) {
            log.info("StripeSyncService disabled");
            return;
        }
        executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadScheduledExecutor(
                new ThreadFactoryBuilder().setNameFormat("StripeSyncService-%d").build()));
        executor.scheduleAtFixedRate(this::reconcileSafely,
                config.startupDelay(), config.runEvery());
    }

    @Override
    protected void serviceStop() throws InterruptedException {
        if (executor != null) {
            executor.shutdownNow();
            executor.awaitTermination(30, TimeUnit.SECONDS);
        }
    }

    private void reconcileSafely() {
        try {
            reconcile();
        } catch (Exception ex) {
            log.warn("StripeSyncService run failed", ex);
        }
    }

    @Extern
    public synchronized String reconcile() throws StripeException {
        long checked = 0;
        long drift = 0;
        SubscriptionListParams params = SubscriptionListParams.builder()
                .setStatus(SubscriptionListParams.Status.ALL)
                .setLimit(config.pageSize())
                .build();
        for (Subscription sub : Subscription.list(params).autoPagingIterable()) {
            checked++;
            String customerId = sub.getCustomer();
            if (customerId == null) continue;
            Optional<AccountStore.Account> aOpt = accountStore.getAccountByStripeCustomerId(customerId);
            if (aOpt.isEmpty()) {
                log.debug("StripeSyncService: Stripe customer {} has no local account; skipping", customerId);
                continue;
            }
            AccountStore.Account a = aOpt.get();
            SubscriptionStatus before = a.getStatus();
            try {
                org.killbill.billing.client.model.gen.Account synthAccount = billing.getAccount(a.getAccountId());
                org.killbill.billing.client.model.gen.Subscription synthSub = billing.getSubscription(a.getAccountId());
                SubscriptionStatus after = billing.updateAndGetEntitlementStatus(before, synthAccount, synthSub,
                        "StripeSyncService reconcile");
                if (!after.equals(before)) drift++;
            } catch (Exception ex) {
                log.warn("StripeSyncService: reconcile failed for account {} (customer {})",
                        a.getAccountId(), customerId, ex);
            }
        }
        String msg = String.format("StripeSyncService: checked=%d drift=%d", checked, drift);
        log.info(msg);
        return msg;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeSyncService.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding()
                        .to(StripeSyncService.class).asEagerSingleton();
            }
        };
    }
}
