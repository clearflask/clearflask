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
  'cloud-starter-monthly',
  'cloud-monthly',
  'cloud-monthly2',
  'cloud-yearly',
  'cloud-90day-yearly',
  'selfhost-monthly',
  'selfhost-monthly2',
  'selfhost-yearly',
  'selfhost-yearly2',
  'flat-yearly',
  'sponsor-monthly',
  'growth2-monthly',
  'standard2-monthly',
  'standard3-monthly',
]);

export const isStripeBilledPlan = (planId: string | undefined): boolean =>
  !!planId && STRIPE_BILLED_PLAN_IDS.has(planId);
