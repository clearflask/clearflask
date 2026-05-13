# Stripe Full-Hosted Billing — Plan

## Context

Replace KillBill with Stripe-direct billing, leaning maximally on Stripe's hosted UIs to minimize code we own. Earlier branch (`stripe-migration`, parked at commit `cd9265db`) explored a hybrid inline-Elements approach; this plan goes further and uses Stripe Checkout for signup, Customer Portal for management, hosted invoices/receipts, Entitlements for feature flags, Meters for usage billing, and seat-based subscription items for teammate counts.

User goals:
- Single config flip switches modes; rollback feasible at the new-signup boundary.
- Grandfathered $0 customers (lifetime, pitchground, starter-unlimited, cloud-free, teammate-unlimited) keep working with no Stripe footprint.
- Migrate the one paying customer with no double-billing.
- Keep the existing BillingPage UI inline; deep-link to Stripe-hosted pages for actions that benefit from them (update card, cancel, view invoice).
- Track entitlements (per-feature gating). Seat-billing and usage-billing are confirmed feasible on Stripe but **out of scope for this implementation**; current paid plans are flat-fee.

## Answers to the user's questions

**Track which features users can use?** Yes — **Stripe Entitlements**. You define Features (`private_projects`, `whitelabel`, `api_access`, etc.) in Stripe, attach them to Products. Customers' active subscriptions yield a set of entitled features queryable via `entitlements.activeFeatures(customer)`. Backend caches and gates premium actions against it. Replaces the static plan-id → feature mapping currently in `CommonPlanVerifyStore` / `KillBillPlanStore`.

**Bill by number of admin accounts (seats)?** Yes — **subscription-item `quantity`** is Stripe's first-class seat model. Stripe bills `unit_amount × quantity` per period and pro-rates within-period changes. *Out of scope for this migration; current paid plans are flat-fee.* Captured here so we know the Stripe path if we add seat billing later.

**Bill by active customer usage (tracked users)?** Yes — **Stripe Meters + Meter Events**. Define a meter (`tracked_users`), attach a tiered Price referencing the meter, post `MeterEvent` from app code. *Out of scope for this migration; the one paying customer isn't on a metered plan and the metered KillBill plans (`growth2-monthly`, `standard2-monthly`) are grandfathered with no active customers.* Captured here for future use.

**How do we know when a customer isn't paying?** Three layers:
- **Webhooks (push)** — `invoice.payment_failed`, `customer.subscription.updated` (status transitions to `past_due` / `unpaid` / `canceled`). Our webhook handler updates `account.status` in DynamoDB.
- **Live reads (pull)** — every `GET /admin/account/billing` call retrieves fresh `Subscription.status` from Stripe, so the user-visible status reflects current truth even if a webhook was missed.
- **Auto-dunning** — Stripe's Smart Retries automatically retry the card on a configurable schedule (default 4 retries over ~3 weeks), send dunning emails, and transition the subscription to `unpaid` or `canceled` per your dashboard setting. Replaces KillBill's `overdue.xml` configuration. **Configured once in the Stripe dashboard** under Subscriptions and emails → Manage failed payments.
- **Daily reconcile (safety net)** — a scheduled job that lists active Stripe subscriptions and reconciles `account.status` against `Subscription.status`. Cheap insurance for missed webhooks. Mirrors the role of `KillBillSync.java` today.

**Cost?** All hosted features (Checkout, Portal, hosted invoices, Entitlements, Meters) are included in Stripe Billing's existing 0.5% subscription fee. Stripe Tax is the only opt-in paid extra (0.5%) and we leave it off.

## What "full hosted" means here

**Hosted by Stripe (we deep-link to from the existing inline UI):**
- **Checkout** — signup payment collection. After our account-creation step, the user is redirected to a Stripe Checkout Session URL, enters card on Stripe's domain, returns to our success URL. (One redirect during signup only.)
- **Customer Portal** — for post-signup actions that benefit from Stripe's polished UI: update payment method, cancel/resume subscription, switch plans. Linked from buttons on our existing BillingPage. Uses Portal's `flow_data` to deep-link straight to the relevant action when possible.
- **Hosted invoice page** — `invoice.hosted_invoice_url` linked from each invoice row in our existing inline invoice list, plus `invoice.invoice_pdf` for direct PDF download.
- **Email receipts** — Stripe sends them automatically per charge.

