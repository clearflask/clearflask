# KillBill Removal — Status & Remaining Plan

Single source of truth for finishing the KillBill→Stripe migration. Supersedes
the rolling notes in `killbill-removal-plan.md` / `killbill-removal-remaining-work.md`
for "what's left". Design detail for the orphan-routing work lives in the
approved plan `~/.claude/plans/harmonic-stirring-prism.md`.

## Where we are (as of 2026-06-22)

**Done & in prod:**
- 3 paying customers migrated to Stripe (Isaac `29a56fd4…`, Mahr `b741ef68…`,
  Software Central `software-central-itk`). Renewal/charge calendar reminders set.
- ~276 catalog $0 comps (lifetime / pitchground / *-unlimited / cloud-free) route
  to NoOpBilling (already in `NOOP_BILLED_PLAN_IDS`).
- 10 flat-yearly $0 comps normalized `flat-yearly-1 → flat-yearly` → NoOp.
- `"flat-yearly"` added to `NoOpBilling.NOOP_BILLED_PLAN_IDS`.
- `PlanConstants` extracted from KillBill classes; `StripeProvisioner` Long-eq
  duplicate-Price bug fixed; frontend `KillBillPlanStore.java` markers → `PlanConstants.java`.

**NOT done (orphan-routing work was lost during the PII git-history purge):**
- `BillingRouter` still routes the orphan bucket → KillBilling. **KillBill is
  still in the live path.**

## Phase 1 — Normalize the 4 flat-yearly stragglers — DONE (2026-06-22)
Ran the existing JMX op `setPlan(<accountId>, "flat-yearly")` against prod
(`DynamoElasticAccountStoreOpsMBean`, JMX localhost:9050 over `ssh clearflask`,
no hardcoded IDs in source). All 4 normalized `flat-yearly-1/-2 → flat-yearly`,
statuses preserved, all `stripeCustomerId=null` → now route to NoOpBilling:
- matus (`fc74aaea…`) → flat-yearly, **Active**
- khaledhaik (`f1a4bb61…`) → flat-yearly, Blocked
- lordi (`1007c792…`) → flat-yearly, Blocked
- sergio (`sergio-pizarro-ws7k`, a real custom accountId) → flat-yearly, Blocked

These are now off KillBill. Phase 2's flag flip can proceed without misclassifying
them as orphans.

## Phase 2 — Orphan-routing (re-implement from harmonic-stirring-prism.md)
1. `BillingRouter`: `else` branch + empty-account fallback → NoOp, behind a new
   `routeOrphansToNoOp` config flag (mirrors `routeGrandfatheredToNoOp`).
2. `NoOpBilling.getEntitlementStatus`: if planid NOT in `NOOP_BILLED_PLAN_IDS`
   (an orphan), return `NOPAYMENTMETHOD` (preserve `BLOCKED`); grandfathered
   plans behave exactly as today.
3. `BillingRouter.changePlan`: broaden upgrade interception so an orphan
   (no stripeCustomerId, non-NoOp plan) reactivates through `stripe.changePlan`
   (→ 409 → frontend Stripe Checkout).
4. Frontend `clearflask-frontend/src/common/util/stripePlanIds.ts`: trim
   `STRIPE_BILLED_PLAN_IDS` to only Stripe-provisioned plans so legacy-plan
   reactivation falls through to the plan picker instead of 500-ing.
Rollout: ship with flag off → run Phase 1 → flip `routeOrphansToNoOp=true`.
**This removes the last live KillBill dependency.**

## Phase 3 — Verify
Orphans show NOPAYMENTMETHOD (access denied), can self-reactivate via Stripe
Checkout, and the existing `ProjectDeletionService` ages them out (BLOCKED now,
NOPAYMENTMETHOD after `CANCEL_AFTER_DURATION_IN_DAYS`=90d). No new deletion code.

## Phase 4 — Delete KillBill code (subtractive PR)
- Delete `KillBilling`, `KillBillSync`, `KillBillResource`, `KillBillClientProvider`,
  `KillBillUtil`, `KillBillPlanStore`, `BillingIT`, `KillBillCatalogTest`,
  `clearflask-server/src/main/resources/killbill/`, `killbill-engine` compose.
- `BillingRouter`: `else → noOp` permanently; remove `@Named("killbill")` field
  and the `routeOrphansToNoOp` false-branch.
- Replace `PlanStoreRouter.getPlan` KB fallback (`:112-116`) — move the legacy
  plan catalog to a static source (like `PlanConstants.FEATURES_TABLE`), else
  cancelled legacy-plan billing pages NPE at `AccountResource.java:1223`.
- Delete `OneShotKbOrphanCleaner` (obsolete — orphan-routing replaces it).
- Remove KB Maven deps from `clearflask-server/pom.xml`; **keep
  `killbill-client-java`** (Billing interface still returns its DTO types).
- Fix tests: `AbstractBlackboxIT` unannotated Billing/PlanStore bindings,
  `MockModelUtil` KillBillPlanStore references.

## Phase 5 — Decommission prod KB infra
Stop `killbill-engine` + `killbill-kaui`; snapshot then drop the KB MySQL DB;
remove KB env vars from `config-prod.cfg`.

## Separate track — PII incident follow-ups (still open)
- GitHub Support request to purge by-SHA access to the original PII commits
  (`c54f07f9`, `0ad3ae7c`, `c9589e05`, `78553dc3`) + the first-bad-rewrite commits.
- 30 forks still independently contain the PII commit.
- Treat the 10 customer emails as exposed (~2 days public, 2026-06-13 → 06-15).
- Lesson: never hardcode customer IDs/emails in committed source; use JMX/config params.
