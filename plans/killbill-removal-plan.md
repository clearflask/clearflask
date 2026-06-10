# KillBill Removal Plan

How to safely remove KillBill from clearflask after the Stripe direct-billing
migration. Companion doc to `stripe-full-hosted-runbook.md`.

## Gating conditions

KillBill can be removed once **all** of the following are true:

1. **All 3 paying KillBill customers are migrated** via `OneShotStripeMigrator`
   (Isaac, Mahr EDV, Software Central — see runbook step 4). **Done 2026-06-10.**
2. **At least one Stripe-driven renewal cycle has succeeded** without KB-side
   double-billing. Earliest signal: Isaac's renewal on **2026-06-24**.
   That single canary is enough to prove the trial_end handoff.
3. **Orphan KB-routed accounts have been cancelled locally** via
   `OneShotKbOrphanCleaner.cancelOrphanKbAccounts(false)`. Policy is opt-out:
   anyone past their KB trial without a card AND without a Stripe customer gets
   local `account.status = Cancelled`. Active trials are left alone. Re-engagement
   is via the patched Add Card → Stripe Checkout flow OR by contacting support.
4. **Constants and customer-facing copy are moved** (Section B below).

## A. Notification model — verified safe

For Stripe-routed accounts, every event KillBill currently fires has a
Stripe-webhook equivalent already wired into `StripeWebhookResource:130-148`:

| KB event (KillBillResource) | Stripe event (StripeWebhookResource) | Local effect |
|---|---|---|
| `INVOICE_CREATION` | `invoice.created` (implicit via subscription lifecycle) | `billing.finalizeInvoice` |
| `INVOICE_PAYMENT_SUCCESS` | `invoice.payment_succeeded` | OnInvoicePaymentSuccess + credit sync |
| `PAYMENT_FAILED` | `invoice.payment_failed` | OnPaymentFailed notification |
| subscription plan-change | `customer.subscription.created/updated/deleted` | sync local `account.planid` + `account.status` |
| (poll-based) | `customer.subscription.trial_will_end` (3 days before) | OnTrialEnding email |

Plus three layers of redundancy after the cut:

1. Stripe retries failed webhook delivery for up to 3 days.
2. Every `GET /admin/account/billing` re-reads `Subscription.status` from Stripe.
3. `StripeSyncService` runs daily reconcile + `@Extern reconcile()` for ops.

`TrialEndingReminderService` is **poll-based** (iterates accounts, calls
`billing.getSubscription(accountId).getEvents()`), so it's backend-agnostic.
No change needed.

**OnTrialEnded path verified (2026-06-10):** `StripeBilling.updateAndGetEntitlementStatus`
(lines 655-676) fires `notificationService.onTrialEnded(account, hasPaymentMethod)` on
any `ACTIVETRIAL → non-ACTIVENORENEWAL` transition, guarded by
`accountStore.shouldSendTrialEndedNotification` for one-shot semantics. The Stripe
webhook `customer.subscription.updated` path (`onSubscriptionChanged`) calls this
when Stripe transitions the sub from `trialing` to `active` at `trial_end`. For the
3 migrated customers, no email fires (their pre-migration status was ACTIVE, no
transition detected) — correct, they were already paying.

## B. Code-path dependencies to replace

Files outside `clearflask-server/src/main/java/com/smotana/clearflask/billing/`
that reference KillBill prod code (excluding pure DTO type usage — see C).

### B1. `KillBillResource.java` — incoming KB push webhook

Handles 4 KB event types listed above. All have Stripe-webhook equivalents.
**Delete the file. Remove `KillBillResource.module()` install from
`ServiceInjector:347`.**

### B2. `KillBillSync.java` — analytics report uploads + KB tenant config

Pushes ClearFlask's analytics-report definitions into KB on startup. Goes away
with KB. **Delete + remove from `ServiceInjector:377`.**

### B3. `KillBilling.java`, `KillBillClientProvider.java`

Remove module installs from `ServiceInjector:375-376`. `BillingRouter`'s third
routing branch (`else → killBill`) becomes unreachable — replace with
`NoOpBilling` per the runbook so it still routes accounts whose
`stripeCustomerId` is null AND whose plan isn't in `NOOP_BILLED_PLAN_IDS`.

### B4. Public constants leaking across the boundary

Each is a `public static final` on `KillBillPlanStore` / `KillBillSync` used by
non-billing prod code. Move first so the actual delete commit is purely
subtractive.

