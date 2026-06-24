// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

/**
 * Plan IDs that are billed via Stripe (full hosted) and therefore require a Stripe Checkout
 * Session to collect payment during signup. Mirrors {@code StripeProvisioner.PLAN_SPECS} on
 * the backend.
 *
 * <p>Grandfathered $0 plans (lifetime, pitchground, starter-unlimited, cloud-free,
 * teammate-unlimited, etc.) are NOT in this set — those route to NoOpBilling.
 */
export const STRIPE_BILLED_PLAN_IDS: ReadonlySet<string> = new Set([
  // Must stay in sync with StripeProvisioner.PLAN_SPECS plans that have a fixed default Price.
  // Excluded on purpose so they fall through to the plan picker (-> 409 -> Checkout) instead of a
  // direct Checkout that would 500 for lack of a resolvable Price:
  //  - Legacy planids with no provisioned Price (cloud-monthly, cloud-90day-yearly, selfhost-monthly,
  //    growth2-monthly, standard2-monthly, standard3-monthly, ...).
  //  - 'flat-yearly': provisioned as a Product but with variable per-customer pricing (no default
  //    Price; StripeProvisioner.upsertPrices SKIPS it), so a direct Checkout for it 500s. The
  //    flat-yearly $0 comps must reach the picker, not a dead direct Checkout.
  'cloud-starter-monthly',
  'cloud-monthly2',
  'cloud-yearly',
  'selfhost-monthly2',
  'selfhost-yearly2',
  'selfhost-yearly',
  'sponsor-monthly',
  'sponsor-monthly-5',
]);

export const isStripeBilledPlan = (planId: string | undefined): boolean =>
  !!planId && STRIPE_BILLED_PLAN_IDS.has(planId);
