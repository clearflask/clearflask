# Stripe Full-Hosted — Operator Runbook

Reference for setting up, switching modes, rolling back, and removing KillBill once Stripe is fully cut over.

## One-time Stripe setup

### 1. Stripe API keys

In the Stripe dashboard, create both **test mode** and **live mode** secret API keys at https://dashboard.stripe.com/apikeys (test) and https://dashboard.stripe.com/apikeys (live). Set them in clearflask config:

```
com.smotana.clearflask.billing.StripeClientSetup$Config.stripeApiKey=<sk_test_... or sk_live_...>
com.smotana.clearflask.billing.StripeBilling$Config.publicUrl=https://yourdomain.com
com.smotana.clearflask.billing.StripeProvisioner$Config.publicUrl=https://yourdomain.com
```

### 2. Run the provisioner

`StripeProvisioner.upsertAll()` is `@Extern`-exposed for super-admin invocation. It creates Stripe Products, Prices, Entitlement Features, and the WebhookEndpoint. Idempotent — re-running is safe and acts as `sync`.

Run **once per environment** (test, then live). The webhook signing secret is persisted to the `serviceSecret` DynamoDB table on first creation; subsequent app restarts pick it up automatically.

If `autoRegisterWebhook=false` (local dev), use Stripe CLI instead:

```
stripe listen --forward-to https://localhost:8080/api/v1/webhook/stripe
# paste the wh_sec_... into:
com.smotana.clearflask.billing.StripeBilling$Config.webhookSecretOverride=wh_sec_...
```

### 3. Stripe dashboard config (one-time, for both test and live)

- **Subscriptions and emails → Manage failed payments**: configure Smart Retry schedule (default 4 retries over ~3 weeks). Set "After all retries fail" to either Mark uncollectible or Cancel — recommend Cancel since clearflask can re-prompt the user via Customer Portal.
- **Customer emails → Receipts**: enable "Successful payments" so Stripe sends receipts.
- **Customer Portal**: confirm the configuration written by the provisioner (logo, colors, allowed actions). Switch on "Customers can view their billing history" and "Customers can update payment methods".

### 4. Frontend config

Stripe publishable keys are still hardcoded in `Dashboard.tsx` (`pk_test_...` and `pk_live_...`). Update them when rotating Stripe keys.

## Switching modes

The two governing flags both live in `BillingRouter$Config`:

- `useStripeForNewSignups` — new signups get a Stripe Checkout Session URL instead of being created on KillBill. Default `false`.
- `routeGrandfatheredToNoOp` — grandfathered $0 plans (lifetime, pitchground, starter-unlimited, cloud-free, teammate-unlimited) bypass both KillBill and Stripe; live as DynamoDB-only records served by `NoOpBilling`. Default `false`.

### Phase A (current default): KillBill primary, Stripe scaffolding present

```
useStripeForNewSignups=false
routeGrandfatheredToNoOp=false
```

Live traffic is unchanged. New signups go to KillBill. Grandfathered customers continue on KillBill.

### Phase B: Stripe primary for new signups

```
useStripeForNewSignups=true
routeGrandfatheredToNoOp=true
```

New signups receive a Stripe Checkout URL from `POST /admin/account/billing/checkout-session`. Customer pays on Stripe, returns to `success_url=/dashboard/billing?checkout_session_id=...`. The frontend posts to `POST /admin/account/billing/checkout-complete?sessionId=...` which sets `account.stripeCustomerId`. The webhook also calls finalize as a defensive layer.

Grandfathered $0 accounts now route to `NoOpBilling`. Their KillBill subscriptions become orphaned (no charges since $0); a follow-up bulk-cancel script can tidy them once Phase C completes.

### Phase C: Migrate the one paying customer + remove KillBill

1. Run `OneShotStripeMigrator.migrate(<accountId>, dryRun=true)` and eyeball the report.
2. If clean, run `OneShotStripeMigrator.migrate(<accountId>, dryRun=false)`.
3. Wait one renewal cycle. Verify Stripe charged and KillBill didn't.
4. Bulk-cancel grandfathered KillBill subs (one-line script via super-admin endpoint; not yet automated — track separately).
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
