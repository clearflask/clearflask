# Stripe Full-Hosted — Operator Runbook

Reference for setting up, switching modes, rolling back, and removing KillBill once Stripe is fully cut over.

## Deploy → Setup → Switchover

The flow is intentionally three discrete steps so a fresh deploy of this code makes
zero Stripe API calls. Setup happens via super-admin JMX *after* the binary is running;
switchover is a config flip + restart.

### Step 1 — Deploy with KillBill primary (default)

Out of the box this branch ships with:

- `BillingRouter$Config.useStripeForNewSignups = false`
- `BillingRouter$Config.routeGrandfatheredToNoOp = false`
- `StripeSyncService$Config.enabled = false`
- `StripeOverdueEscalationService$Config.enabled = false`
- `StripeProvisioner` is JMX-only (no startup behavior)

Only thing the prod config needs is the Stripe API key:

```
com.smotana.clearflask.billing.StripeClientSetup$Config.stripeApiKey=<sk_live_... or rk_live_...>
```

The Checkout/Portal/webhook URLs derive from `Application$Config.domain` (already set to
`clearflask.com` in prod). After deploy: KillBill keeps serving every account exactly as
before. No Stripe API calls happen.

### Step 2 — Run the provisioner via JMX

`StripeProvisioner.upsertAll()` is `@Extern`-exposed at the MBean
`com.smotana.clearflask.billing:name=StripeProvisionerOpsMBean`. It creates Stripe
Products, Prices, Entitlement Features, attaches features to products, and registers the
WebhookEndpoint (when `autoRegisterWebhook=true`). Idempotent — re-running is a no-op
sync. The webhook signing secret is persisted to the `serviceSecret` DynamoDB table so
subsequent restarts pick it up automatically.

Run **once per environment** (test mode, then live). Example via `jshell` against the
server's JMX port:

```java
import javax.management.*;
import javax.management.remote.*;
JMXConnector c = JMXConnectorFactory.connect(new JMXServiceURL(
    "service:jmx:rmi:///jndi/rmi://localhost:9950/jmxrmi"), null);
Object result = c.getMBeanServerConnection().invoke(
    new ObjectName("com.smotana.clearflask.billing:name=StripeProvisionerOpsMBean"),
    "upsertAll", new Object[]{}, new String[]{});
System.out.println(result);
```

The report lists every Product/Price/Feature/Webhook it touched (`CREATED` or `OK`).
After this completes successfully, live Stripe has the resources clearflask needs.

**Local dev**: `autoRegisterWebhook=false` ships in `config-local-template.cfg` because
Stripe can't reach `localhost`. Use stripe-cli instead and paste the secret into
`webhookSecretOverride`:

```
stripe listen --forward-to https://localhost:8080/api/v1/webhook/stripe
# paste the wh_sec_... into:
com.smotana.clearflask.billing.StripeBilling$Config.webhookSecretOverride=wh_sec_...
```

### Step 2b — Stripe dashboard config (one-time, manual UI work)

- **Subscriptions and emails → Manage failed payments**: configure Smart Retry schedule
  (default 4 retries over ~3 weeks). Set "After all retries fail" to either Mark
  uncollectible or Cancel — recommend Cancel since clearflask can re-prompt the user via
  Customer Portal.
- **Customer emails → Receipts**: enable "Successful payments" so Stripe sends receipts.
- **Customer Portal**: confirm the configuration (allowed actions). Switch on "Customers
  can view their billing history" and "Customers can update payment methods".

Stripe publishable keys are hardcoded in `Dashboard.tsx` (`pk_test_...` and `pk_live_...`).
Update them when rotating Stripe keys.

### Step 3 — Switchover: flip flags + restart

Edit prod config:

```
com.smotana.clearflask.billing.BillingRouter$Config.useStripeForNewSignups=true
com.smotana.clearflask.billing.BillingRouter$Config.routeGrandfatheredToNoOp=true
com.smotana.clearflask.billing.StripeSyncService$Config.enabled=true
com.smotana.clearflask.billing.StripeOverdueEscalationService$Config.enabled=true
```

Restart the server. Now:

- New signups receive a Stripe Checkout Session (no card collected during signup; 14-day
  Stripe-side trial; user adds card later via "Manage subscription" → Customer Portal).
- Grandfathered $0 accounts (lifetime, pitchground, starter-unlimited, cloud-free,
  teammate-unlimited) now route to `NoOpBilling`. Their KillBill subscriptions become
  orphans (no charges since $0); bulk-cancel them via super-admin once you're confident.
- Daily Stripe reconciliation runs (`StripeSyncService`) catches webhook-delivery drift.
- 90-day NOPAYMENTMETHOD escalation runs (`StripeOverdueEscalationService`); its
  `firstRunCutoff` auto-defaults to the JVM start time so aged accounts get a fresh
  90-day grace from this deploy.

