# KillBill Removal — Remaining Work

Companion to `killbill-removal-plan.md`. Tracks what's still to do, what's
already shipped, and the dates everything is gated on. Updated as work lands.

## Done (this branch of work)

- All 3 paying customers migrated to Stripe via `OneShotStripeMigrator`
  (Isaac, Mahr EDV, Software Central). Stripe subs `trialing` with `trial_end`
  matching KB `chargedThroughDate`. KB subs `ENT_CANCELLED` end-of-term.
- `OneShotKbOrphanCleaner` — JMX-callable cleaner to mark KB-routed
  non-trial accounts as `Cancelled` ahead of the delete commit.
- `OnTrialEnded` wiring verified live in `StripeWebhookResource`.
- `NoOpBilling.getEntitlementStatus` confirmed to preserve local status — no
  modification needed post-removal, just route via the existing `noOp` branch.
- `PlanConstants` extracted from `KillBillPlanStore` / `KillBillSync`. External
  callers (`AccountResource`, `CloudLocalLicenseStore`, `ProjectDeletionService`)
  no longer import KillBill classes.
- `StripeProvisioner.upsertPrices`: fixed Long auto-boxing `==` bug that created
  duplicate Stripe Prices on every `upsertAll()` run.
- `UpgradeWrapper.tsx` "see KillBillPlanStore.java" markers swept to
  "see PlanConstants.java" (16 occurrences).
- 6 calendar reminders generated for trial_will_end and first-charge dates per
  customer (Isaac 06-24, Mahr 07-25, SC 2027-06-02).

## Gating

| Date | Event | What to verify |
|---|---|---|
| **2026-06-24** | Isaac first Stripe charge ($29) | Stripe invoice paid succeeded; KB `analytics_invoices` has no new row for `29a56fd46…` after this date |

If green → unblocks everything below.

## Pre-canary nice-to-haves (no rush)

| Item | Effort | Notes |
|---|---|---|
| Archive duplicate Stripe Prices (test + live) | 20 min | The Long==`==` bug created N copies per plan over time. List all `active=true` Prices grouped by `metadata.clearflask_plan_id`, keep newest per plan, archive (POST `/v1/prices/{id}` with `active=false`) the rest. No functional impact since `resolvePriceId` picks the most recent. |

## Post-canary work

### $0 comped accounts — handled

The other grandfathered $0 plans (standard/starter/standard2-unlimited,
pitchground-a..e-lifetime, pro-lifetime, cloud-free — ~276 accounts) have clean
catalog slugs already in `NOOP_BILLED_PLAN_IDS`, so they already route to
NoOpBilling in prod (`routeGrandfatheredToNoOp=true`) with zero KillBill
dependency. No work needed for them.

`flat-yearly` was the only $0 group still on KillBill — it was a price-overridden
paid plan (KB slug + local planid `flat-yearly-1`, not in the NoOp set → else
branch → KillBilling). Handled by:
- Adding `"flat-yearly"` to `NOOP_BILLED_PLAN_IDS`.
- `OneShotFlatYearlyMigrator.migrate(dryRun)` (@Extern): normalizes the 10 comp
  accounts' planid `flat-yearly-1 -> flat-yearly` (also restores the base-plan
  restriction switch, which the prod-primary identity `getBasePlanId` had been
  bypassing) and sets merged addons (preserves existing; grants `whitelabel` to
  khaled, pitchground, michaela, nomin).

Post-migration these route to NoOp, keep $0 access, enforce flat-yearly
restrictions, and can upgrade to Stripe via the standard grandfathered→paid path.

### Run the cleaner
```java
// JMX: com.smotana.clearflask.billing:name=OneShotKbOrphanCleanerOpsMBean
cancelOrphanKbAccounts(true)   // dry-run first, eyeball the list
cancelOrphanKbAccounts(false)  // commit
```
Policy applied: any account with `stripeCustomerId IS NULL` AND `planid NOT IN
NoOpBilling.NOOP_BILLED_PLAN_IDS` AND status not `ActiveTrial` or `Cancelled`
gets `account.status = Cancelled` locally. To re-engage: contact support OR
click Add Card (patched Stripe Checkout flow migrates them).

