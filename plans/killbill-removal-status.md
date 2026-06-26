# KillBill Removal — Status & Remaining Plan

Single source of truth for finishing the KillBill→Stripe migration. Supersedes
the rolling notes in `killbill-removal-plan.md` / `killbill-removal-remaining-work.md`
for "what's left". Design detail for the orphan-routing work lives in the
approved plan `~/.claude/plans/harmonic-stirring-prism.md`.

## Where we are (as of 2026-06-26) — MIGRATION COMPLETE

**KillBill is fully removed from the codebase AND decommissioned in prod.**
- **Phase 4 (delete KB code)** shipped to master `c57782d9`, deployed 2026-06-25
  (`28196350935`), verified green: site/api/`/admin/plan` 200, clean startup,
  0 KB refs at runtime.
- **Phase 5 (prod infra decommission)** done 2026-06-26:
  - KB MariaDB DB dumped (30 MB gz) → Google Drive
    `My Drive/ClearFlask/killbill-db-last-backup.sql.gz` (verified complete).
  - `100killbill`/`200kaui` Tomcat webapps removed; `killbill`/`kaui` `<Host>`
    Services dropped from `server.xml` (ports 8081/8082 gone).
  - `conf.d/killbill.conf` → `conf.d/tomcat-opts.conf` (KB JVM args stripped,
    heap/GC/JMX kept); KB blocks removed from `catalina.properties`.
  - `killbill` DB + `killbill@%` MySQL user dropped; `/var/lib/killbill` removed.
  - Tomcat restarted: ClearFlask healthy (200s), heap/JMX intact, 0 KB args.
  - Rollback configs at prod `/var/backups/kb-decomm-20260626/`.
- **Left intentionally (cosmetic):** catalog XMLs, config templates, frontend
  billing copy, and the `killbill-client-java` Maven dep (still provides the DTO
  types the `Billing` interface returns).

## Where we are (as of 2026-06-24)

**KillBill is now UNUSED at runtime (no classes deleted yet)** — commit `701f9e65`,
deploy `28127577799`, verified 2026-06-24:
- `KillBillPlanStore` builds plans from a static `STATIC_PLAN_PRICING` map (extracted
  verbatim from catalog021 + older versions) instead of `catalogApi.getCatalogJson`;
  dropped the `KillBillSync` service dependency. Startup clean, no catalog/KB calls.
- `StripePlanStore.getPublicPlans` serves `PlanConstants.FEATURES_TABLE/_SELFHOST`;
  `/pricing` renders plans + features tables with no KillBill (verified `GET /admin/plan`).
- `BillingRouter` UUID/edge fallbacks (`getAccountByKbId`, `getEndOfTermChangeToPlanId`,
  `getInvoiceHtml`, `getDefaultPaymentMethodDetails(UUID)`, `getAvailablePlans`) → NoOp.
- `KillBilling` daily `commitUncommitedInvoices` KB scan gated behind
  `scanUncommitedInvoicesEnabled`.
- Prod config (`config-prod.cfg`, backup `config-prod.cfg.bak.20260624-kbunused`):
  `KillBillSync.enabled=false` (logs "Skipping killbill sync, disabled"),
  `KillBillResource.registerWebhookOnStartup=false` (no webhook registered at startup),
  `KillBilling.scanUncommitedInvoicesEnabled=false` — all verified live via Ice MBeans.
- Residual: the KB webhook *handler* still exists (would call KB if an event arrived),
  but registration is off and no events fire (SES/logs confirmed). Removed in Phase 4.
- Rollback: restore the config backup (+ revert `701f9e65`).

## Where we are (as of 2026-06-23)

**Done & in prod:**
- 3 paying customers migrated to Stripe (Isaac `29a56fd4…`, Mahr `b741ef68…`,
  Software Central `software-central-itk`). Renewal/charge calendar reminders set.
- ~276 catalog $0 comps (lifetime / pitchground / *-unlimited / cloud-free) route
  to NoOpBilling (already in `NOOP_BILLED_PLAN_IDS`).
- 10 flat-yearly $0 comps normalized `flat-yearly-1 → flat-yearly` → NoOp.
- `"flat-yearly"` added to `NoOpBilling.NOOP_BILLED_PLAN_IDS`.
- `PlanConstants` extracted from KillBill classes; `StripeProvisioner` Long-eq
  duplicate-Price bug fixed; frontend `KillBillPlanStore.java` markers → `PlanConstants.java`.
