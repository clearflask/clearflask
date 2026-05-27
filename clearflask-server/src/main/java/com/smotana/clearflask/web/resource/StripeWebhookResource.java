// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.billing.StripeBilling;
import com.smotana.clearflask.billing.StripeStatusMapper;
import com.smotana.clearflask.core.ClearFlaskCreditSync;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.WebhookEventDedupStore;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.Application;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/**
 * Stripe webhook receiver. Verifies signatures via {@link Webhook#constructEvent}.
 *
 * <p>Idempotent: dedup on {@code event.id} via 24h Caffeine cache.
 *
 * <p>Events handled:
 * <ul>
 *   <li>{@code checkout.session.completed} - finalize stripeCustomerId on local Account.
 *   <li>{@code customer.subscription.*} - sync local account.planid and account.status.
 *   <li>{@code customer.subscription.trial_will_end} - trigger trial-ending email.
 *   <li>{@code invoice.payment_succeeded} - emit success notification + credit sync.
 *   <li>{@code invoice.payment_failed} - emit payment-failed notification.
 *   <li>{@code entitlements.active_entitlement_summary.updated} - logged only;
 *       EntitlementChecker cache invalidation will happen here once that lands.
 * </ul>
 */
@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class StripeWebhookResource {

    public static final String WEBHOOK_PATH = "/webhook/stripe";

    @Inject
    private StripeBilling.Config stripeConfig;
    @Inject
    private StripeBilling stripeBilling;
    @Inject
    private AccountStore accountStore;
    @Inject
    private Billing billing;
    @Inject
    private PlanStore planStore;
    @Inject
    private NotificationService notificationService;
    @Inject
    private ClearFlaskCreditSync clearFlaskCreditSync;
    @Inject
    private WebhookEventDedupStore dedupStore;

    @POST
    @Path(WEBHOOK_PATH)
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    // No @Limit: Stripe's webhook delivery IP cannot solve CAPTCHA challenges, and event
    // bursts (dunning runs, mass plan migrations) routinely exceed any per-endpoint cap.
    // Authenticity is enforced by the HMAC signature check on every request below.
    public Response webhook(@Context HttpServletRequest req) throws IOException {
        String body = readBody(req);
        String signature = req.getHeader("Stripe-Signature");
        if (signature == null) {
            log.warn("Stripe webhook missing Stripe-Signature header");
            return Response.status(Response.Status.BAD_REQUEST).build();
        }
        Event event;
        try {
            event = Webhook.constructEvent(body, signature, stripeBilling.webhookSecret(),
                    stripeConfig.webhookToleranceSeconds());
        } catch (SignatureVerificationException ex) {
            if (LogUtil.rateLimitAllowLog("stripe-webhook-bad-signature")) {
                log.warn("Stripe webhook signature verification failed", ex);
            }
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }
        // Atomic claim BEFORE processing so retries from Stripe (or fan-out from a
        // load-balanced multi-instance deployment) never re-run the handler. The
        // trade-off is that a crash between claim and handler completion drops the
        // event; the daily StripeSyncService reconcile + per-page syncActions catch
        // any resulting status drift.
        if (!dedupStore.tryClaim(event.getId())) {
            log.debug("Stripe webhook: event {} already processed, skipping", event.getId());
            return Response.ok().build();
        }
        try {
            handle(event);
        } catch (Exception ex) {
            log.warn("Stripe webhook handler failed for event {} type {}",
                    event.getId(), event.getType(), ex);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
        }
        return Response.ok().build();
    }

    private void handle(Event event) {
        String type = event.getType();
        if (type == null) return;
        switch (type) {
            case "checkout.session.completed":
                onCheckoutSessionCompleted(event);
                return;
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
                onSubscriptionChanged(event);
                return;
            case "customer.subscription.trial_will_end":
                onTrialWillEnd(event);
                return;
            case "invoice.payment_succeeded":
                onInvoicePaymentSucceeded(event);
                return;
            case "invoice.payment_failed":
                onInvoicePaymentFailed(event);
                return;
            case "entitlements.active_entitlement_summary.updated":
                // EntitlementChecker cache invalidation will hook in here.
                log.debug("Stripe webhook: entitlements summary updated for event {}", event.getId());
                return;
            default:
                log.debug("Stripe webhook: ignoring event type {}", type);
        }
    }

    private void onCheckoutSessionCompleted(Event event) {
        Session session = (Session) deserialize(event).orElse(null);
        if (session == null) return;
        try {
            stripeBilling.finalizeCheckoutSession(session.getId());
        } catch (Exception ex) {
            log.warn("Stripe webhook: finalizeCheckoutSession failed for {}", session.getId(), ex);
        }
    }

    private void onSubscriptionChanged(Event event) {
        com.stripe.model.Subscription sub = (com.stripe.model.Subscription) deserialize(event).orElse(null);
        if (sub == null) return;
        AccountStore.Account account = lookupAccount(sub.getCustomer()).orElse(null);
        if (account == null) {
            log.warn("Stripe webhook: no local account for customer {} on event {}",
                    sub.getCustomer(), event.getType());
            return;
        }
        if (sub.getMetadata() != null) {
            String planFromMeta = sub.getMetadata().get(StripeBilling.META_CLEARFLASK_PLAN_ID);
            if (planFromMeta != null && !planFromMeta.equals(account.getPlanid())) {
                log.info("Stripe webhook: syncing planid {} -> {} for account {}",
                        account.getPlanid(), planFromMeta, account.getAccountId());
                accountStore.setPlan(account.getAccountId(), planFromMeta, Optional.empty());
            }
        }
        // The webhook means Stripe state just changed -- drop the per-account snapshot
        // cache so the upcoming getSubscription / updateAndGetEntitlementStatus calls
        // read fresh from Stripe rather than returning the 5s-stale snapshot.
        stripeBilling.invalidateSnapshot(account.getAccountId());
        SubscriptionStatus before = account.getStatus();
        org.killbill.billing.client.model.gen.Account synthAccount = billing.getAccount(account.getAccountId());
        // Try the live re-fetch first (always returns the current state, immune to
        // out-of-order webhook delivery). If it throws because no active sub remains --
        // the common case for customer.subscription.deleted on the last sub -- map the
        // event payload directly so we still flip local status to CANCELLED/BLOCKED.
        // Otherwise the local row would stay in its prior state until the next reconcile
        // or BillingPage load, and the metadata-aware mapper would lose the
        // META_OVERDUE_CANCELLED signal carried on the deleted sub.
        try {
            org.killbill.billing.client.model.gen.Subscription synthSub = billing.getSubscription(account.getAccountId());
            billing.updateAndGetEntitlementStatus(before, synthAccount, synthSub,
                    "Stripe webhook " + event.getType());
            return;
        } catch (Exception ex) {
            log.debug("Stripe webhook: getSubscription failed for {} -- falling back to event payload: {}",
                    account.getAccountId(), ex.getMessage());
        }
        boolean hasPm = billing.getDefaultPaymentMethodDetails(account.getAccountId()).isPresent();
        SubscriptionStatus mapped = StripeStatusMapper.map(sub, hasPm, () -> false);
        if (!mapped.equals(before)) {
            log.info("Stripe webhook ({}): status {} -> {} for account {} via event payload",
                    event.getType(), before, mapped, account.getAccountId());
            accountStore.updateStatus(account.getAccountId(), mapped);
        }
    }

    private void onTrialWillEnd(Event event) {
        com.stripe.model.Subscription sub = (com.stripe.model.Subscription) deserialize(event).orElse(null);
        if (sub == null || sub.getTrialEnd() == null) return;
        AccountStore.Account account = lookupAccount(sub.getCustomer()).orElse(null);
        if (account == null) return;
        notificationService.onTrialEnding(account, java.time.Instant.ofEpochSecond(sub.getTrialEnd()));
    }

    private void onInvoicePaymentSucceeded(Event event) {
        com.stripe.model.Invoice invoice = (com.stripe.model.Invoice) deserialize(event).orElse(null);
        if (invoice == null) return;
        AccountStore.Account account = lookupAccount(invoice.getCustomer()).orElse(null);
        if (account == null) return;

        Optional<Billing.PaymentMethodDetails> pmOpt = billing.getDefaultPaymentMethodDetails(account.getAccountId());
        boolean isCardExpiringSoon = pmOpt
                .map(pm -> isCardExpiringSoon(pm.getCardExpiryYear(), pm.getCardExpiryMonth(), 30))
                .orElse(false);
        notificationService.onInvoicePaymentSuccess(
                account.getAccountId(),
                account.getEmail(),
                invoice.getId(),
                isCardExpiringSoon);

        String planName = invoice.getMetadata() == null
                ? null
                : invoice.getMetadata().get(StripeBilling.META_CLEARFLASK_PLAN_ID);
        if (planName == null) planName = account.getPlanid();
        String summary = "Credit for " + planStore.prettifyPlanName(planName) + " plan";
        try {
            double amount = invoice.getAmountPaid() == null ? 0d : invoice.getAmountPaid() / 100.0;
            clearFlaskCreditSync.process(invoice.getId(), account, amount, summary);
        } catch (Exception ex) {
            log.warn("Stripe webhook: clearFlaskCreditSync failed for invoice {}", invoice.getId(), ex);
        }
    }

    private void onInvoicePaymentFailed(Event event) {
        com.stripe.model.Invoice invoice = (com.stripe.model.Invoice) deserialize(event).orElse(null);
        if (invoice == null) return;
        AccountStore.Account account = lookupAccount(invoice.getCustomer()).orElse(null);
        if (account == null) return;
        long amount = invoice.getAmountDue() == null ? 0L : invoice.getAmountDue() / 100L;
        boolean hasPaymentMethod = billing.getDefaultPaymentMethodDetails(account.getAccountId()).isPresent();
        boolean requiresAction = "requires_action".equals(invoice.getStatus());
        notificationService.onPaymentFailed(
                account.getAccountId(),
                account.getEmail(),
                amount,
                requiresAction,
                hasPaymentMethod);
    }

    private Optional<StripeObject> deserialize(Event event) {
        EventDataObjectDeserializer d = event.getDataObjectDeserializer();
        if (d == null) return Optional.empty();
        return d.getObject();
    }

    private Optional<AccountStore.Account> lookupAccount(String stripeCustomerId) {
        if (Strings.isNullOrEmpty(stripeCustomerId)) return Optional.empty();
        return accountStore.getAccountByStripeCustomerId(stripeCustomerId);
    }

    private static boolean isCardExpiringSoon(Optional<Long> yearOpt, Optional<Long> monthOpt, int withinDays) {
        if (yearOpt.isEmpty() || monthOpt.isEmpty()) return false;
        java.time.YearMonth expiry = java.time.YearMonth.of(yearOpt.get().intValue(), monthOpt.get().intValue());
        return expiry.atEndOfMonth().isBefore(java.time.LocalDate.now().plusDays(withinDays));
    }

    private static String readBody(HttpServletRequest req) throws IOException {
        // Read the raw bytes of the request body. We MUST NOT use req.getReader() +
        // readLine() here -- it strips line terminators, and Stripe's HMAC is computed
        // over the exact bytes of the payload. Stripe sends compact single-line JSON;
        // appending a synthetic '\n' would corrupt the signed payload, and
        // Webhook.constructEvent would reject every event with SignatureVerificationException.
        try (InputStream in = req.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeWebhookResource.class);
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(StripeWebhookResource.class);
            }
        };
    }
}