### Customer-facing copy
- `LandingPages.tsx:3192` — "we use KillBill" → mention Stripe Billing.
- `api-account.yaml:1138, 1141` — `accountResetToStripeTrialSuperAdmin`
  description (regenerates `AccountSuperAdminApi.ts` comments).

### The subtractive PR

Delete:
- `KillBilling.java`, `KillBillSync.java`, `KillBillClientProvider.java`,
  `KillBillUtil.java`, `KillBillPlanStore.java`, `KillBillResource.java`
- `BillingIT.java`, `KillBillCatalogTest.java`
- `clearflask-server/src/main/resources/killbill/` (catalog021.xml etc)
- `clearflask-release/src/main/docker/compose/killbill-engine/`

Edits:
- `ServiceInjector` — remove `KillBill*.module()` installs (lines 375-377, 347).
- `BillingRouter.pick(...)` — `else → noOp` (was `killBill`).
- `BillingRouter` field `@Named("killbill") killBill` — remove.
- `PlanStoreRouter.getPublicPlans` — replace `killBillPlanStore.getPublicPlans()`
  fallbacks with direct `new PlansGetResponse(plans, PlanConstants.FEATURES_TABLE,
  PlanConstants.FEATURES_TABLE_SELFHOST)`. Remove `@Inject killBillPlanStore`.
- `StripePlanStore.getPublicPlans` (and any `emptyFeaturesTable()` helper) — fine
  as-is since the router now fills the gap; can simplify if convenient.
- `clearflask-server/pom.xml` — remove KillBill Maven deps. **Keep
  `killbill-client-java`** for the DTO types still used by Billing impls.
- `docker-compose.local.yml` — remove `killbill-engine`, `killbill-kaui`, and
  `mysql-db` if not used elsewhere.
- `Makefile` — drop any KB-specific bits.
- `BillingPage.tsx:1581-1589` — the inline `paymentToken: 'killbill-stripe'`
  legacy POST is now dead code (the Add Card flow always redirects to Checkout
  or Portal). Delete the dialog + `onPaymentSubmit`.
- Frontend KB references in `LandingPages.tsx`, `BillingPage.tsx`,
  generated API docs.

Test infrastructure:
- `AbstractBlackboxIT` currently has a direct hack-bind
  `bind(Billing.class).to(KillBilling.class)` for the unannotated key. Once
  KillBilling is gone, switch to either `to(NoOpBilling.class)` or install
  `BillingRouter.module()` + `StripeBilling.module()` + `NoOpBilling.module()`
  properly. Same for `PlanStore`.
- `MockModelUtil` references to `KillBillPlanStore` (per runbook) —
  replace with `NoOpBilling.NOOP_BILLED_PLAN_IDS` + a hardcoded sample set.

### Prod infra decommission
After the subtractive PR is green in prod for a few days:
- Stop `killbill-engine` + `killbill-kaui` services on prod.
- Snapshot the `killbill` MySQL database (audit trail), then drop / detach the
  volume.
- Remove KB-specific env vars from prod config (`config-prod.cfg`).
- Confirm nothing in clearflask hits the (now-dead) `/api/v1/webhook/killbill`
  endpoint (which is also being deleted in the PR).

## Calendar dates that auto-resolve

After the post-canary work above, these dates need no operator action — Stripe
handles them, but the calendar events are still there as a smoke-test signal.

| Date | Customer | Stripe sub |
|---|---|---|
| 2026-07-22 | Mahr | `trial_will_end` webhook |
| 2026-07-25 | Mahr | First Stripe charge $108 |
| 2027-05-30 | Software Central | `trial_will_end` webhook |
| 2027-06-02 | Software Central | First Stripe charge $490 |