| Constant | Used by | New home |
|---|---|---|
| `KillBillPlanStore.PLAN_MAX_POSTS` | `AccountResource:1239` | `PlanStore` interface or new `PlanConstants` class |
| `KillBillPlanStore.SELFHOST_SERVICE_PLANS` | `AccountResource:1297`, `CloudLocalLicenseStore:41` | already shadowed on `PlanStore` interface — drop the KB-side @deprecated alias and update call sites |
| `KillBillPlanStore.ADDON_EXTRA_TEAMMATE` | `AccountResource:739, 749, 1252` | `PlanConstants` |
| `KillBillPlanStore.FEATURES_TABLE` / `_SELFHOST` | `PlanStoreRouter.getPublicPlans` (commit `1d96bfcf`) | `PlanConstants` |
| `KillBillSync.CANCEL_AFTER_DURATION_IN_DAYS` | `ProjectDeletionService:37` | small `BillingPolicy` const class |

Existing pattern to mimic: `PlanStore.SELFHOST_SERVICE_PLANS` is on the interface
with `KillBillPlanStore` holding a `@deprecated` shim. Replicate for the others.

### B5. `AccountResource.deleteAccount` / reset-to-trial path

`AccountResource:1383` calls `billing.cancelSubscription(accountId)` as
best-effort cleanup. After removal this routes through `BillingRouter →
NoOpBilling` (cancelSubscription is a no-op) — harmless. No change required,
but **delete the now-misleading comment at line 1381-1382** referencing KB.

### B6. Frontend `UpgradeWrapper.tsx` (15+ markers)

Lines 18, 27, 29, 33, 38, 51, 60, 65, 77, 81, 83, 118, 137, 144, 152 — comments
saying `/** If changed, also change in KillBillPlanStore.java */`. Pure markers,
no code dep. Sweep-update to point at the new constants home (B4).

### B7. Customer-facing marketing copy

`LandingPages.tsx:3192`:
> "For reliable billing, we use KillBill to handle managing your final invoice
> and processing your payments."

Rewrite to mention Stripe Billing instead.

### B8. OpenAPI doc strings

`api-account.yaml:1138, 1141` mention KillBill in
`accountResetToStripeTrialSuperAdmin` description. Update wording; regenerates
the TS client comments at `AccountSuperAdminApi.ts:102, 220, 245`.

### B9. Tests + mocks

- `MockModelUtil` (referenced in runbook): replace `KillBillPlanStore`
  references with the static plan-id set from `NoOpBilling.NOOP_BILLED_PLAN_IDS`
  plus hardcoded sample ids.
- `BillingIT.java`, `KillBillCatalogTest.java`: delete.

## C. DTO-only references (keep — runbook says keep `killbill-client-java`)

These survive removal because the `Billing` interface contract uses KillBill
SDK types as plain DTOs even from `StripeBilling` and `NoOpBilling`. No change
needed:

- `AccountResource` imports `PhaseType`, `EventSubscription`, `Subscription`,
  `SubscriptionEventType`
- `StripeWebhookResource:189,198` uses KB-typed Account / Subscription as DTOs
- `TrialEndingReminderService` uses `PhaseType`, `EventSubscription`
- `LocalLicenseStore.java:5`, `CloudLocalLicenseStore.java:10` import Account

The Maven dep stays. Only the *engine* (server, plugin, MySQL DB) gets removed.

## D. Infrastructure / Docker / Maven

Per runbook:

- Delete `clearflask-server/src/main/resources/killbill/` (catalog021.xml etc).
- Delete `clearflask-release/src/main/docker/compose/killbill-engine/`.
- Remove `killbill-engine`, `killbill-kaui`, and (if not used elsewhere) `mysql-db`
  from `docker-compose.local.yml` + the generated compose tarball pipeline.
- Remove KillBill Maven deps from `clearflask-server/pom.xml` (but keep
  `killbill-client-java` for the DTO types — see C).
- Remove the `<docker>` plugin block from `pom.xml` that builds the killbill
  image (if any).
- Drop `make local-up`'s dependency on KB-related env vars in any `Makefile`
  target or `config-local-template.cfg`.

## Cosmetic / leave alone

- `Sanitizer.java:42` — `killbill` is one entry in a long blocked-subdomains
  list. Cosmetic.

## Removal order (minimum blast radius)

1. **Move the constants** (B4 + B6) — pure refactor, no behavior change.
2. **Verify the OnTrialEnded path** in `StripeWebhookResource` (Section A gap).
3. **Bulk-cancel orphan KB subs** (runbook step). Script not yet written.
4. **Delete KB code + modules** (B1-B3, B7-B9) + infra/Maven cleanup (D) — one
   subtractive PR.

Done in that order, the final commit reads as clean deletions.
