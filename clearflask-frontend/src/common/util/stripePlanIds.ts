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
  // Must stay in sync with StripeProvisioner.PLAN_SPECS (the only plans with a Stripe Price).
  // Legacy planids with no provisioned Price (cloud-monthly, cloud-90day-yearly, selfhost-monthly,
  // growth2-monthly, standard2-monthly, standard3-monthly, ...) are intentionally excluded: an
  // account on one of those reactivates through the plan picker (-> 409 -> Checkout) rather than a
  // direct Checkout that would 500 for lack of a Price.
  'cloud-starter-monthly',
  'cloud-monthly2',
  'cloud-yearly',
  'selfhost-monthly2',
  'selfhost-yearly2',
  'selfhost-yearly',
  'sponsor-monthly',
  'sponsor-monthly-5',
  'flat-yearly',
]);

export const isStripeBilledPlan = (planId: string | undefined): boolean =>
  !!planId && STRIPE_BILLED_PLAN_IDS.has(planId);
