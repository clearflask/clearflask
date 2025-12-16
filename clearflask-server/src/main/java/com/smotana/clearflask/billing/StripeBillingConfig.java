// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;

/**
 * Configuration for direct Stripe billing integration.
 * <p>
 * This config supports the gradual migration from KillBill to Stripe:
 * - Feature flag to control whether new signups use Stripe directly
 * - Support for test mode via ?stripe_test=1 query parameter
 * - Separate API keys and webhook secrets for test vs live mode
 */
public interface StripeBillingConfig {

    /**
     * When true, new account signups will use Stripe directly instead of KillBill.
     * Existing KillBill accounts continue to use KillBill until migrated.
     */
    @DefaultValue("false")
    boolean useStripeForNewSignups();

    /**
     * When true, allows the ?stripe_test=1 query parameter to force test mode
     * for manual testing of the Stripe integration before full rollout.
     */
    @DefaultValue("true")
    boolean allowStripeTestModeQueryParam();

    /**
     * Stripe API key for live mode (sk_live_xxx).
     * This is the production Stripe account key.
     */
    @NoDefaultValue
    String stripeLiveApiKey();

    /**
     * Stripe API key for test mode (sk_test_xxx).
     * Used when ?stripe_test=1 query parameter is set, or for test accounts.
     */
    @NoDefaultValue
    String stripeTestApiKey();

    /**
     * Stripe webhook signing secret for live mode (whsec_xxx).
     * Used to verify webhook signatures from Stripe live environment.
     */
    @NoDefaultValue
    String stripeWebhookSecretLive();

    /**
     * Stripe webhook signing secret for test mode (whsec_xxx).
     * Used to verify webhook signatures from Stripe test environment.
     */
    @NoDefaultValue
    String stripeWebhookSecretTest();

    /**
     * Stripe publishable key for live mode (pk_live_xxx).
     * Sent to frontend for Stripe Elements/Checkout.
     */
    @NoDefaultValue
    String stripePublishableKeyLive();

    /**
     * Stripe publishable key for test mode (pk_test_xxx).
     * Used when testing the Stripe integration.
     */
    @NoDefaultValue
    String stripePublishableKeyTest();

    /**
     * Free plan: maximum tracked users allowed before requiring upgrade.
     */
    @DefaultValue("25")
    int freePlanTrackedUserLimit();

    /**
     * Stripe Product ID for the Starter plan (prod_xxx).
     */
    @NoDefaultValue
    String starterPlanProductId();

    /**
     * Stripe Product ID for the Pro plan (prod_xxx).
     */
    @NoDefaultValue
    String proPlanProductId();

    /**
     * Base URL for Stripe Customer Portal.
     * Customers are redirected here to manage their subscription.
     */
    @NoDefaultValue
    String stripeCustomerPortalUrl();

    static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.configModule(StripeBillingConfig.class));
            }
        };
    }
}