Existing customers (anyone whose `account.stripeCustomerId` is still null after this
flip) continue on KillBill — the router checks the field per call, not per startup.

### Step 4 — Migrate the one paying customer (Phase C)

1. Run `OneShotStripeMigrator.migrate(<accountId>, dryRun=true)` via JMX
   (`com.smotana.clearflask.billing:name=OneShotStripeMigratorOpsMBean`) and eyeball the
   report.
2. If clean, run `migrate(<accountId>, dryRun=false)`. The migrator reuses the customer's
   existing Stripe Customer + saved card (created by KillBill's Stripe plugin), creates
   a Stripe Subscription with `trial_end=<KB.chargedThroughDate>` so the first Stripe
   charge lands when KillBill would have billed (no double-charge), sets local
   `stripeCustomerId`, and cancels the KillBill subscription end-of-term.
3. Wait one renewal cycle. Verify Stripe charged and KillBill didn't.
4. Bulk-cancel orphaned grandfathered KillBill subs (one-liner via super-admin; not yet
   automated — track separately).
5. Deploy the KillBill removal commit (see "Removing KillBill" below).

## Rollback

### Cheap rollback (any time)
Set `useStripeForNewSignups=false` and redeploy. New signups revert to KillBill. Anyone who signed up on Stripe in the meantime stays on Stripe — their `account.stripeCustomerId` is set, the router continues to direct them to `StripeBilling`.

### Full revert (Stripe → KillBill)
Not implemented. Would require a reverse migrator that recreates KillBill subscriptions from each Stripe-routed account. Plan B if catastrophic: leave Stripe-routed accounts on Stripe and operate both backends indefinitely.

## Status reconciliation

Three layers handle "is this customer paying":

1. **Webhooks** — `customer.subscription.updated`, `invoice.payment_failed` etc. are pushed by Stripe and processed by `StripeWebhookResource`. Signing-secret verified. Idempotent (24h dedup cache).
2. **Live reads** — every `GET /admin/account/billing` call reads fresh `Subscription.status` from Stripe.
3. **Daily reconcile** — `StripeSyncService` runs once a day, lists active Stripe subscriptions, reconciles `account.status` drift. Configurable via `StripeSyncService$Config.runEvery` and `enabled`. Also `@Extern reconcile()` for ad-hoc runs.

## Removing KillBill (post-cutover)

After successful migration of the one paying customer and one renewal cycle of confidence:

- Delete `KillBilling.java`, `KillBillSync.java`, `KillBillClientProvider.java`, `KillBillUtil.java`, `KillBillResource.java`, `BillingIT.java`, `KillBillCatalogTest.java`.
- Delete `clearflask-server/src/main/resources/killbill/` (catalog021.xml etc).
- Delete `clearflask-release/src/main/docker/compose/killbill-engine/`.
- Remove `killbill-engine`, `killbill-kaui`, and (if not used elsewhere) `mysql-db` from `docker-compose.local.yml`.
- Remove KillBill Maven deps and the `<docker>` plugin block from `pom.xml`; **keep `killbill-client-java`** because the `Billing` interface still returns its DTO classes.
- `BillingRouter`'s third routing branch (`else -> killBill`) becomes unreachable; replace the `else` with a route to `NoOpBilling` to handle accounts that somehow have neither stripeCustomerId nor a grandfathered planid.
- Replace `KillBillPlanStore` references in `MockModelUtil` and tests with the static plan-id set from `NoOpBilling.NOOP_BILLED_PLAN_IDS` plus a few hardcoded sample ids.

## Cost summary

| Component               | Cost              |
|-------------------------|-------------------|
| Stripe Billing (recurring fee) | 0.5% of subscription revenue |
| Payment processing      | 2.9% + $0.30 (already paid via KillBill plugin today; no delta) |
| Customer Portal         | Free              |
| Stripe Checkout         | Free              |
| Hosted invoice pages    | Free              |
| Email receipts          | Free              |
| Stripe Entitlements     | Free              |
| Stripe Tax (optional)   | 0.5% (we leave off) |

For 1 paying customer at ~$29/mo: extra ~$1.74/yr. KillBill teardown saves $360-540/yr in infra plus 2-4 days/yr in upgrade-treadmill labor.

## Local dev quick reference

```bash
# Start Stripe CLI listener + paste secret into config-local.cfg
stripe listen --forward-to https://localhost:8080/api/v1/webhook/stripe

# Then
make local-up
```

Local config (`config-local.cfg` and `config-local-template.cfg`) ships with `useStripeForNewSignups=true` and `routeGrandfatheredToNoOp=true` so devs exercise the Stripe path.
