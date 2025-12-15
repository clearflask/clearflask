# KillBill to Stripe Migration Plan

## Executive Summary

This document outlines the migration from KillBill (billing orchestration layer) to direct Stripe integration. Currently, ClearFlask uses KillBill as a billing engine with Stripe as the payment processor underneath. This migration will eliminate the KillBill middleware, simplifying the architecture while gaining access to Stripe's more modern features.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [What KillBill Provides](#2-what-killbill-provides)
3. [What Stripe Provides Natively](#3-what-stripe-provides-natively)
4. [Feature Comparison Matrix](#4-feature-comparison-matrix)
5. [Data Migration Strategy](#5-data-migration-strategy)
6. [Implementation Plan](#6-implementation-plan)
7. [Risk Assessment](#7-risk-assessment)
8. [Rollback Strategy](#8-rollback-strategy)
9. [Timeline Summary](#9-timeline-summary)
10. [Benefits Summary](#10-benefits-summary)
11. [Plan-Based Feature Gating Strategy](#11-plan-based-feature-gating-strategy) ⭐ NEW
12. [Customer & Payment Method Migration](#12-customer--payment-method-migration) ⭐ NEW
13. [Open Questions](#13-open-questions)
14. [Appendix: Plan Mapping](#14-appendix-plan-mapping)

---

## 1. Current Architecture Analysis

### 1.1 System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ClearFlask    │────▶│    KillBill     │────▶│     Stripe      │
│   (Java App)    │     │   (Billing)     │     │   (Payments)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│    DynamoDB     │     │     MySQL       │
│ (Account Data)  │     │ (KillBill DB)   │
└─────────────────┘     └─────────────────┘
```

### 1.2 Key Files in Current System

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Main Billing Logic | `KillBilling.java` | 1,496 | Primary billing implementation |
| Client Provider | `KillBillClientProvider.java` | ~300 | Creates 25+ KillBill API clients |
| Sync/Setup | `KillBillSync.java` | ~600 | Catalog, overdue, plugin configuration |
| Webhook Handler | `KillBillResource.java` | ~350 | Processes KillBill events |
| Plan Store | `KillBillPlanStore.java` | ~400 | Plan definitions and limits |
| Billing Interface | `Billing.java` | ~200 | Abstract billing contract |
| Stripe Setup | `StripeClientSetup.java` | ~50 | Stripe SDK initialization |

### 1.3 Data Flow Analysis

**Current Payment Flow:**
1. User submits payment method via Stripe.js → Token created
2. Token sent to ClearFlask backend → `updatePaymentToken()`
3. ClearFlask sends token to KillBill → KillBill stores as PaymentMethod
4. KillBill creates invoice → Calls Stripe plugin
5. Stripe plugin creates PaymentIntent → Charges customer
6. KillBill receives result → Updates invoice status
7. KillBill sends webhook → ClearFlask updates account status

**Proposed Flow (Direct Stripe):**
1. User submits payment method via Stripe.js → PaymentMethod/SetupIntent
2. ClearFlask backend creates Stripe Customer/Subscription
3. Stripe handles billing automatically
4. Stripe sends webhooks → ClearFlask updates account status

---

## 2. What KillBill Provides

### 2.1 Account Management
- **Account creation** with external key mapping (accountId)
- **Account attributes**: name, email, currency, timezone
- **Account balance** tracking (credits/debits)
- **Payment method storage** (via Stripe plugin)

### 2.2 Subscription Management
- **Subscription lifecycle**: create, cancel, resume, change plan
- **Plan versioning** via XML catalogs (20 catalog versions)
- **Phase management**: TRIAL → EVERGREEN → BLOCKED
- **Entitlement blocking** for overdue accounts
- **Scheduled changes** (end-of-term cancellation)

### 2.3 Billing & Invoicing
- **Invoice generation** at billing cycle start
- **Usage-based billing** (tracked-user, tracked-teammate units)
- **Invoice templates** (Mustache HTML)
- **Invoice finalization** workflow
- **Credit adjustments** for refunds/adjustments

### 2.4 Overdue Management
- **Overdue state machine**: UNPAID (1 day) → CANCELLED (90 days)
- **Automatic retry scheduling**
- **Account blocking** on prolonged non-payment

### 2.5 Analytics & Reporting
- Pre-configured analytics reports (MRR, churn, conversions)
- Built-in admin UI (Kaui)

---

## 3. What Stripe Provides Natively

### 3.1 Account Management (Stripe Customers)
| Feature | Stripe Capability | Notes |
|---------|-------------------|-------|
| Customer creation | ✅ `Customer.create()` | Full equivalent |
| External ID mapping | ✅ `metadata.accountId` | Use metadata |
| Email, name, address | ✅ Native fields | Better address handling |
| Currency | ✅ Per-customer currency | Same |
| Balance/Credits | ✅ `Customer.balance` | Native credit balance |
| Payment methods | ✅ `PaymentMethod` API | More modern than tokens |

### 3.2 Subscription Management (Stripe Subscriptions)
| Feature | Stripe Capability | Notes |
|---------|-------------------|-------|
| Create subscription | ✅ `Subscription.create()` | Full equivalent |
| Cancel subscription | ✅ `cancel_at_period_end` | Native support |
| Resume subscription | ✅ Reactivate before end | Native support |
| Plan changes | ✅ `Subscription.update()` | Proration options |
| Free trials | ✅ `trial_end` or `trial_period_days` | Better than KillBill |
| Phases/Schedules | ✅ `SubscriptionSchedule` API | More flexible |
| Metered billing | ✅ `UsageRecord` API | Direct equivalent |
| Quantity-based | ✅ `quantity` on items | Per-seat pricing |

### 3.3 Billing & Invoicing (Stripe Invoices)
| Feature | Stripe Capability | Notes |
|---------|-------------------|-------|
| Automatic invoicing | ✅ Built-in | No manual finalization |
| Invoice preview | ✅ `Invoice.upcoming()` | Real-time preview |
| Invoice PDF | ✅ `invoice.pdf` | Hosted PDF URL |
| Invoice line items | ✅ `InvoiceItem` | Full control |
| Credit notes | ✅ `CreditNote` API | Refund documentation |
| Invoice customization | ✅ Dashboard + API | Template editor |

### 3.4 Overdue/Dunning Management (Stripe Billing)
| Feature | Stripe Capability | Notes |
|---------|-------------------|-------|
| Smart retries | ✅ Automatic retry logic | ML-powered timing |
| Failed payment emails | ✅ Hosted emails | Customizable |
| Subscription status | ✅ `past_due`, `canceled` | Native states |
| Dunning configuration | ✅ Billing settings | Dashboard config |
| Webhook events | ✅ Comprehensive events | More detailed |

### 3.5 Additional Stripe Features (Not in KillBill)
| Feature | Description | Value |
|---------|-------------|-------|
| **Customer Portal** | Self-service billing management | Reduce support |
| **Payment Links** | No-code checkout pages | Quick sales |
| **Quotes** | Sales proposals | B2B sales |
| **Tax Calculation** | Stripe Tax integration | Auto sales tax |
| **Revenue Recognition** | Built-in revenue reporting | Accounting |
| **Billing Meter** | Real-time usage meters | Better metering |
| **Checkout Sessions** | Hosted payment pages | Higher conversion |
| **Card Updater** | Auto-update expired cards | Reduce churn |
| **Radar** | Fraud detection | Built-in protection |

---

## 4. Feature Comparison Matrix

### 4.1 Core Features

| Feature | KillBill (Current) | Stripe (Proposed) | Migration Effort |
|---------|-------------------|-------------------|------------------|
| Customer accounts | ✅ via KB Account | ✅ Native Customer | Low |
| Subscriptions | ✅ KB Subscriptions | ✅ Native Subscriptions | Medium |
| Plan catalog | ✅ XML catalogs | ✅ Stripe Products/Prices | Medium |
| Free trials | ✅ Catalog phases | ✅ trial_period_days | Low |
| Plan changes | ✅ changePlan() | ✅ Subscription.update() | Low |
| Usage metering | ✅ UsageRecord | ✅ UsageRecord | Medium |
| Invoicing | ✅ KB Invoices | ✅ Native Invoices | Low |
| Credit adjustments | ✅ KB Credits | ✅ Customer.balance | Low |
| Payment methods | ✅ via Plugin | ✅ Native PaymentMethod | Low |
| 3D Secure | ✅ Manual handling | ✅ Automatic | **Simpler** |
| Webhooks | ✅ KB → App | ✅ Stripe → App | Medium |
| Overdue handling | ✅ Overdue config | ✅ Dunning settings | **Simpler** |
| Coupons | ✅ KB Coupons | ✅ Stripe Coupons | Medium |

### 4.2 Features Stripe Adds

| New Feature | Benefit |
|-------------|---------|
| Customer Portal | Self-service plan management, payment updates |
| Automatic card updates | Reduced involuntary churn |
| Smarter retry logic | Better payment success rates |
| Built-in fraud detection | Reduced chargebacks |
| Tax calculation | Automatic VAT/sales tax |
| Revenue recognition | Simplified accounting |
| Better dashboard | Direct Stripe dashboard access |

### 4.3 Features Requiring Custom Implementation

| Feature | Current in KillBill | Stripe Alternative |
|---------|---------------------|-------------------|
| Custom invoice template | Mustache HTML | Stripe hosted + metadata |
| Analytics reports | KillBill analytics plugin | Stripe Sigma / export |
| Account external key | KB external_key | Customer metadata |

---

## 5. Data Migration Strategy

### 5.1 Data Mapping

#### Accounts → Customers
```
KillBill Account          →    Stripe Customer
─────────────────────────────────────────────
external_key (accountId)  →    metadata.accountId
name                      →    name
email                     →    email
currency                  →    currency
account_balance           →    balance (cents)
payment_methods           →    Migrate via PaymentMethod API
```

#### Subscriptions → Subscriptions
```
KillBill Subscription     →    Stripe Subscription
─────────────────────────────────────────────
bundle_external_key       →    metadata.accountId
plan_name                 →    price_id (create mapping)
phase_type (TRIAL)        →    trial_end timestamp
phase_type (EVERGREEN)    →    active subscription
cancelled_date            →    cancel_at_period_end
entitlement (BLOCKED)     →    subscription.status = 'canceled'
```

#### Plans → Products/Prices
```
KillBill Catalog          →    Stripe Products/Prices
─────────────────────────────────────────────
product (growth)          →    Product (growth)
plan (growth2-monthly)    →    Price (monthly, $X)
trial phase               →    trial_period_days on Price
usage (tracked-user)      →    Metered Price
```

### 5.2 Migration Phases

#### Phase 1: Parallel Setup (Week 1-2)
1. Create Stripe Products and Prices matching current plans
2. Set up Stripe webhook endpoint
3. Implement new `StripeBilling.java` (implements `Billing` interface)
4. Test with new accounts only (feature flag)

#### Phase 2: Customer Migration (Week 3-4)
1. For each existing KillBill account:
   - Create Stripe Customer with metadata
   - Link existing Stripe PaymentMethods (already in Stripe via plugin)
   - Store `stripeCustomerId` in DynamoDB account
2. Run in batches, validate data

#### Phase 3: Subscription Migration (Week 5-6)
1. For active subscriptions:
   - Create Stripe Subscription matching current plan/state
   - Set correct trial_end or billing_cycle_anchor
   - Preserve any existing credits as Customer balance
2. Implement dual-read: check both systems during transition

#### Phase 4: Cutover (Week 7)
1. Switch webhook processing to Stripe-only
2. Disable KillBill subscription creation
3. Route all new operations through Stripe
4. Keep KillBill read-only for historical data

#### Phase 5: Cleanup (Week 8+)
1. Remove KillBill dependencies
2. Delete KillBill-related code
3. Decommission KillBill infrastructure

---

## 6. Implementation Plan

### 6.1 New Classes to Create

```
clearflask-server/src/main/java/com/smotana/clearflask/billing/
├── StripeBilling.java           # New Billing implementation
├── StripePlanStore.java         # Plan definitions for Stripe
├── StripeWebhookHandler.java    # Webhook processing
├── StripeMigration.java         # Migration utilities
└── StripeCustomerPortal.java    # Customer portal integration
```

### 6.2 Files to Modify

| File | Changes |
|------|---------|
| `Billing.java` | Add `getCustomerPortalUrl()` method |
| `AccountStore.java` | Add `stripeCustomerId` field |
| `AccountResource.java` | Update billing endpoints |
| `StripeClientSetup.java` | Add webhook secret configuration |

### 6.3 Files to Delete (After Migration)

```
# Delete entire KillBill infrastructure
clearflask-server/src/main/java/com/smotana/clearflask/billing/
├── KillBilling.java
├── KillBillClientProvider.java
├── KillBillSync.java
├── KillBillUtil.java
└── KillBillPlanStore.java

clearflask-server/src/main/java/com/smotana/clearflask/web/resource/
└── KillBillResource.java

clearflask-server/src/main/resources/killbill/
└── catalog*.xml (20 files)
└── invoice-template.mustache
└── overdue.xml
```

### 6.4 Dependencies to Remove

```xml
<!-- Remove from pom.xml -->
<dependency>
    <groupId>org.kill-bill.billing</groupId>
    <artifactId>killbill-api</artifactId>
</dependency>
<dependency>
    <groupId>org.kill-bill.billing.plugin.java</groupId>
    <artifactId>stripe-plugin</artifactId>
</dependency>
<!-- Additional KillBill dependencies -->
```

### 6.5 Infrastructure Changes

| Component | Current | After Migration |
|-----------|---------|-----------------|
| KillBill Engine | Docker container | **Remove** |
| KillBill Kaui | Admin UI | **Remove** |
| KillBill MySQL DB | Billing data | **Remove** |
| Stripe Dashboard | Payment only | Full billing management |

### 6.6 Detailed Implementation Steps

#### Step 1: Create Stripe Products/Prices

```java
// Create products and prices matching current plans
Product growth = Product.create(Map.of(
    "name", "Growth",
    "metadata", Map.of("killbill_product", "growth")
));

Price growthMonthly = Price.create(Map.of(
    "product", growth.getId(),
    "unit_amount", 5000,  // $50.00
    "currency", "usd",
    "recurring", Map.of(
        "interval", "month",
        "trial_period_days", 14
    ),
    "metadata", Map.of("killbill_plan", "growth2-monthly")
));

// For metered plans
Price growthMetered = Price.create(Map.of(
    "product", growth.getId(),
    "currency", "usd",
    "recurring", Map.of(
        "interval", "month",
        "usage_type", "metered",
        "aggregate_usage", "sum"
    ),
    "unit_amount", 10,  // $0.10 per tracked user
    "metadata", Map.of("unit", "tracked-user")
));
```

#### Step 2: Implement StripeBilling.java

```java
@Singleton
public class StripeBilling implements Billing {

    @Override
    public void createAccountWithSubscriptionAsync(Account account) {
        // Create Stripe Customer
        Customer customer = Customer.create(Map.of(
            "email", account.getEmail(),
            "name", account.getName(),
            "metadata", Map.of("accountId", account.getAccountId())
        ));

        // Store customer ID
        accountStore.setStripeCustomerId(account.getAccountId(), customer.getId());

        // Create subscription
        Subscription subscription = Subscription.create(Map.of(
            "customer", customer.getId(),
            "items", List.of(Map.of("price", getPriceId(account.getPlanId()))),
            "trial_period_days", getTrialDays(account.getPlanId())
        ));
    }

    @Override
    public Subscription changePlan(String accountId, String planId, Optional<Long> price) {
        String customerId = accountStore.getStripeCustomerId(accountId);
        Subscription subscription = getActiveSubscription(customerId);

        // Update subscription with new price
        subscription.update(Map.of(
            "items", List.of(Map.of(
                "id", subscription.getItems().getData().get(0).getId(),
                "price", getPriceId(planId)
            )),
            "proration_behavior", "create_prorations"
        ));
    }

    @Override
    public void recordUsage(UsageType type, String accountId, String projectId, ...) {
        String subscriptionItemId = getMeteredSubscriptionItemId(accountId);

        UsageRecord.createOnSubscriptionItem(
            subscriptionItemId,
            Map.of(
                "quantity", 1,
                "timestamp", Instant.now().getEpochSecond(),
                "action", "increment"
            )
        );
    }

    // New method: Customer Portal for self-service
    public String getCustomerPortalUrl(String accountId, String returnUrl) {
        String customerId = accountStore.getStripeCustomerId(accountId);

        Session session = Session.create(Map.of(
            "customer", customerId,
            "return_url", returnUrl
        ));

        return session.getUrl();
    }
}
```

#### Step 3: Implement Stripe Webhook Handler

```java
@Path("/api/v1/webhook/stripe")
public class StripeWebhookResource {

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response handleWebhook(
            String payload,
            @HeaderParam("Stripe-Signature") String signature) {

        Event event = Webhook.constructEvent(payload, signature, webhookSecret);

        switch (event.getType()) {
            case "customer.subscription.created":
            case "customer.subscription.updated":
                handleSubscriptionUpdate(event);
                break;

            case "customer.subscription.deleted":
                handleSubscriptionDeleted(event);
                break;

            case "invoice.payment_succeeded":
                handlePaymentSucceeded(event);
                break;

            case "invoice.payment_failed":
                handlePaymentFailed(event);
                break;

            case "customer.subscription.trial_will_end":
                handleTrialEnding(event);
                break;
        }

        return Response.ok().build();
    }

    private void handleSubscriptionUpdate(Event event) {
        Subscription subscription = (Subscription) event.getData().getObject();
        String accountId = subscription.getMetadata().get("accountId");

        SubscriptionStatus status = mapStripeStatus(subscription.getStatus());
        accountStore.updateStatus(accountId, status);

        String planId = mapPriceIdToPlan(
            subscription.getItems().getData().get(0).getPrice().getId()
        );
        accountStore.setPlan(accountId, planId);
    }

    private SubscriptionStatus mapStripeStatus(String stripeStatus) {
        return switch (stripeStatus) {
            case "active" -> SubscriptionStatus.ACTIVE;
            case "trialing" -> SubscriptionStatus.ACTIVETRIAL;
            case "past_due" -> SubscriptionStatus.ACTIVEPAYMENTRETRY;
            case "canceled" -> SubscriptionStatus.CANCELLED;
            case "unpaid" -> SubscriptionStatus.BLOCKED;
            default -> SubscriptionStatus.ACTIVE;
        };
    }
}
```

#### Step 4: Migration Script

```java
public class StripeMigration {

    public void migrateAccount(String accountId) {
        // 1. Get KillBill account
        Account kbAccount = killBilling.getAccount(accountId);

        // 2. Check if Stripe customer already exists (from plugin)
        // The Stripe plugin may have already created a customer
        String stripeCustomerId = findExistingStripeCustomer(kbAccount.getEmail());

        if (stripeCustomerId == null) {
            // 3. Create new Stripe Customer
            Customer customer = Customer.create(Map.of(
                "email", kbAccount.getEmail(),
                "name", kbAccount.getName(),
                "metadata", Map.of(
                    "accountId", accountId,
                    "migratedFromKillBill", "true"
                )
            ));
            stripeCustomerId = customer.getId();
        }

        // 4. Migrate payment methods
        PaymentMethodDetails paymentMethod = killBilling.getDefaultPaymentMethodDetails(accountId);
        if (paymentMethod.isPresent()) {
            // Payment methods should already exist in Stripe via the plugin
            // Just need to ensure they're attached to the customer
            attachExistingPaymentMethod(stripeCustomerId, paymentMethod);
        }

        // 5. Create subscription if active
        Subscription kbSub = killBilling.getSubscription(accountId);
        if (kbSub.getStatus().isActive()) {
            createStripeSubscription(stripeCustomerId, kbSub);
        }

        // 6. Migrate credit balance
        BigDecimal balance = kbAccount.getAccountBalance();
        if (balance.compareTo(BigDecimal.ZERO) != 0) {
            // Negative balance in KillBill = credit owed to customer
            // In Stripe, negative balance = credit to apply to invoices
            Customer.update(stripeCustomerId, Map.of(
                "balance", balance.negate().multiply(new BigDecimal(100)).longValue()
            ));
        }

        // 7. Store mapping
        accountStore.setStripeCustomerId(accountId, stripeCustomerId);
    }
}
```

---

## 7. Risk Assessment

### 7.1 High Risk Areas

| Risk | Mitigation |
|------|------------|
| **Data loss during migration** | Dual-write during transition, comprehensive validation |
| **Payment disruption** | Maintain KillBill as fallback, gradual rollout |
| **Webhook gaps** | Run both webhook endpoints in parallel |
| **Usage tracking gaps** | Reconcile usage before cutover |
| **Credit/balance discrepancies** | Audit all accounts before/after |

### 7.2 Medium Risk Areas

| Risk | Mitigation |
|------|------------|
| **Plan mapping errors** | Extensive testing of all plan combinations |
| **3D Secure handling changes** | Test all card types, regions |
| **Invoice format changes** | Communicate to customers |
| **Subscription timing** | Align billing anchors carefully |

### 7.3 Low Risk Areas

| Risk | Mitigation |
|------|------------|
| **API changes** | Stripe API is stable, well-documented |
| **Webhook reliability** | Stripe has excellent delivery guarantees |
| **Customer data** | Already exists in Stripe via plugin |

---

## 8. Rollback Strategy

### 8.1 Phase-Based Rollback

| Phase | Rollback Action |
|-------|-----------------|
| Phase 1 (Parallel) | Disable feature flag, continue with KillBill |
| Phase 2 (Customer Migration) | Keep KillBill as source of truth |
| Phase 3 (Subscription Migration) | Dual-read allows instant fallback |
| Phase 4 (Cutover) | Re-enable KillBill webhooks |
| Phase 5 (Cleanup) | **No rollback** - KillBill removed |

### 8.2 Rollback Indicators

- Payment failure rate increases >5%
- Customer complaints increase
- Webhook processing errors
- Data consistency issues

---

## 9. Timeline Summary

| Week | Phase | Key Deliverables |
|------|-------|------------------|
| 1-2 | Parallel Setup | Stripe Products, StripeBilling.java, webhook handler |
| 3-4 | Customer Migration | All customers migrated, validated |
| 5-6 | Subscription Migration | All subscriptions migrated, dual-read |
| 7 | Cutover | Stripe as primary, KillBill read-only |
| 8+ | Cleanup | Remove KillBill code and infrastructure |

---

## 10. Benefits Summary

### 10.1 Technical Benefits
- **Simplified architecture**: Remove middleware layer
- **Reduced dependencies**: Eliminate 25+ KillBill API clients
- **Better reliability**: Stripe's enterprise infrastructure
- **Modern APIs**: RESTful, well-documented
- **Automatic retries**: ML-powered payment retry logic

### 10.2 Business Benefits
- **Customer Portal**: Self-service billing management
- **Reduced churn**: Automatic card updates
- **Better conversion**: Optimized checkout
- **Tax compliance**: Stripe Tax integration
- **Analytics**: Stripe Dashboard and Sigma

### 10.3 Operational Benefits
- **No KillBill maintenance**: Eliminate KillBill infrastructure
- **No MySQL for billing**: Remove database dependency
- **Unified dashboard**: Single Stripe dashboard
- **Better debugging**: Stripe's logging and events

---

## 11. Plan-Based Feature Gating Strategy

### 11.1 Current Feature Gating System

The current system uses **plan IDs as the primary key** for feature gating. Features are NOT stored in KillBill - they're hardcoded in both backend and frontend:

**Backend** (`CommonPlanVerifyStore.java`):
```java
// Restricted features by plan
STARTER_GROWTH_PLANS = ["cloud-free", "starter-unlimited", "growth2-monthly", ...]

if (STARTER_GROWTH_PLANS.contains(planId)) {
    // Restrict: whitelabel, OAuth, SSO, private projects, integrations
}
```

**Frontend** (`UpgradeWrapper.tsx`):
```typescript
RestrictedPropertiesByPlan = {
  'growth2-monthly': [whitelabel, oauth, sso, visibility, templates, github, integrations],
  'standard2-monthly': [whitelabel],
  'cloud-yearly': [],  // Unrestricted
}
```

### 11.2 How Stripe Handles Feature Entitlements

Stripe provides **three approaches** for feature management:

#### Option A: Continue Using Plan ID (Recommended for Migration)
Keep the current approach - store plan ID in ClearFlask's DynamoDB and use it for feature checks.

```
Stripe Subscription → Price ID → Map to Plan ID → Feature lookup in code
```

**Pros**: Minimal code changes, same logic works
**Cons**: Feature definitions still in code

#### Option B: Stripe Product Metadata
Store feature flags in Stripe Product/Price metadata:

```java
// When creating Price in Stripe
Price.create(Map.of(
    "product", productId,
    "metadata", Map.of(
        "planId", "growth2-monthly",
        "features", "basic,analytics",           // CSV of features
        "maxTeammates", "2",
        "maxProjects", "unlimited",
        "allowWhitelabel", "false",
        "allowSSO", "false"
    )
));
```

**Pros**: Features managed in Stripe dashboard
**Cons**: Need to fetch from Stripe on every check (cache needed)

#### Option C: Stripe Entitlements (New Feature - 2024)
Stripe recently introduced [Entitlements](https://stripe.com/docs/billing/entitlements) for feature management:

```java
// Create a Feature in Stripe
Feature feature = Feature.create(Map.of(
    "name", "SSO Access",
    "lookup_key", "sso-access"
));

// Attach to Product
ProductFeature.create(Map.of(
    "product", productId,
    "entitlement_feature", feature.getId()
));

// Check entitlement at runtime
ActiveEntitlementCollection entitlements =
    ActiveEntitlement.list(Map.of("customer", customerId));

boolean hasSso = entitlements.getData().stream()
    .anyMatch(e -> e.getFeature().getLookupKey().equals("sso-access"));
```

**Pros**: Native Stripe feature management, dashboard UI
**Cons**: Newer API, requires more refactoring

### 11.3 Handling Plan Changes & Grandfathering

#### The Grandfathering Problem
> "What happens when I want to add/remove a feature from a plan but have existing users retain the original?"

**Current Problem**: Features are tied to plan ID, so changing features affects ALL users on that plan.

#### Solution: Price Versioning in Stripe

**Strategy**: Create new Prices (not Products) when features change, keep old Prices active.

```
Products (Features)          Prices (Versions)
─────────────────           ─────────────────
Growth Product       →      growth-v1-monthly (original features)
                     →      growth-v2-monthly (new features, new signups)
                     →      growth-v3-monthly (future version)
```

**Implementation**:

```java
// When plan features change, create new Price
Price growthV2 = Price.create(Map.of(
    "product", growthProductId,
    "unit_amount", 5000,
    "currency", "usd",
    "recurring", Map.of("interval", "month"),
    "lookup_key", "growth-v2-monthly",
    "metadata", Map.of(
        "planId", "growth2-v2-monthly",      // New plan ID
        "version", "2",
        "effectiveDate", "2025-01-15",
        "features", "basic,analytics,newFeature"
    )
));

// Archive old price (no new signups, existing subs continue)
Price.update(growthV1Id, Map.of("active", false));
```

**Feature Check Logic**:
```java
public boolean hasFeature(String accountId, String feature) {
    String planId = accountStore.getPlanId(accountId);  // e.g., "growth2-v1-monthly"

    // Plan ID includes version, so old users keep old features
    return PlanFeatures.get(planId).contains(feature);
}
```

### 11.4 Recommended Feature Gating Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Feature Gating Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Stripe Subscription                                            │
│       │                                                         │
│       ▼                                                         │
│  Price ID (e.g., price_abc123)                                  │
│       │                                                         │
│       ▼                                                         │
│  Price Metadata: { planId: "growth2-v2-monthly" }               │
│       │                                                         │
│       ▼                                                         │
│  Store planId in DynamoDB Account                               │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────┐                    │
│  │  PlanFeatureStore (in-memory/cached)    │                    │
│  │  ─────────────────────────────────────  │                    │
│  │  "growth2-v1-monthly" → [basic, analytics]                   │
│  │  "growth2-v2-monthly" → [basic, analytics, sso]              │
│  │  "standard2-monthly"  → [all features]                       │
│  └─────────────────────────────────────────┘                    │
│       │                                                         │
│       ▼                                                         │
│  Feature check: planFeatureStore.hasFeature(planId, "sso")      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.5 Migration Steps for Feature Gating

1. **Keep current plan IDs** as the feature lookup key
2. **Store planId in Price metadata** when creating Stripe Prices
3. **On subscription webhook**, extract planId from Price metadata → store in DynamoDB
4. **When changing plan features**:
   - Create new Price with new planId (e.g., `growth2-v2-monthly`)
   - Archive old Price (existing customers unaffected)
   - Update PlanFeatureStore with new planId → features mapping
5. **Existing customers** keep their original planId, get original features
6. **New customers** get new planId, get new features

### 11.6 Code Changes Required

**Backend** - New `StripePlanStore.java`:
```java
@Singleton
public class StripePlanStore implements PlanStore {

    // Plan ID → Features mapping (loaded from config or Stripe)
    private final Map<String, PlanFeatures> planFeatures;

    // Version tracking
    private final Map<String, String> currentPlanVersions = Map.of(
        "growth", "growth2-v2-monthly",      // Latest version for new signups
        "standard", "standard2-monthly"
    );

    public PlanFeatures getFeatures(String planId) {
        return planFeatures.get(planId);
    }

    public String getCurrentPriceId(String basePlan) {
        return priceIdMapping.get(currentPlanVersions.get(basePlan));
    }
}
```

**Frontend** - Update `UpgradeWrapper.tsx`:
```typescript
// Add version-aware feature checking
const RestrictedPropertiesByPlan: { [planId: string]: Set<Property> } = {
  'growth2-v1-monthly': new Set([whitelabel, oauth, sso, ...]),
  'growth2-v2-monthly': new Set([whitelabel, oauth]),  // SSO now allowed
  'standard2-monthly': new Set([whitelabel]),
};
```

---

## 12. Customer & Payment Method Migration

### 12.1 Current State: KillBill-Stripe Plugin Architecture

The KillBill Stripe plugin creates Stripe objects internally, but ClearFlask doesn't track them:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ClearFlask    │     │    KillBill     │     │     Stripe      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ Account ID: abc │────▶│ KB Account: xyz │────▶│ Customer: cus_* │
│ (DynamoDB)      │     │ PaymentMethod   │     │ PaymentMethod   │
│                 │     │ Subscription    │     │ Subscription    │
│ NO Stripe IDs   │     │ (MySQL)         │     │ (Stripe DB)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Key Finding**: ClearFlask has NO record of Stripe Customer IDs (`cus_*`) or PaymentMethod IDs (`pm_*`).

### 12.2 Good News: Payment Methods Already Exist in Stripe

When users add payment methods through the current flow:
1. Frontend uses `Stripe.js` to create a token
2. Token is sent to KillBill
3. **KillBill's Stripe plugin creates the PaymentMethod in Stripe**
4. Only card metadata (last4, brand, expiry) is returned to ClearFlask

**The PaymentMethods already exist in Stripe** - we just need to find them.

### 12.3 Finding Existing Stripe Customers

#### Method 1: Query Stripe by Email (Recommended)

```java
public String findStripeCustomerByEmail(String email) {
    CustomerSearchResult result = Customer.search(Map.of(
        "query", "email:'" + email + "'"
    ));

    if (!result.getData().isEmpty()) {
        return result.getData().get(0).getId();  // Found existing customer
    }
    return null;  // Need to create new customer
}
```

**Note**: KillBill's Stripe plugin typically creates customers with the same email.

#### Method 2: Query KillBill for Plugin Properties

The Stripe plugin may store the Stripe Customer ID in plugin properties:

```java
public String findStripeCustomerFromKillBill(String accountId) {
    UUID kbAccountId = getKbAccountId(accountId);

    // Get payment methods from KillBill
    List<PaymentMethod> methods = kbPaymentMethod.getPaymentMethodsForAccount(
        kbAccountId, null, null, KillBillUtil.roDefault());

    for (PaymentMethod method : methods) {
        if ("killbill-stripe".equals(method.getPluginName())) {
            // Check plugin properties for Stripe customer ID
            for (PluginProperty prop : method.getPluginInfo().getProperties()) {
                if ("customerId".equals(prop.getKey())) {
                    return (String) prop.getValue();  // cus_xxxxx
                }
            }
        }
    }
    return null;
}
```

#### Method 3: Query Stripe Plugin Database Directly

The Stripe plugin stores mappings in KillBill's MySQL:

```sql
SELECT stripe_customer_id
FROM stripe_payment_methods
WHERE kb_account_id = ?;
```

### 12.4 Migration Script: Retaining Payment Methods

```java
public class CustomerMigration {

    public MigrationResult migrateCustomer(String accountId) {
        Account cfAccount = accountStore.getAccount(accountId);
        MigrationResult result = new MigrationResult(accountId);

        // Step 1: Find or create Stripe Customer
        String stripeCustomerId = findExistingStripeCustomer(cfAccount.getEmail());

        if (stripeCustomerId != null) {
            result.setCustomerStatus(FOUND_EXISTING);
            log.info("Found existing Stripe customer {} for account {}",
                     stripeCustomerId, accountId);
        } else {
            // Create new customer
            Customer customer = Customer.create(Map.of(
                "email", cfAccount.getEmail(),
                "name", cfAccount.getName(),
                "metadata", Map.of(
                    "accountId", accountId,
                    "migratedAt", Instant.now().toString()
                )
            ));
            stripeCustomerId = customer.getId();
            result.setCustomerStatus(CREATED_NEW);
        }

        // Step 2: Find and attach payment methods
        List<PaymentMethod> existingMethods = PaymentMethod.list(Map.of(
            "customer", stripeCustomerId,
            "type", "card"
        )).getData();

        if (!existingMethods.isEmpty()) {
            result.setPaymentMethodStatus(ALREADY_ATTACHED);
            result.setPaymentMethodCount(existingMethods.size());

            // Set default payment method if not set
            Customer customer = Customer.retrieve(stripeCustomerId);
            if (customer.getInvoiceSettings().getDefaultPaymentMethod() == null) {
                Customer.update(stripeCustomerId, Map.of(
                    "invoice_settings", Map.of(
                        "default_payment_method", existingMethods.get(0).getId()
                    )
                ));
            }
        } else {
            // Try to find orphaned payment methods by email
            result.setPaymentMethodStatus(NOT_FOUND);
            log.warn("No payment methods found for customer {}", stripeCustomerId);
        }

        // Step 3: Store mapping in DynamoDB
        accountStore.setStripeCustomerId(accountId, stripeCustomerId);

        return result;
    }

    private String findExistingStripeCustomer(String email) {
        try {
            CustomerSearchResult result = Customer.search(Map.of(
                "query", "email:'" + email + "'"
            ));

            // Return most recently created customer if multiple
            return result.getData().stream()
                .max(Comparator.comparing(Customer::getCreated))
                .map(Customer::getId)
                .orElse(null);
        } catch (StripeException e) {
            log.error("Error searching for customer by email", e);
            return null;
        }
    }
}
```

### 12.5 Handling Edge Cases

#### Case 1: Multiple Stripe Customers with Same Email
```java
// If multiple customers found, merge payment methods to primary
List<Customer> customers = Customer.search(Map.of(
    "query", "email:'" + email + "'"
)).getData();

if (customers.size() > 1) {
    Customer primary = customers.get(0);  // Use oldest as primary

    for (int i = 1; i < customers.size(); i++) {
        // Move payment methods from secondary to primary
        List<PaymentMethod> methods = PaymentMethod.list(Map.of(
            "customer", customers.get(i).getId()
        )).getData();

        for (PaymentMethod pm : methods) {
            pm.attach(Map.of("customer", primary.getId()));
        }
    }
}
```

#### Case 2: Payment Method Not Found in Stripe
If the payment method truly doesn't exist (shouldn't happen normally):

```java
if (paymentMethodNotFound) {
    // Option 1: Mark account for re-collection
    accountStore.updateStatus(accountId, SubscriptionStatus.NOPAYMENTMETHOD);
    notificationService.sendPaymentMethodRequired(accountId);

    // Option 2: Create subscription without payment method (trial)
    Subscription.create(Map.of(
        "customer", stripeCustomerId,
        "items", List.of(Map.of("price", priceId)),
        "payment_behavior", "default_incomplete",  // Won't charge until PM added
        "trial_end", calculateTrialEnd()
    ));
}
```

#### Case 3: Customer Has Active KillBill Subscription
Don't double-charge! Check KillBill subscription end date:

```java
Subscription kbSub = killBilling.getSubscription(accountId);
Instant billingPeriodEnd = kbSub.getChargedThroughDate();

// Create Stripe subscription starting AFTER KillBill period ends
Subscription.create(Map.of(
    "customer", stripeCustomerId,
    "items", List.of(Map.of("price", priceId)),
    "billing_cycle_anchor", billingPeriodEnd.getEpochSecond(),
    "proration_behavior", "none"
));
```

### 12.6 Schema Change: AccountStore

Add `stripeCustomerId` to the Account model:

```java
// In AccountStore.java
@DynamoTable(partitionKeys = "accountId", rangePrefix = "account")
class Account {
    String accountId;
    String email;
    String name;
    String planid;
    SubscriptionStatus status;

    // NEW FIELD
    @DynamoAttribute
    String stripeCustomerId;  // Stripe Customer ID (cus_xxxxx)

    // ... existing fields
}
```

### 12.7 Migration Validation Checklist

Before cutover, validate for each migrated account:

| Check | Query | Expected |
|-------|-------|----------|
| Customer exists | `Customer.retrieve(stripeCustomerId)` | 200 OK |
| Payment method attached | `PaymentMethod.list(customer=X)` | ≥1 method |
| Default PM set | `customer.invoice_settings.default_payment_method` | Not null |
| Subscription created | `Subscription.list(customer=X)` | Matches KillBill |
| Balance migrated | `customer.balance` | Matches KillBill |
| Metadata correct | `customer.metadata.accountId` | Matches ClearFlask |

### 12.8 Migration Summary

```
┌────────────────────────────────────────────────────────────────┐
│               Customer Migration Flow                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  For each ClearFlask Account:                                  │
│                                                                │
│  1. Search Stripe for existing Customer (by email)             │
│     ├─ Found? → Use existing (payment methods already there)   │
│     └─ Not found? → Create new Customer                        │
│                                                                │
│  2. Verify payment methods are attached                        │
│     ├─ Yes? → Set default payment method                       │
│     └─ No? → Flag for manual review / notify user              │
│                                                                │
│  3. Create Stripe Subscription                                 │
│     ├─ Match current plan (via Price lookup)                   │
│     ├─ Align billing cycle with KillBill end date              │
│     └─ Migrate credits to Customer balance                     │
│                                                                │
│  4. Store stripeCustomerId in DynamoDB                         │
│                                                                │
│  5. Validate: Customer, PaymentMethod, Subscription all exist  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Key Insight**: Since the KillBill Stripe plugin already creates real Stripe objects, most customers will have existing Stripe Customers and PaymentMethods. The migration primarily involves:
1. **Finding** the existing Stripe Customer ID
2. **Storing** the mapping in DynamoDB
3. **Creating** new Stripe Subscriptions (since KillBill manages subscriptions separately)

---

## 13. Open Questions

1. **Historical invoices**: Should old KillBill invoices be migrated or archived?
2. **Coupon migration**: Are there active coupons that need special handling?
3. **Custom pricing**: How to handle existing sponsor plans with custom prices?
4. **Self-host impact**: Does self-host billing need any changes?
5. **Analytics reports**: Are KillBill analytics reports actively used?

---

## 14. Appendix: Plan Mapping

### Current KillBill Plans → Stripe Products/Prices

| KillBill Plan | Type | Stripe Product | Stripe Price |
|---------------|------|----------------|--------------|
| starter-unlimited | Free | Starter | Free tier |
| cloud-free | Free | Cloud Free | Free tier |
| growth2-monthly | Subscription | Growth | Monthly recurring |
| standard2-monthly | Subscription | Standard | Monthly recurring |
| standard3-monthly | Subscription | Standard v3 | Monthly recurring |
| sponsor-monthly | Custom | Sponsor | Custom pricing |
| pro-lifetime | One-time | Pro Lifetime | One-time payment |
| pitchground-*-lifetime | One-time | PitchGround | One-time payment |
| selfhost-yearly | License | Self-Host | Yearly recurring |

### Usage Units Mapping

| KillBill Unit | Stripe Meter |
|---------------|--------------|
| tracked-user | MAU meter |
| tracked-teammate | Teammate meter |