**Stays inline in our app:**
- Plan picker on the pricing/signup page (we read plan list from Stripe but render our own marketing layout).
- **BillingPage simplified.** A single primary "Manage billing" button → Customer Portal session handles the bulk: payment-method updates, plan switching, cancel/resume, viewing/downloading invoices and receipts. Inline UI keeps only what makes sense to keep:
  - **Plan summary** — plan title, description, status (`ACTIVE` / `ACTIVETRIAL` / `ACTIVENORENEWAL` / etc.). Sourced from local `account.planid` + `account.status` (free, no Stripe round-trip per page load).
  - **Usage counters** — tracked users, post count, teammate count. These are app-dashboard metrics, not billing controls; they stay where they are.
  - **End-of-term change indicator** — if a plan switch is scheduled for next billing cycle, show it (sourced from `account` and webhook-synced).
  - **Sponsor-monthly slider** ($1–200/mo) and **flat-yearly admin amount entry** — Stripe Portal can't host these, so they remain inline. They create one-off Stripe Prices and route through a Checkout Session (new sub) or `Subscription.update` (existing sub).
  - **Credit adjustment** (super-admin only) — keeps the operational lever; updates `Customer.balance`.
  - **License key entry** (self-host only) — unchanged, unrelated to Stripe.
  - **Coupon redeem** — kept inline since clearflask-internal coupons (`CouponStore`) drive grandfathered/lifetime plans, not Stripe coupons. After redeem, BillingRouter routes per the new `planid`.
- **Removed** from inline UI (delegated to Portal): payment-method add/update dialog, cancel/resume dialogs, invoices table, addon change dialog, "add extra teammate" dialog if seat-billing isn't implemented.

**Stays in our backend:**
- DynamoDB account records (planid, status, addons) — kept in sync from Stripe webhooks + live reads on the billing page.
- Entitlement queries in middleware — backend calls Stripe Entitlements (cached) to gate premium features.
- Daily reconcile job — safety-net pull of all Stripe subscriptions, reconciles local `account.status` against `Subscription.status`. Cheap to run, catches missed webhooks.

## Architecture

```
                                     ┌─────────────────────────┐
  signup wizard ─[create account]──▶│  AccountResource         │
                                     │   create local Account   │
                                     └────────────┬────────────┘
                                                  │
                                     ┌────────────▼────────────┐
                                     │  BillingRouter           │  routes per-account
                                     │  pick(account)           │  by env+stripeCustomerId+planid
                                     └─┬─────────┬─────────┬──┘
                                       │         │         │
                          ┌────────────▼─┐ ┌─────▼────┐ ┌──▼───────┐
                          │ KillBilling  │ │ Stripe   │ │ NoOp     │
                          │ (existing,   │ │ Billing  │ │ Billing  │
                          │  rollback    │ │ +Hosted  │ │ ($0 plans)│
                          │  fallback)   │ │ flows    │ │           │
                          └──────────────┘ └──┬───────┘ └───────────┘
                                              │
                          ┌───────────────────┼─────────────────────┐
                          ▼                   ▼                     ▼
                   Checkout Session    Portal Session         Stripe API
                   (signup)            (management)           (subscriptions,
                                                               meters, entitlements)

                            Stripe ──(webhooks)──▶ StripeWebhookResource
                                                    sync planid/status/seats
```

**Routing rules (`BillingRouter.pick`):**
1. `env == PRODUCTION_SELF_HOST` → `SelfHostBilling` (unchanged)
2. `account.planid` ∈ NoOp set → `NoOpBilling` (grandfathered $0 plans)
3. `account.stripeCustomerId != null` → `StripeBilling`
4. `useStripeForNewSignups=true` AND new signup AND not in NoOp set → `StripeBilling`
5. Otherwise → `KillBilling`

**Entitlement model:**
- Each Stripe Product has Features attached (`stripe.entitlements.feature.create`).
- Backend's `PlanVerifyStore.verifyAction` is rewritten to check Stripe-entitlements via cached lookup, OR fall back to the static `KillBillPlanStore` constants if the account is not Stripe-billed (KillBill / NoOp paths).
- Cache: 5-minute TTL on `(customerId → activeFeatures set)`. Webhook events bust the cache.

**Status reconciliation:**
- Webhooks push status changes immediately (`customer.subscription.updated`, `invoice.payment_failed`).
- Live reads on the billing page always pull fresh from Stripe.
- Daily reconcile job (`StripeSyncService.reconcile()`) lists active Stripe subscriptions and reconciles drift in `account.status` — emits warning logs and corrects the local store.

