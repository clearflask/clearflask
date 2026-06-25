// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.smotana.clearflask.api.model.FeaturesTable;
import com.smotana.clearflask.api.model.FeaturesTableFeatures;

/**
 * Plan-family constants shared across the codebase.
 *
 * <p>Decoupled from any specific {@link Billing} backend so they can survive the KillBill
 * removal. Backend-specific code (KillBill catalog XML, Stripe Products) only owns the
 * billing-side artifacts; the comparison tables, post limits, addon ids, and overdue
 * cutoff all describe ClearFlask's product policy and live here.
 *
 * <p>Non-instantiable.
 */
public final class PlanConstants {
    private PlanConstants() {
    }

    // ============================ Policy constants ============================

    /**
     * After this many days past a non-paying state, the account becomes eligible for project
     * deletion. Currently the same window KillBill's overdue policy used, kept as the source
     * of truth post-KB.
     */
    public static final int CANCEL_AFTER_DURATION_IN_DAYS = 90;

    /**
     * Maximum post count per plan. Only the free / starter plans cap posts; paid plans are
     * unbounded (absent from this map).
     *
     * <p>If changed, also change in UpgradeWrapper.tsx.
     */
    public static final ImmutableMap<String, Long> PLAN_MAX_POSTS = ImmutableMap.of(
            "starter-unlimited", 30L,
            "selfhost-free", 100L,
            "self-host", 100L,
            "cloud-free", 100L);

    /**
     * Addon ID for the per-seat teammate upsell on plans that have a teammate cap.
     *
     * <p>If changed, also change in BillingPage.tsx.
     */
    public static final String ADDON_EXTRA_TEAMMATE = "extra-teammate";

    // Addon ids + per-plan teammate caps, relocated from KillBillPlanStore so they survive the
    // KillBill removal. (If changed, also change in BillingPage.tsx / UpgradeWrapper.tsx.)
    public static final String ADDON_WHITELABEL = "whitelabel";
    public static final String ADDON_PRIVATE_PROJECTS = "private-projects";
    public static final String ADDON_EXTRA_PROJECT = "extra-project";
    public static final String ADDON_AI = "extra-ai";
    public static final long GROWTH_MAX_TEAMMATES = 2L;
    public static final long STANDARD_MAX_TEAMMATES = 8L;
    public static final long LIFETIME_MAX_TEAMMATES = 1L;

    // ============================ Features comparison tables ============================

    // TERMS_* are duplicated from KillBillPlanStore on purpose: they're used by the
    // FEATURES_TABLE constants below and need to survive the KB removal commit.
    // KillBillPlanStore's private TERMS_* (still used by PLANS_BUILDER) goes away with KB.
    private static final String TERMS_POSTS = "Delete older posts to keep your project tidy and stay within the limits.";
    private static final String TERMS_PROJECTS = "You can create separate projects each having their own set of users and content";
    private static final String TERMS_ADMINS = "Amount of administrators, product managers or support team members you can have on each project including yourself.";
    private static final String TERMS_CLEARFLASK_AI = "ClearFlask AI is a way to talk to your customers through AI powered with all of your customer feedback. This feature is currently in preview and may become a paid feature in the future.";
    private static final String TERMS_CREDIT_SYSTEM = "Credit System allows fine-grained prioritization of value for each idea.";
    private static final String TERMS_PRIVATE_PROJECTS = "Create a private project so only authorized users can view and provide feedback";
    private static final String TERMS_SSO_AND_OAUTH = "Use your existing user accounts to log into ClearFlask with Single Sign-On or external OAuth provider such as Google, Github or Facebook";
    private static final String TERMS_SITE_TEMPLATE = "Use your own HTML template to display parts of the site";
    private static final String TERMS_TRACKING = "Include Google Analytics or Hotjar on every page";
    private static final String TERMS_API = "Integrate with any external service via our API and webhooks";
    private static final String TERMS_GITHUB = "Synchronize GitHub issues with ClearFlask";
    private static final String TERMS_INTERCOM = "Add Intercom widget on every page";
    private static final String TERMS_WHITELABEL = "Remove ClearFlask branding";
    private static final String TERMS_ELASTICSEARCH = "Search powered by ElasticSearch for fast and accurate search capability";

