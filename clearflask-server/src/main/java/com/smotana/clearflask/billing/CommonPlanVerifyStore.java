// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.primitives.Longs;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.api.model.Whitelabel;
import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.RemoteLicenseStore;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;

@Slf4j
@Singleton
public class CommonPlanVerifyStore implements PlanVerifyStore {

    public static final ImmutableSet<String> PLANS_WITHOUT_DIGEST = ImmutableSet.<String>builder()
            // License only plans don't need digest
            .addAll(KillBillPlanStore.SELFHOST_SERVICE_PLANS)
            // These are not allowed
            // Mostly legacy lifetime plans
            .add("starter-unlimited")
            .add("standard-unlimited")
            .add("standard2-unlimited")
            .add("pitchground-a-lifetime")
            .add("pitchground-b-lifetime")
            .add("pitchground-c-lifetime")
            .add("pitchground-d-lifetime")
            .add("pitchground-e-lifetime")
            .add("pro-lifetime")
            .add("lifetime-lifetime")
            // Legacy selfhost plan
            .add("self-host")
            .build();

    @Inject
    private Billing billing;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private Environment env;

    @Override
    public boolean verifyAccountAllowedDigest(Account account, String projectId) throws ApiException {
        if (PLANS_WITHOUT_DIGEST.contains(account.getPlanid())) {
            return false;
        }
        if (account.getDigestOptOutForProjectIds().contains(projectId)) {
            return false;
        }
        return true;
    }

    @Override
    public void verifyAccountMeetsPlanRestrictions(String planId, String accountId) throws ApiException {
        Account account = accountStore.getAccount(accountId, true).get();
        account.getProjectIds().stream()
                .map(projectId -> projectStore.getProject(projectId, true))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .forEach(project -> {
                    verifyConfigMeetsPlanRestrictions(planId, accountId, project.getVersionedConfigAdmin().getConfig());
                });

        verifyTeammateInviteMeetsPlanRestrictions(planId, accountId, false);

        verifyAccountMeetsLimits(planId, accountId);

        verifyProjectCountMeetsPlanRestrictions(planId, accountId, false);

        if (!Strings.isNullOrEmpty(account.getApiKey())) {
            verifyActionMeetsPlanRestrictions(planId, accountId, Action.API_KEY);
        }

        verifyPlanMeetsLicense(planId, accountId);
    }

    @Override
    public void verifyPlanMeetsLicense(String planId, String accountId) {
        if ("selfhost-licensed".equals(planId) && Environment.PRODUCTION_SELF_HOST.equals(env)) {
            Optional<Boolean> licenseValidation = ServiceInjector.INSTANCE.get().getInstance(RemoteLicenseStore.class)
                    .validateLicenseRemotely(true);
            if (licenseValidation.isEmpty()) {
                throw new RequiresUpgradeException("Please add a purchased license on your account first");
            }
            if (!licenseValidation.get()) {
                throw new RequiresUpgradeException("The license on your account is invalid");
            }
        }
    }

    @Override
    public void verifyAccountMeetsLimits(String planId, String accountId) throws ApiException {
        if (isAccountExceedsPostLimit(planId, accountId)) {
            throw new RequiresUpgradeException("cloud-monthly", "Maximum number of posts reached, please delete old ones");
        }
    }