**Seat-billing and usage-billing:** *out of scope for this implementation; current plans are flat-fee.* If we ever add them: subscription-item `quantity` for seats, Stripe Meters for usage. `Billing.recordUsage` becomes a no-op for Stripe-billed accounts in this implementation.

## Plans-as-code: Stripe provisioner

A new `StripeProvisioner` (Java, idempotent, super-admin invokable via `@Extern`) creates and reconciles:

- **Products** — one per non-grandfathered clearflask plan id (cloud-starter-monthly, cloud-monthly2, cloud-yearly, selfhost-monthly2, selfhost-yearly2, flat-yearly, sponsor-monthly). `metadata.clearflask_plan_id = <existing id>`. Optional `marketing_features` (a Stripe-native list of bullet points shown in Checkout/Portal).
- **Prices** — one fixed Price per Product at the catalog021 amount; `metadata.clearflask_plan_id` matching. For sponsor-monthly and flat-yearly, no default fixed Price; one-off Prices are created per-customer at upgrade time.
- **Features** — `private_projects`, `whitelabel`, `api_access`, `extra_project`, `custom_domain`, `unlimited_teammates`. Attached to the Products that grant them per the current `CommonPlanVerifyStore` mapping.
- **Customer Portal configuration** — sets `business_profile`, allowed actions (cancel, switch payment method, view invoices, update billing details), the Products available for plan switching.
- **Webhook endpoint** — registers `https://<domain>/api/v1/webhook/stripe` with the events listed below; persists the returned signing secret to a new `service_secret` DynamoDB table so subsequent restarts re-use it without recreating.

Run `StripeProvisioner.upsertAll()` once per environment (test mode for staging/dev, live mode for prod). Re-run is safe.

## Webhook events handled

`customer.subscription.created/updated/deleted` — sync `account.planid` and `account.status` from Stripe metadata.
`customer.subscription.trial_will_end` — fires `notificationService.onTrialEnding`.
`invoice.payment_succeeded` — fires `clearFlaskCreditSync.process` for affiliate credit.
`invoice.payment_failed` — fires `notificationService.onPaymentFailed`.
`entitlements.active_entitlement_summary.updated` — busts the entitlement cache for that customer.
`payment_intent.requires_action` / `payment_intent.payment_failed` — log only; the customer goes through Portal to resolve.

Idempotency: 24h Caffeine cache keyed on `event.id`.

## Migration approach

**Three account categories:**

1. **Grandfathered $0 (lifetime, pitchground, free, teammate-unlimited)** — never touch Stripe. Routes to `NoOpBilling`. KillBill subscription cancellation is a no-op since they pay nothing; can be left dangling or bulk-cancelled at KillBill removal.