    /**
     * Cloud / Self-host / Open-source comparison table on the public /pricing page.
     * Plan-family-comparative, not backend-specific.
     */
    public static final FeaturesTable FEATURES_TABLE = new FeaturesTable(
            ImmutableList.of("Open-source", "Self-host", "Cloud"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Hosting", ImmutableList.of("Self", "Self", "Managed"), null),
                    new FeaturesTableFeatures("Posts", ImmutableList.of("100 Max", "No limit", "No limit"), TERMS_POSTS),
                    new FeaturesTableFeatures("Projects", ImmutableList.of("No limit", "No limit", "No limit"), TERMS_PROJECTS),
                    new FeaturesTableFeatures("Users", ImmutableList.of("No limit", "No limit", "No limit"), null),
                    new FeaturesTableFeatures("Teammates", ImmutableList.of("No limit", "No limit", "No limit"), TERMS_ADMINS),
                    new FeaturesTableFeatures("Roadmap", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Credit System", ImmutableList.of("Yes", "Yes", "Yes"), TERMS_CREDIT_SYSTEM),
                    new FeaturesTableFeatures("Content customization", ImmutableList.of("Yes", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Custom domain", ImmutableList.of("No", "Yes", "Yes"), null),
                    new FeaturesTableFeatures("Private projects", ImmutableList.of("No", "Yes", "Yes"), TERMS_PRIVATE_PROJECTS),
                    new FeaturesTableFeatures("SSO and OAuth", ImmutableList.of("No", "Yes", "Yes"), TERMS_SSO_AND_OAUTH),
                    new FeaturesTableFeatures("Site template", ImmutableList.of("No", "Yes", "Yes"), TERMS_SITE_TEMPLATE),
                    new FeaturesTableFeatures("GitHub integration", ImmutableList.of("No", "Yes", "Yes"), TERMS_GITHUB),
                    new FeaturesTableFeatures("Intercom integration", ImmutableList.of("No", "Yes", "Yes"), TERMS_INTERCOM),
                    new FeaturesTableFeatures("Tracking integrations", ImmutableList.of("No", "Yes", "Yes"), TERMS_TRACKING),
                    new FeaturesTableFeatures("API", ImmutableList.of("No", "Yes", "Yes"), TERMS_API),
                    new FeaturesTableFeatures("Whitelabel", ImmutableList.of("No", "Yes", "Yes"), TERMS_WHITELABEL),
                    new FeaturesTableFeatures("Support", ImmutableList.of("Community", "Priority", "Priority"), null)
            ), null);

    /**
     * Self-host Free vs Licensed comparison table on the public /pricing page.
     */
    public static final FeaturesTable FEATURES_TABLE_SELFHOST = new FeaturesTable(
            ImmutableList.of("Free", "Licensed"),
            ImmutableList.of(
                    new FeaturesTableFeatures("Projects", ImmutableList.of("No limit", "No limit"), TERMS_PROJECTS),
                    new FeaturesTableFeatures("Users", ImmutableList.of("No limit", "No limit"), null),
                    new FeaturesTableFeatures("Posts", ImmutableList.of("No limit", "No limit"), TERMS_POSTS),
                    new FeaturesTableFeatures("Teammates", ImmutableList.of("All Free", "All Free"), TERMS_ADMINS),
                    new FeaturesTableFeatures("ClearFlask AI", ImmutableList.of("Yes", "Yes"), TERMS_CLEARFLASK_AI),
                    new FeaturesTableFeatures("Credit System", ImmutableList.of("Yes", "Yes"), TERMS_CREDIT_SYSTEM),
                    new FeaturesTableFeatures("Roadmap", ImmutableList.of("Yes", "Yes"), null),
                    new FeaturesTableFeatures("Content customization", ImmutableList.of("Yes", "Yes"), null),
                    new FeaturesTableFeatures("Custom domain", ImmutableList.of("Yes", "Yes"), null),
                    new FeaturesTableFeatures("Private projects", ImmutableList.of("Yes", "Yes"), TERMS_PRIVATE_PROJECTS),
                    new FeaturesTableFeatures("SSO and OAuth", ImmutableList.of("Yes", "Yes"), TERMS_SSO_AND_OAUTH),
                    new FeaturesTableFeatures("GitHub integration", ImmutableList.of("Yes", "Yes"), TERMS_GITHUB),
                    new FeaturesTableFeatures("Intercom integration", ImmutableList.of("Yes", "Yes"), TERMS_INTERCOM),
                    new FeaturesTableFeatures("Tracking integrations", ImmutableList.of("Yes", "Yes"), TERMS_TRACKING),
                    new FeaturesTableFeatures("Site template", ImmutableList.of("Yes", "Yes"), TERMS_SITE_TEMPLATE),
                    new FeaturesTableFeatures("API", ImmutableList.of("Yes", "Yes"), TERMS_API),
                    new FeaturesTableFeatures("Whitelabel", ImmutableList.of("Yes", "Yes"), TERMS_WHITELABEL),
                    new FeaturesTableFeatures("Search engine", ImmutableList.of("Yes", "Yes"), TERMS_ELASTICSEARCH),
                    new FeaturesTableFeatures("Support & SLA", ImmutableList.of("No", "Yes"), null)
            ), null);
}