    @Override
    public boolean isAccountExceedsPostLimit(String planId, String accountId) {
        Optional<Long> maxPostsOpt = Optional.ofNullable(
                KillBillPlanStore.PLAN_MAX_POSTS.get(planStore.getBasePlanId(planId)));
        if (maxPostsOpt.isPresent()
                && accountStore.getPostCountForAccount(accountId) > maxPostsOpt.get()) {
            return true;
        }
        return false;
    }

    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    @Override
    public void verifyActionMeetsPlanRestrictions(String planId, String accountId, Action action) throws RequiresUpgradeException {
        Account account = accountStore.getAccount(accountId, true).get();

        if (Action.CREATE_PROJECT.equals(action)) {
            verifyProjectCountMeetsPlanRestrictions(planId, accountId, true);
        }

        switch (planStore.getBasePlanId(planId)) {
            case PlanStore.TEAMMATE_PLAN_ID:
                switch (action) {
                    case CREATE_PROJECT:
                        throw new RequiresUpgradeException("Not allowed to create projects without a plan");
                    case API_KEY:
                        throw new RequiresUpgradeException("Not allowed to use API without a plan");
                }
                return;
            case "starter-unlimited":
            case "starter3-monthly":
            case "growth-monthly":
            case "growth2-monthly":
            case "pitchground-a-lifetime":
            case "pitchground-b-lifetime":
            case "cloud-free":
            case "cloud-starter-monthly":
            case "cloud-monthly":
            case "selfhost-free":
                switch (action) {
                    case API_KEY:
                        throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use API on your plan");
                }
                return;
            default:
                // No restriction
        }
    }

    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    @Override
    public void verifyConfigMeetsPlanRestrictions(String planId, String accountId, ConfigAdmin config) throws RequiresUpgradeException {
        ImmutableMap<String, String> addons = accountStore.getAccount(accountId, true)
                .map(Account::getAddons)
                .orElse(ImmutableMap.of());
        boolean hasAddonWhitelabel = "true".equals(addons.get(KillBillPlanStore.ADDON_WHITELABEL));
        boolean hasAddonPrivateProjects = "true".equals(addons.get(KillBillPlanStore.ADDON_PRIVATE_PROJECTS));

        switch (planStore.getBasePlanId(planId)) {
            case PlanStore.TEAMMATE_PLAN_ID:
                throw new RequiresUpgradeException("Not allowed to have projects without a plan");
            case "cloud-free":
            case "cloud-starter-monthly":
                // Restrict Custom domain
                if (!Strings.isNullOrEmpty(config.getDomain())) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use Custom Domain on your plan");
                }
                // Rollover to next case
            case "starter-unlimited":
            case "starter3-monthly":
            case "growth-monthly":
            case "growth2-monthly":
            case "pro-lifetime":
            case "selfhost-free":
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Not allowed to Whitelabel Powered By on your plan");
                }
                // Restrict OAuth
                if (!config.getUsers().getOnboarding().getNotificationMethods().getOauth().isEmpty()) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use OAuth on your plan");
                }
                // Restrict Single Sign-On
                if (config.getUsers().getOnboarding().getNotificationMethods().getSso() != null) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use SSO on your plan");
                }
                // Restrict Private projects
                if (!hasAddonPrivateProjects && config.getUsers().getOnboarding().getVisibility() == Onboarding.VisibilityEnum.PRIVATE) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use Private visibility on your plan");
                }
                // Restrict Site template
                if (config.getStyle().getTemplates() != null) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use Templates on your plan");
                }
                // Restrict Integrations
                if (config.getGithub() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use GitHub integration on your plan");
                }
                if (config.getIntegrations().getGoogleAnalytics() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use Google Analytics integration on your plan");
                }
                if (config.getIntegrations().getHotjar() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use HotJar integration on your plan");
                }
                if (config.getIntegrations().getIntercom() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use Intercom integration on your plan");
                }
                // Restrict No Index
                if (config.getNoIndex() == Boolean.TRUE) {
                    throw new RequiresUpgradeException("Not allowed to disable Search Indexing on your plan");
                }
                return;
            case "pitchground-a-lifetime":
            case "pitchground-b-lifetime":
                // Restrict OAuth
                if (!config.getUsers().getOnboarding().getNotificationMethods().getOauth().isEmpty()) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use OAuth on your plan");
                }
                // Restrict Single Sign-On
                if (config.getUsers().getOnboarding().getNotificationMethods().getSso() != null) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use SSO on your plan");
                }
                // Restrict Private projects
                if (!hasAddonPrivateProjects && config.getUsers().getOnboarding().getVisibility() == Onboarding.VisibilityEnum.PRIVATE) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use Private visibility on your plan");
                }
                // Restrict Site template
                if (config.getStyle().getTemplates() != null) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use Templates on your plan");
                }
                // Restrict Integrations
                if (config.getGithub() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use GitHub integration on your plan");
                }
                if (config.getIntegrations().getGoogleAnalytics() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use Google Analytics integration on your plan");
                }
                if (config.getIntegrations().getHotjar() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use HotJar integration on your plan");
                }
                if (config.getIntegrations().getIntercom() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use Intercom integration on your plan");
                }
                // rollover to next case
            case "pitchground-c-lifetime":
            case "pitchground-d-lifetime":
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to Whitelabel Powered By on your plan");
                }
                // rollover to next case
            case "pitchground-e-lifetime":
                break;
            case "standard-monthly":
            case "standard2-monthly":
            case "standard-unlimited":
            case "flat-yearly":
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to Whitelabel Powered By on your plan");
                }
                break;
            case "cloud-monthly":
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to Whitelabel Powered By on your plan");
                }
                // Restrict Integrations
                if (config.getGithub() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use GitHub integration on your plan");
                }
                if (config.getIntegrations().getGoogleAnalytics() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use Google Analytics integration on your plan");
                }
                if (config.getIntegrations().getHotjar() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use HotJar integration on your plan");
                }
                if (config.getIntegrations().getIntercom() != null) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to use Intercom integration on your plan");
                }
                break;
            case "standard2-unlimited":
                // Restrict Private projects
                if (!hasAddonPrivateProjects && config.getUsers().getOnboarding().getVisibility() == Onboarding.VisibilityEnum.PRIVATE) {
                    throw new RequiresUpgradeException("cloud-monthly", "Not allowed to use Private visibility on your plan");
                }
                // Restrict Whitelabel
                if (!hasAddonWhitelabel && !Whitelabel.PoweredByEnum.SHOW.equals(config.getStyle().getWhitelabel().getPoweredBy())) {
                    throw new RequiresUpgradeException("cloud-yearly", "Not allowed to Whitelabel Powered By on your plan");
                }
                break;
            case "sponsor-monthly":
            case "lifetime-lifetime":
            case "lifetime2-lifetime":
            case "standard3-monthly":
            case "cloud-yearly":
            case "selfhost-licensed":
                break;
        }
    }

    @Override
    public void verifyConfigChangeMeetsRestrictions(boolean isSuperAdmin, Optional<ConfigAdmin> configAdminPreviousOpt, ConfigAdmin configAdmin) throws ApiException {
        // Allow Super admins and all of selfhost to change search engine
        if ((!isSuperAdmin && env != Environment.PRODUCTION_SELF_HOST)
                && !configAdminPreviousOpt
                .flatMap(ca -> Optional.ofNullable(ca.getForceSearchEngine()))
                .equals(Optional.ofNullable(configAdmin.getForceSearchEngine()))) {
            throw new RequiresUpgradeException("Not allowed to change search engine");
        }
    }

    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    @Override
    public void verifyTeammateInviteMeetsPlanRestrictions(String planId, String accountId, boolean addOne) throws ApiException {
        Optional<Long> teammateLimitOpt = Optional.empty();
        String requiredPlanId = "cloud-monthly";
        switch (planStore.getBasePlanId(planId)) {
            case "selfhost-free":
                teammateLimitOpt = Optional.of(3L);
                requiredPlanId = ""; // Not upgradeable
                break;
            case "starter-unlimited":
            case "pro-lifetime":
            case "pitchground-a-lifetime":
            case "cloud-free":
            case "cloud-starter-free":
                teammateLimitOpt = Optional.of(1L);
                break;
            case "pitchground-b-lifetime":
                teammateLimitOpt = Optional.of(3L);
                break;
            case "pitchground-c-lifetime":
                teammateLimitOpt = Optional.of(5L);
                break;
            case "growth-monthly":
            case "growth2-monthly":
                teammateLimitOpt = Optional.of(KillBillPlanStore.GROWTH_MAX_TEAMMATES);
                break;
            case "standard-monthly":
            case "standard2-monthly":
                teammateLimitOpt = Optional.of(KillBillPlanStore.STANDARD_MAX_TEAMMATES);
                break;
            case "pitchground-d-lifetime":
                teammateLimitOpt = Optional.of(10L);
                break;
            case "pitchground-e-lifetime":
                teammateLimitOpt = Optional.of(25L);
                break;
            case "standard2-unlimited":
                teammateLimitOpt = Optional.of(3L);
                break;
            case "lifetime2-lifetime":
                teammateLimitOpt = Optional.of(KillBillPlanStore.LIFETIME_MAX_TEAMMATES);
                requiredPlanId = ""; // Not upgradeable
                break;
            case "starter3-monthly":
            case "standard3-monthly":
            case "standard-unlimited":
            case "flat-yearly":
            case "sponsor-monthly":
            case "lifetime-lifetime":
            case "selfhost-licensed":
            case "cloud-monthly":
            case "cloud-yearly":
                break; // No limit
            default:
                if (LogUtil.rateLimitAllowLog("killbillplanstore-teammates-unknown-limit")) {
                    log.warn("Plan {} has no defined teammate limit", planStore.getBasePlanId(planId));
                }
        }

        // Project Addons
        ImmutableMap<String, String> addons = accountStore.getAccount(accountId, true)
                .map(Account::getAddons)
                .orElse(ImmutableMap.of());
        long addonExtraTeammateCount = Optional.ofNullable(addons.get(KillBillPlanStore.ADDON_EXTRA_TEAMMATE))
                .flatMap(addonExtraProjectCountStr -> Optional.ofNullable(Longs.tryParse(addonExtraProjectCountStr)))
                .orElse(0L);
        teammateLimitOpt = teammateLimitOpt.map(planLimit -> planLimit + addonExtraTeammateCount);

        if (teammateLimitOpt.isPresent()) {
            if (teammateLimitOpt.get() <= 1L) {
                if (addOne || getCurrentTeammateCount(accountId) > 1L) {
                    throw new RequiresUpgradeException(requiredPlanId, "Your plan has reached the teammate limit");
                }
            } else {
                if ((getCurrentTeammateCount(accountId) + (addOne ? 1 : 0)) > teammateLimitOpt.get()) {
                    throw new RequiresUpgradeException(requiredPlanId, "Your plan has reached the teammate limit");
                }
            }
        }
    }

    private long getCurrentTeammateCount(String accountId) {
        // Find all projects owned by this account
        ImmutableSet<String> projectIds = accountStore.getAccount(accountId, true)
                .orElseThrow()
                .getProjectIds();

        // Find all admins on those projects
        Set<String> adminAccountIds = Sets.newHashSet();
        projectIds.stream()
                .map(projectId -> projectStore.getProject(projectId, true).orElseThrow())
                .flatMap(project -> project.getModel().getAdminsAccountIds().stream())
                .forEach(adminAccountIds::add);
        // Include the account itself
        adminAccountIds.add(accountId);
        // Count all unique (by id) admins
        long adminCount = adminAccountIds.size();

        // Find all unique (by email) invitations that are not yet accepted
        long pendingInvitationCount = projectIds.stream()
                .flatMap(projectId -> projectStore.getInvitations(projectId).stream())
                .filter(Predicate.not(ProjectStore.InvitationModel::isAccepted))
                .map(ProjectStore.InvitationModel::getInvitedEmail)
                .distinct()
                .count();

        // Sum up admins and pending invitations
        return adminCount + pendingInvitationCount;
    }

    /**
     * If changed, also change in UpgradeWrapper.tsx
     */
    @Override
    public void verifyProjectCountMeetsPlanRestrictions(String planId, String accountId, boolean addOne) throws ApiException {
        Optional<Long> projectCountLimitOpt = Optional.empty();

        if (KillBillPlanStore.SELFHOST_SERVICE_PLANS.contains(planId)) {
            projectCountLimitOpt = Optional.of(0L);
        } else {
            switch (planStore.getBasePlanId(planId)) {
                case "pro-lifetime":
                case "pitchground-a-lifetime":
                case "pitchground-b-lifetime":
                    projectCountLimitOpt = Optional.of(1L);
                    break;
                case "pitchground-c-lifetime":
                    projectCountLimitOpt = Optional.of(5L);
                    break;
                default:
                    break;
            }
        }

        // Project Addons
        ImmutableMap<String, String> addons = accountStore.getAccount(accountId, true)
                .map(Account::getAddons)
                .orElse(ImmutableMap.of());
        long addonExtraProjectCount = Optional.ofNullable(addons.get(KillBillPlanStore.ADDON_EXTRA_PROJECT))
                .flatMap(addonExtraProjectCountStr -> Optional.ofNullable(Longs.tryParse(addonExtraProjectCountStr)))
                .orElse(0L);
        projectCountLimitOpt = projectCountLimitOpt.map(planLimit -> planLimit + addonExtraProjectCount);

        if (projectCountLimitOpt.isPresent()) {
            long projectCount = accountStore.getAccount(accountId, true).get()
                    .getProjectIds().size();
            if ((projectCount + (addOne ? 1 : 0)) > projectCountLimitOpt.get()) {
                throw new RequiresUpgradeException("Your plan has reached project limit");
            }
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PlanVerifyStore.class).to(CommonPlanVerifyStore.class).asEagerSingleton();
            }
        };
    }
}