2. **The one paying customer** — `OneShotStripeMigrator.migrate(accountId, dryRun)`. Steps:
   - Find or create Stripe Customer (matched by email; KillBill's Stripe plugin already created one).
   - Find existing Stripe payment method on that Customer; set as default.
   - Compute `billing_cycle_anchor = kbSubscription.chargedThroughDate`.
   - Create Stripe Subscription with the matching Price ID, anchor as above, `proration_behavior=none`.
   - Set `account.stripeCustomerId`. Router now sends them to Stripe.
   - Cancel KillBill subscription `END_OF_TERM`, tag `migrated_to_stripe=true`.
   - Wait one renewal cycle to confirm Stripe charges and KB doesn't.

3. **New signups (post-flip)** — when `useStripeForNewSignups=true`, signup flow ends with a Stripe Checkout Session redirect; on success, return URL hits a callback endpoint that finalizes the local account record using the resulting `customer` and `subscription` IDs.

**Cutover sequence:**
1. Build all the code; everything dormant (`useStripeForNewSignups=false`).
2. Run `StripeProvisioner.upsertAll()` in **test mode**, manually exercise signup → cancel → resume → plan-switch → pay-failure with Stripe test cards.
3. Run `StripeProvisioner.upsertAll()` in **live mode**.
4. Migrate yourself (a test live account if you have one); verify webhook events and renewal.
5. Run `OneShotStripeMigrator.migrate(payingCustomerId, dryRun=true)`. Eyeball the log.
6. Run `migrate(payingCustomerId, dryRun=false)`. Verify Stripe dashboard and KillBill dashboard agree.
7. Flip `useStripeForNewSignups=true` and `routeGrandfatheredToNoOp=true` in prod.
8. Wait one renewal cycle. If happy, proceed to KillBill removal (separate commit).

**Rollback at each step:**
- Steps 1–4 are reversible (test mode only).
- Step 5–6: if dry-run reveals a problem, abort. If real run reveals a problem, the customer has both subs cancelled (KB end-of-term) and active (Stripe). Manually `Subscription.cancel` the Stripe sub, undo `account.stripeCustomerId=null`, manually re-activate the KB sub via KillBill admin console.
- Step 7: flip the flag back. New signups go to KB again. Anyone who signed up while the flag was true keeps their Stripe sub (no automatic reverse migration).

## Implementation work breakdown

Each item is a coherent, separately-committable change.

1. **AccountStore** — add `stripeCustomerId` field + GSI #3 + setter (same as parked branch).
2. **BillingRouter + NoOpBilling** — port from parked branch with minor refinements.
3. **StripePlanStore** — implements `PlanStore` via Stripe API (Products + Prices + metadata). Falls back to `KillBillPlanStore` constants when Stripe metadata is missing/incomplete (don't crash on misconfig).
4. **PlanStoreRouter** — analogous to BillingRouter; routes `PlanStore` calls per-account.
5. **StripeBilling** — full implementation including:
   - `createAccountWithSubscription` via Checkout Session + return URL handler
   - `getEntitlementStatus` via Stripe subscription state mapper
   - Sponsor / flat-yearly via one-off Price creation
   - `getInvoices` returns invoice metadata + `hosted_invoice_url` + `invoice_pdf` links
   - `getInvoiceHtml` returns a redirect to `hosted_invoice_url`
   - `recordUsage` no-op (out of scope; can be added later for metered plans)
6. **StripeWebhookResource** — handles event types listed above with idempotent dedup.
7. **StripeProvisioner** — `@Extern upsertAll()` — Products, Prices, Features, Portal config, webhook endpoint. Idempotent.
8. **ServiceSecretStore** — new tiny DynamoDB table for persisting the auto-registered webhook signing secret across restarts.
9. **EntitlementChecker** — refactor `CommonPlanVerifyStore` so its feature checks consult Stripe Entitlements when the account is Stripe-billed, with fallback to existing static map for KillBill/NoOp accounts. 5-minute cache, busted by webhooks.
10. **Checkout Session signup flow** — backend:
    - `POST /admin/account/signup` returns `{checkoutSessionUrl}` instead of completing signup synchronously when on Stripe path.
    - New `GET /admin/account/billing/checkout-complete?session_id=...` callback verifies the session, sets `account.stripeCustomerId`, finishes account setup.
    - Frontend `AccountEnterPage.tsx` redirects to `checkoutSessionUrl`.
11. **Customer Portal session endpoint** — backend:
    - `GET /account/billing/portal-session` returns `{url}` from `billingPortal.Session.create({customer, return_url})`. Single endpoint; the Portal UI itself handles all sub-flows (cards, cancel, invoices, plan switch).
    - Frontend `BillingPage.tsx` simplified to:
      - Keep inline: plan title/desc, status, usage counters, end-of-term-change display, sponsor slider (admin), flat-yearly entry (admin), credit adjustment (super-admin), coupon redeem, self-host license entry.
      - Remove inline: payment-method dialog, cancel/resume dialogs, invoice list, addons-change dialog.
      - Add: prominent **"Manage billing"** button → fetches portal-session URL, redirects.
12. **Sponsor + flat-yearly inline path** — admin/user picks amount → backend creates one-off Price + Checkout Session for new subs, or `Subscription.update` for existing.
13. **StripeSyncService** — daily reconciliation job. Lists active Stripe subscriptions, compares each `Subscription.status` to local `account.status`, logs warnings on drift, updates local store. Mirrors the role of `KillBillSync` in shape, simpler in content.
14. **OneShotStripeMigrator** — `@Extern migrate(accountId, dryRun)`. Idempotent.
15. **ServiceInjector wiring** — install all of the above for cloud env; PRODUCTION_SELF_HOST stays untouched.
16. **Tests** — unit tests for routing decisions, status mapping, entitlement-cache logic. No live Stripe integration tests; manual test-mode runs cover the rest.
17. **Docs / runbook** — `plans/stripe-full-hosted-runbook.md` covering: provisioner steps for test+live, dashboard config (smart-retry schedule, receipt emails), rollback procedure, post-cutover KillBill teardown checklist.
18. **(After cutover, separate change)** — delete `KillBilling.java`, `KillBillResource.java`, `KillBillSync.java`, `KillBillClientProvider.java`, `KillBillUtil.java`, `clearflask-server/src/main/resources/killbill/`, KillBill docker services and Maven plugin deps. Keep `killbill-client-java` jar (DTO types still referenced by the `Billing` interface; refactor that out is a follow-up).

## Tradeoffs the user should know

1. **Off-domain signup.** Checkout redirects to `checkout.stripe.com`. Standard SaaS pattern but a UX shift from today.
2. **Off-domain billing management.** Portal session redirects to `billing.stripe.com`. Inline display of plan + status remains; everything actionable goes through Portal.
3. **Plan-switching is restricted in Portal.** Only Products you whitelist appear there. Sponsor and flat-yearly stay inline-admin-only.
4. **Checkout success-path risk.** If the user closes the tab between paying and hitting our return URL, we rely on the webhook to finalize the account. Code must handle "account exists but Checkout-completed-handler hasn't run yet" — webhook does it instead.
5. **Stripe Entitlements cache invalidation.** Mostly fine via webhooks, but if a webhook is dropped you can serve stale entitlements for up to 5 min. Cache TTL tunable.
6. **Custom-price plans add complexity.** One-off Prices accumulate in Stripe (one per accountId per change). Tag them with `metadata.clearflask_one_off_for_account` for cleanup.
7. **Rollback Stripe→KillBill is not symmetric.** Cheap rollback (flip new-signup flag) leaves Stripe-routed accounts on Stripe. Full revert requires a reverse migrator we're not building.
8. **`Billing` interface still uses KillBill DTO types** during the migration to avoid cross-cutting refactors. Post-cutover follow-up to remove those.

## Critical files to touch

**To be added:**
- `clearflask-server/.../billing/StripeBilling.java`
- `clearflask-server/.../billing/StripePlanStore.java`
- `clearflask-server/.../billing/PlanStoreRouter.java`
- `clearflask-server/.../billing/BillingRouter.java`
- `clearflask-server/.../billing/NoOpBilling.java`
- `clearflask-server/.../billing/StripeProvisioner.java`
- `clearflask-server/.../billing/StripeStatusMapper.java`
- `clearflask-server/.../billing/StripeSyncService.java` (daily reconcile)
- `clearflask-server/.../billing/EntitlementChecker.java` (or refactor existing PlanVerifyStore)
- `clearflask-server/.../billing/OneShotStripeMigrator.java`
- `clearflask-server/.../store/ServiceSecretStore.java` (DynamoDB-backed)
- `clearflask-server/.../web/resource/StripeWebhookResource.java`

**To be modified:**
- `clearflask-server/.../store/AccountStore.java` (add `stripeCustomerId`)
- `clearflask-server/.../store/impl/DynamoElasticAccountStore.java` (GSI + setter)
- `clearflask-server/.../core/ServiceInjector.java` (wiring)
- `clearflask-server/.../web/resource/AccountResource.java` (Checkout signup branch + Portal endpoint + Checkout-complete callback + remove inline-mgmt UI calls when Stripe-billed)
- `clearflask-server/.../billing/CommonPlanVerifyStore.java` (entitlement check via cached Stripe lookup when applicable)
- `clearflask-frontend/src/site/AccountEnterPage.tsx` (Checkout redirect)
- `clearflask-frontend/src/site/dashboard/BillingPage.tsx` (Portal button)

**To be deleted (post-cutover, separate commit):**
- `KillBilling.java`, `KillBillResource.java`, `KillBillSync.java`, `KillBillClientProvider.java`, `KillBillUtil.java`
- `clearflask-server/src/main/resources/killbill/`
- KillBill docker services
- KillBill Maven plugin dependencies (keep `killbill-client-java` jar for DTOs)

## Estimated scope

~12 new Java files, ~8 modifications, ~100 lines of frontend changes. Smaller than the parked branch overall because seat-billing, usage-billing, and the inline SetupIntent flow are dropped. Stripe handles card collection, dunning, retries, receipts, and invoice rendering — we just consume status, deep-link to hosted pages, and reconcile.