- **Phase 2 shipped + flag flipped (2026-06-23): orphans now route to NoOp.
  `KillBill is no longer in the live routing path.`** (commit `912f29b0`,
  deploy `28037275058`, `routeOrphansToNoOp=true` verified live via
  `BillingRouterIceMBean`.)

**Known issue (pre-existing, not a Phase 2 regression):**
- `flat-yearly` is in the frontend `STRIPE_BILLED_PLAN_IDS` but has variable
  per-customer pricing → no default Stripe Price (`StripeProvisioner.upsertPrices`
  SKIPS it). So a `flat-yearly` account clicking "Add payment method" → direct
  Checkout → 500 `Plan flat-yearly is not configured in Stripe` (`StripeBilling:815`).
  Affects the ~14 flat-yearly $0 comps only (no billing need). Fix: drop
  `'flat-yearly'` from `STRIPE_BILLED_PLAN_IDS` so they hit the plan picker instead.

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

## Phase 2 — Orphan-routing — DONE (2026-06-23, commit `912f29b0`)
1. ✅ `BillingRouter`: `else` branch + empty-account fallback + `pickForNewSignup`
   fallback → NoOp, behind the new `routeOrphansToNoOp` config flag.
2. ✅ `NoOpBilling.getEntitlementStatus`: planid NOT in `NOOP_BILLED_PLAN_IDS`
   (an orphan) → `NOPAYMENTMETHOD` (preserves `BLOCKED`); grandfathered unchanged.
3. ✅ `BillingRouter.changePlan`: broadened (`accountIsOrphan`) so an orphan
   reactivates through `stripe.changePlan` (→ 409 → frontend Stripe Checkout).
4. ✅ Frontend `stripePlanIds.ts`: trimmed `STRIPE_BILLED_PLAN_IDS` to the 9
   Stripe-provisioned plans. (NOTE: `flat-yearly` left in but has no default Price
   — see Known issue above.)

Rollout done: shipped flag-off → Phase 1 normalization → flipped
`routeOrphansToNoOp=true` in `config-prod.cfg` (backup
`config-prod.cfg.bak.20260623-orphanflip`) → restarted Tomcat 16:03 UTC →
healthy 16:04:51, clean startup, flag verified live, 0 errors under live traffic.
**KillBill is no longer in the live routing path.**

## Phase 3 — Verify — DONE (2026-06-23)
Flag confirmed live (`BillingRouterIceMBean.routeOrphansToNoOp=true`); matus
(grandfathered flat-yearly) stays Active; orphans transition to NOPAYMENTMETHOD
lazily on next reconcile/access; `ProjectDeletionService` ages them out (BLOCKED
now, NOPAYMENTMETHOD after `CANCEL_AFTER_DURATION_IN_DAYS`=90d). No new code.

## Phase 4 — Delete KillBill code (subtractive PR) — DONE (2026-06-25, commit `c57782d9`)
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

## Phase 5 — Decommission prod KB infra — DONE (2026-06-26)
KB ran as the `100killbill` webapp (+ empty `200kaui`) inside the same Tomcat JVM
as ClearFlask (no Docker on prod). Decommissioned:
- Snapshotted KB MariaDB → `killbill-db-last-backup.sql.gz` (30 MB) in Drive.
- Removed `100killbill`/`200kaui` webapps; dropped their `<Host>` Services from
  `server.xml` (freed ports 8081/8082).
- Renamed `conf.d/killbill.conf` → `tomcat-opts.conf` keeping only heap/GC/JMX +
  generic safety flags; stripped KB blocks from `catalina.properties`.
- `DROP DATABASE killbill; DROP USER 'killbill'@'%';`
- Deleted `/var/lib/killbill`. Config backups at `/var/backups/kb-decomm-20260626/`.
- Verified: ClearFlask healthy, `-Xmx896m`/JMX 9050 intact, 0 KB args, KB ports gone.

## Separate track — PII incident follow-ups (still open)
- GitHub Support request to purge by-SHA access to the original PII commits
  (`c54f07f9`, `0ad3ae7c`, `c9589e05`, `78553dc3`) + the first-bad-rewrite commits.
- 30 forks still independently contain the PII commit.
- Treat the 10 customer emails as exposed (~2 days public, 2026-06-13 → 06-15).
- Lesson: never hardcode customer IDs/emails in committed source; use JMX/config params.
