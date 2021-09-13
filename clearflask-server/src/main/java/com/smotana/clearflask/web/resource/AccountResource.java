// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.api.AccountAdminApi;
import com.smotana.clearflask.api.AccountSuperAdminApi;
import com.smotana.clearflask.api.PlanApi;
import com.smotana.clearflask.api.model.AccountAcceptInvitationResponse;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountBilling;
import com.smotana.clearflask.api.model.AccountBillingPayment;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.AccountBindAdmin;
import com.smotana.clearflask.api.model.AccountBindAdminResponse;
import com.smotana.clearflask.api.model.AccountLogin;
import com.smotana.clearflask.api.model.AccountLoginAs;
import com.smotana.clearflask.api.model.AccountSearchResponse;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdmin;
import com.smotana.clearflask.api.model.AccountUpdateSuperAdmin;
import com.smotana.clearflask.api.model.InvitationResult;
import com.smotana.clearflask.api.model.InvoiceHtmlResponse;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.LegalResponse;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.Billing.Gateway;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.billing.RequiresUpgradeException;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.AccountStore.SearchAccountsResponse;
import com.smotana.clearflask.store.LegalStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.InvitationModel;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.OAuthUtil;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;
import org.joda.time.DateTimeZone;
import org.joda.time.LocalDate;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.model.gen.Subscription;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class AccountResource extends AbstractResource implements AccountAdminApi, AccountSuperAdminApi, PlanApi {

    public AccountResource() {
    }

    public interface Config {
        @DefaultValue("P30D")
        Duration sessionExpiry();

        @DefaultValue("P20D")
        Duration sessionRenewIfExpiringIn();

        @DefaultValue("789180657123-biqq6mkgvrkirava961ujkacni5qebuf.apps.googleusercontent.com")
        String oauthGoogleClientId();

        @NoDefaultValue
        String oauthGoogleClientSecret();

        @DefaultValue("2c6e8437eaa489e69c38")
        String oauthGithubClientId();

        @NoDefaultValue
        String oauthGithubClientSecret();

        @DefaultValue("true")
        boolean signupEnabled();
    }

    public static final String SUPER_ADMIN_AUTH_COOKIE_NAME = "cf_sup_auth";
    public static final String ACCOUNT_AUTH_COOKIE_NAME = "cf_act_auth";

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Environment env;
    @Inject
    private Gson gson;
    @Inject
    private ProjectResource projectResource;
    @Inject
    private Billing billing;
    @Inject
    private AccountStore accountStore;
    @Inject
    private UserStore userStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private LegalStore legalStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private PasswordUtil passwordUtil;
    @Inject
    private AuthCookie authCookie;
    @Inject
    private ClearFlaskSso cfSso;
    @Inject
    private SuperAdminPredicate superAdminPredicate;
    @Inject
    private NotificationService notificationService;
    @Inject
    private IntercomUtil intercomUtil;

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public AccountBindAdminResponse accountBindAdmin(AccountBindAdmin accountBindAdmin) {
        Optional<Account> accountOpt = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false));
        Optional<Account> superAccountOpt = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedSuperAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false));

        // Token refresh
        Optional<AccountSession> accountSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt);
        if (accountSessionOpt.isPresent() && accountSessionOpt.get().getTtlInEpochSec() < Instant.now().plus(config.sessionRenewIfExpiringIn()).getEpochSecond()) {
            accountSessionOpt = Optional.of(accountStore.refreshSession(
                    accountSessionOpt.get(),
                    Instant.now().plus(config.sessionExpiry()).getEpochSecond()));

            authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSessionOpt.get().getSessionId(), accountSessionOpt.get().getTtlInEpochSec());
        }
        Optional<AccountSession> superAccountSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getSuperAccountSessionOpt);
        if (superAccountSessionOpt.isPresent()) {
            if (superAccountSessionOpt.get().getTtlInEpochSec() < Instant.now().plus(config.sessionRenewIfExpiringIn()).getEpochSecond()) {
                superAccountSessionOpt = Optional.of(accountStore.refreshSession(
                        superAccountSessionOpt.get(),
                        Instant.now().plus(config.sessionExpiry()).getEpochSecond()));

                authCookie.setAuthCookie(response, SUPER_ADMIN_AUTH_COOKIE_NAME, superAccountSessionOpt.get().getSessionId(), superAccountSessionOpt.get().getTtlInEpochSec());
            }
        }

        boolean created = false;
        if (accountOpt.isEmpty()
                && accountBindAdmin != null
                && accountBindAdmin.getOauthToken() != null) {
            Optional<OAuthUtil.OAuthResult> oauthResult;
            // Matches mock "bathtub" OAuth provider defined in oauthUtil.ts
            if (!env.isProduction() && "bathtub".equals(accountBindAdmin.getOauthToken().getId())) {
                Map<String, String> codeParsed = gson.fromJson(accountBindAdmin.getOauthToken().getCode(), new TypeToken<Map<String, String>>() {
                }.getType());
                oauthResult = Optional.of(new OAuthUtil.OAuthResult(
                        codeParsed.get("guid"),
                        Optional.ofNullable(codeParsed.get("name")),
                        Optional.ofNullable(codeParsed.get("email"))));
            } else {
                String tokenUrl;
                String userProfileUrl;
                String clientSecret;
                String guidJsonPath;
                String nameJsonPath;
                String emailUrl;
                String emailJsonPath;
                if (config.oauthGithubClientId().equals(accountBindAdmin.getOauthToken().getId())) {
                    tokenUrl = "https://github.com/login/oauth/access_token";
                    userProfileUrl = "https://api.github.com/user";
                    guidJsonPath = "id";
                    nameJsonPath = "['name','login']";
                    emailUrl = "https://api.github.com/user/emails";
                    emailJsonPath = "[?(@.verified == true)][?(@.primary == true)].email";
                    clientSecret = config.oauthGithubClientSecret();
                } else if (config.oauthGoogleClientId().equals(accountBindAdmin.getOauthToken().getId())) {
                    tokenUrl = "https://www.googleapis.com/oauth2/v4/token";
                    userProfileUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
                    guidJsonPath = "id";
                    nameJsonPath = "name";
                    emailUrl = "";
                    emailJsonPath = "email";
                    clientSecret = config.oauthGoogleClientSecret();
                } else {
                    throw new ApiException(Response.Status.BAD_REQUEST, "OAuth provider not supported");
                }
                oauthResult = OAuthUtil.fetch(
                        gson,
                        "account",
                        "https://" + configApp.domain() + "/login",
                        tokenUrl,
                        userProfileUrl,
                        guidJsonPath,
                        nameJsonPath,
                        emailUrl,
                        emailJsonPath,
                        accountBindAdmin.getOauthToken().getId(),
                        clientSecret,
                        accountBindAdmin.getOauthToken().getCode());
            }
            if (oauthResult.isPresent()) {
                accountOpt = accountStore.getAccountByOauthGuid(oauthResult.get().getGuid());
                if (accountOpt.isEmpty()) {
                    String email = oauthResult.get().getEmailOpt().orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST,
                            "OAuth provider did not give us your email, please sign up using an email directly."));
                    if (!accountStore.isEmailAvailable(email)) {
                        throw new ApiException(Response.Status.CONFLICT, "Your account does not use this OAuth provider.");
                    }
                    accountOpt = Optional.of(createAccount(
                            email,
                            oauthResult.get().getNameOpt()
                                    .or(() -> Optional.ofNullable(Strings.emptyToNull(StringUtils.capitalize(email.replaceFirst("^[^a-zA-Z]*?([a-zA-Z]+).*?$", "$1")))))
                                    .orElse("No name"),
                            Optional.empty(),
                            Optional.of(oauthResult.get().getGuid()),
                            Optional.ofNullable(Strings.emptyToNull(accountBindAdmin.getOauthToken().getInvitationId())),
                            Optional.ofNullable(Strings.emptyToNull(accountBindAdmin.getOauthToken().getBasePlanId()))));
                    created = true;
                }
            }
        }

        return new AccountBindAdminResponse(
                accountOpt.or(() -> superAccountOpt)
                        .map(account -> account.toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate))
                        .orElse(null),
                superAccountOpt.isPresent(),
                created);
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 5)
    @Override
    public AccountAdmin accountLoginAdmin(AccountLogin credentials) {
        sanitizer.email(credentials.getEmail());

        Optional<Account> accountOpt = accountStore.getAccountByEmail(credentials.getEmail());
        if (!accountOpt.isPresent()) {
            log.info("Account login with non-existent email {}", credentials.getEmail());
            throw new ApiException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        Account account = accountOpt.get();

        if (Strings.isNullOrEmpty(account.getPassword())) {
            log.info("Account login with password for OAuth account with email {}", credentials.getEmail());
            throw new ApiException(Response.Status.UNAUTHORIZED, "You must login using OAuth provider.");
        }

        String passwordSupplied = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, credentials.getPassword(), account.getEmail());
        if (!account.getPassword().equals(passwordSupplied)) {
            log.info("Account login incorrect password for email {}", credentials.getEmail());
            throw new ApiException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        log.debug("Successful account login for email {}", credentials.getEmail());

        AccountStore.AccountSession accountSession = accountStore.createSession(
                account,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        if (superAdminPredicate.isEmailSuperAdmin(account.getEmail())) {
            authCookie.setAuthCookie(response, SUPER_ADMIN_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        }

        return account.toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate);
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public void accountLogoutAdmin() {
        Optional<String> accountSessionIdOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).map(AccountSession::getAccountId);
        Optional<String> superAdminSessionIdOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getSuperAccountSessionOpt).map(AccountSession::getAccountId);

        log.debug("Logout session for accountId {} superAdminAccountId {}",
                accountSessionIdOpt, superAdminSessionIdOpt);

        Arrays.stream(request.getCookies())
                .filter(c -> c.getName().startsWith(UserResource.USER_AUTH_COOKIE_NAME_PREFIX)
                        && !Strings.isNullOrEmpty(c.getValue()))
                .forEach(c -> {
                    userStore.revokeSession(c.getValue());
                    authCookie.unsetAuthCookie(response, c.getName());
                });

        accountSessionIdOpt.ifPresent(accountStore::revokeSession);
        accountSessionIdOpt.ifPresent(superAdminSessionId ->
                authCookie.unsetAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME));

        if (!accountSessionIdOpt.equals(superAdminSessionIdOpt)) {
            superAdminSessionIdOpt.ifPresent(accountStore::revokeSession);
        }
        superAdminSessionIdOpt.ifPresent(superAdminSessionId ->
                authCookie.unsetAuthCookie(response, SUPER_ADMIN_AUTH_COOKIE_NAME));
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public AccountAdmin accountSignupAdmin(AccountSignupAdmin signup) {
        Account account = createAccount(
                signup.getEmail(),
                signup.getName(),
                Optional.of(signup.getPassword()),
                Optional.empty(),
                Optional.ofNullable(Strings.emptyToNull(signup.getInvitationId())),
                Optional.of(signup.getBasePlanId())
        );

        return account.toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate);
    }

    private Account createAccount(
            String email,
            String name,
            Optional<String> passwordOpt,
            Optional<String> guidOpt,
            Optional<String> invitationIdOpt,
            Optional<String> preferredPlanIdOpt) {
        if (!config.signupEnabled()) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Signups are disabled");
        }

        checkState(guidOpt.isPresent() || passwordOpt.isPresent());
        sanitizer.email(email);
        sanitizer.accountName(name);

        if (env == Environment.PRODUCTION_SELF_HOST && !superAdminPredicate.isEmailSuperAdmin(email)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Only super admins are allowed to sign up");
        }

        // Pre-accept any invitation
        String accountId = accountStore.genAccountId();
        ImmutableSet<String> externalProjectIds = invitationIdOpt
                .map(invitationId -> projectStore.acceptInvitation(invitationId, accountId))
                .stream()
                .collect(ImmutableSet.toImmutableSet());
        boolean isTeammate = !externalProjectIds.isEmpty();

        // Find preferred plan, otherwise find a first plan we find
        String planId = isTeammate
                ? PlanStore.TEAMMATE_PLAN_ID
                : preferredPlanIdOpt.flatMap(pId -> planStore.getPublicPlans().getPlans().stream()
                .filter(p -> p.getBasePlanId().equals(pId))
                .filter(p -> p.getComingSoon() != Boolean.TRUE)
                .findAny())
                .orElseGet(() -> planStore.getPublicPlans().getPlans().stream()
                        .filter(p -> p.getComingSoon() != Boolean.TRUE)
                        .findFirst()
                        .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Signups are disabled")))
                .getBasePlanId();

        // Create account locally
        Account account = new Account(
                accountId,
                email,
                isTeammate
                        ? SubscriptionStatus.ACTIVE // Teammate plan is trialless and unlimited
                        : SubscriptionStatus.ACTIVETRIAL, // Assume it's a trial
                null,
                planId,
                Instant.now(),
                name,
                passwordOpt.map(password -> passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, password, email)).orElse(null),
                ImmutableSet.of(),
                externalProjectIds,
                guidOpt.orElse(null),
                ImmutableMap.of());
        account = accountStore.createAccount(account).getAccount();

        // Create customer in KillBill asynchronously because:
        // - It takes too long
        // - Had spurious errors that prevented users from signing up
        billing.createAccountWithSubscriptionAsync(account);

        // Create auth session
        AccountStore.AccountSession accountSession = accountStore.createSession(
                account,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        if (superAdminPredicate.isEmailSuperAdmin(account.getEmail())) {
            authCookie.setAuthCookie(response, SUPER_ADMIN_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        }

        notificationService.onAccountSignup(account);

        return account;
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public AccountAdmin accountUpdateAdmin(AccountUpdateAdmin accountUpdateAdmin) {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false))
                .get();
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getName())) {
            sanitizer.accountName(accountUpdateAdmin.getName());
            account = accountStore.updateName(account.getAccountId(), accountUpdateAdmin.getName()).getAccount();
        }
        if (accountUpdateAdmin.getAttrs() != null && !accountUpdateAdmin.getAttrs().isEmpty()) {
            account = accountStore.updateAttrs(account.getAccountId(), accountUpdateAdmin.getAttrs(), account.getAttrs() == null || account.getAttrs().isEmpty());
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getApiKey())) {
            // Check if it already exists
            Optional<Account> accountOtherOpt = accountStore.getAccountByApiKey(accountUpdateAdmin.getApiKey());
            if (accountOtherOpt.isPresent()) {
                if (!accountOtherOpt.get().getAccountId().equals(account.getAccountId())) {
                    log.error("Account {} tried to set same API key as account {}, notify the account of compromised key",
                            account.getEmail(), accountOtherOpt.get().getEmail());
                    // Throw invalid format rather than telling them that they guessed someone else's API key
                    throw new ApiException(Response.Status.BAD_REQUEST, "API key has invalid format, create another");
                }
            }
            try {
                planStore.verifyActionMeetsPlanRestrictions(account.getPlanid(), PlanStore.Action.API_KEY);
            } catch (RequiresUpgradeException ex) {
                if (!billing.tryAutoUpgradePlan(account, ex.getRequiredPlanId())) {
                    throw ex;
                }
            }
            account = accountStore.updateApiKey(account.getAccountId(), accountUpdateAdmin.getApiKey());
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getPassword())) {
            String passwordHashed = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, accountUpdateAdmin.getPassword(), account.getEmail());
            account = accountStore.updatePassword(account.getAccountId(), passwordHashed, getExtendedPrincipal()
                    .flatMap(ExtendedPrincipal::getAccountSessionOpt)
                    .map(AccountSession::getSessionId));
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getEmail())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Email cannot be changed, please contact support");
            // TODO Fix bug in email update requires password to be rehashed
//            sanitizer.email(accountUpdateAdmin.getEmail());
//            account = accountStore.updateEmail(account.getAccountId(), accountUpdateAdmin.getEmail(), accountSession.getSessionId()).getAccount();
        }
        boolean alsoResume = false;
        if (accountUpdateAdmin.getPaymentToken() != null) {
            Optional<Gateway> gatewayOpt = Arrays.stream(Gateway.values())
                    .filter(g -> g.getPluginName().equals(accountUpdateAdmin.getPaymentToken().getType()))
                    .findAny();

            if (!gatewayOpt.isPresent()
                    || (env.isProduction() && !gatewayOpt.get().isAllowedInProduction())) {
                log.warn("Account update payment token fails with invalid gateway type {}", accountUpdateAdmin.getPaymentToken().getType());
                throw new ApiException(Response.Status.BAD_REQUEST, "Invalid payment gateway");
            }
            billing.updatePaymentToken(account.getAccountId(), gatewayOpt.get(), accountUpdateAdmin.getPaymentToken().getToken());

            if (account.getStatus() == SubscriptionStatus.ACTIVENORENEWAL) {
                alsoResume = true;
            }
        }
        if (accountUpdateAdmin.getCancelEndOfTerm() == Boolean.TRUE) {
            Subscription subscription = billing.cancelSubscription(account.getAccountId());
            SubscriptionStatus newStatus = billing.updateAndGetEntitlementStatus(
                    account.getStatus(),
                    billing.getAccount(account.getAccountId()),
                    subscription,
                    "user requested cancel");
        }
        if (accountUpdateAdmin.getResume() == Boolean.TRUE || alsoResume) {
            Subscription subscription = billing.resumeSubscription(account.getAccountId());
            SubscriptionStatus newStatus = billing.updateAndGetEntitlementStatus(
                    account.getStatus(),
                    billing.getAccount(account.getAccountId()),
                    subscription,
                    alsoResume ? "user requested update payment and resume" : "user requested resume");
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getBasePlanId())) {
            String newPlanid = accountUpdateAdmin.getBasePlanId();
            Optional<Plan> newPlanOpt = planStore.getAccountChangePlanOptions(account.getAccountId()).stream()
                    .filter(p -> p.getBasePlanId().equals(newPlanid))
                    .findAny();
            if (!newPlanOpt.isPresent() || newPlanOpt.get().getComingSoon() == Boolean.TRUE) {
                log.warn("Account {} not allowed to change plans to {}",
                        account.getAccountId(), newPlanid);
                throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot change to this plan");
            }

            planStore.verifyAccountMeetsPlanRestrictions(newPlanid, account.getAccountId());

            Subscription subscription = billing.changePlan(account.getAccountId(), newPlanid);
            // Only update account if plan was changed immediately, as oppose to end of term
            if (newPlanid.equals(subscription.getPlanName())) {
                account = accountStore.setPlan(account.getAccountId(), newPlanid).getAccount();
            } else if (!newPlanid.equals((billing.getEndOfTermChangeToPlanId(subscription).orElse(null)))) {
                if (LogUtil.rateLimitAllowLog("accountResource-planChangeMismatch")) {
                    log.warn("Plan change to {} doesnt seem to reflect killbill, accountId {} subscriptionId {} subscription plan {}",
                            newPlanid, account.getAccountId(), subscription.getSubscriptionId(), subscription.getPlanName());
                }
            }
        }
        return account.toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate);
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public InvitationResult accountViewInvitationAdmin(String invitationId) {
        Optional<String> accountIdOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt);
        InvitationModel invitation = projectStore.getInvitation(invitationId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Invitation expired"));

        // If accepted by someone else, pretend it's expired
        if (!Strings.isNullOrEmpty(invitation.getIsAcceptedByAccountId())
                && (accountIdOpt.isEmpty() || !invitation.getIsAcceptedByAccountId().equals(accountIdOpt.get()))) {
            throw new ApiException(Response.Status.NOT_FOUND, "Invitation expired");
        }

        return new InvitationResult(
                invitation.getInviteeName(),
                invitation.getProjectName(),
                InvitationResult.RoleEnum.ADMIN,
                invitation.getIsAcceptedByAccountId() != null);
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public AccountAdmin accountUpdateSuperAdmin(AccountUpdateSuperAdmin accountUpdateAdmin) {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false))
                .get();

        if (accountUpdateAdmin.getChangeToFlatPlanWithYearlyPrice() != null) {
            Subscription subscription = billing.changePlanToFlatYearly(account.getAccountId(), accountUpdateAdmin.getChangeToFlatPlanWithYearlyPrice());

            // Sync entitlement status
            SubscriptionStatus status = billing.updateAndGetEntitlementStatus(
                    account.getStatus(),
                    billing.getAccount(account.getAccountId()),
                    subscription,
                    "Change to flat plan");
        }

        return accountStore.getAccount(account.getAccountId(), false).get()
                .toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public InvoiceHtmlResponse invoiceHtmlGetAdmin(String invoiceIdStr) {
        if (invoiceIdStr == null) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Invalid invoice number");
        }
        UUID invoiceId;
        try {
            invoiceId = UUID.fromString(invoiceIdStr);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Invalid invoice number", ex);
        }
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, true))
                .get();
        String invoiceHtml = billing.getInvoiceHtml(account.getAccountId(), invoiceId);
        return new InvoiceHtmlResponse(invoiceHtml);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public Invoices invoicesSearchAdmin(String cursor) {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, true))
                .get();
        return billing.getInvoices(
                account.getAccountId(),
                Optional.ofNullable(Strings.emptyToNull(cursor)));
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 1)
    @Override
    public void accountDeleteAdmin() {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false))
                .get();
        account.getProjectIds().forEach(projectResource::projectDeleteAdmin);
        account.getExternalProjectIds().forEach(projectId -> projectStore.removeAdmin(projectId, account.getAccountId()));
        accountStore.deleteAccount(account.getAccountId());
        billing.closeAccount(account.getAccountId());
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public AccountAcceptInvitationResponse accountAcceptInvitationAdmin(String invitationId) {
        String accountId = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .get();

        String projectId = projectStore.acceptInvitation(invitationId, accountId);
        // This is a critical time, if something happens here, admin may be partially added
        accountStore.addExternalProject(accountId, projectId);

        return new AccountAcceptInvitationResponse(projectId);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public AccountBilling accountBillingAdmin(Boolean refreshPayments) {
        String accountId = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .get();

        if (refreshPayments == Boolean.TRUE) {
            billing.syncActions(accountId);
        }

        Account account = accountStore.getAccount(accountId, false).get();
        org.killbill.billing.client.model.gen.Account kbAccount = billing.getAccount(account.getAccountId());
        Subscription subscription = billing.getSubscription(account.getAccountId());

        // Sync entitlement status
        SubscriptionStatus status = billing.updateAndGetEntitlementStatus(
                account.getStatus(),
                kbAccount,
                subscription,
                "Get account billing");
        if (!account.getStatus().equals(status)) {
            account = accountStore.getAccount(account.getAccountId(), false).get();
        }

        // Sync plan id
        if (!subscription.getPlanName().equals(account.getPlanid())) {
            log.info("Account billing caused accountId {} plan change {} -> {}",
                    account.getAccountId(), account.getPlanid(), subscription.getPlanName());
            account = accountStore.setPlan(account.getAccountId(), subscription.getPlanName()).getAccount();
        }


        Plan plan = planStore.getPlan(account.getPlanid(), Optional.of(subscription)).get();
        ImmutableSet<Plan> availablePlans = planStore.getAccountChangePlanOptions(account.getAccountId());
        Invoices invoices = billing.getInvoices(account.getAccountId(), Optional.empty());
        Optional<Billing.PaymentMethodDetails> paymentMethodDetails = billing.getDefaultPaymentMethodDetails(account.getAccountId());

        Optional<AccountBillingPayment> accountBillingPayment = paymentMethodDetails.map(p -> new AccountBillingPayment(
                p.getCardBrand().orElse(null),
                p.getCardLast4().orElse("****"),
                p.getCardExpiryMonth().orElse(1L),
                p.getCardExpiryYear().orElse(99L)));

        Long trackedUsers = null;
        if (PlanStore.RECORD_TRACKED_USERS_FOR_PLANS.contains(plan.getBasePlanId())) {
            trackedUsers = accountStore.getUserCountForAccount(account.getAccountId());
        }

        Instant billingPeriodEnd = null;
        if (subscription.getPhaseType() == PhaseType.EVERGREEN
                && subscription.getChargedThroughDate() != null) {
            // TODO double check this is the correct time, should it not be at end of day instead?
            billingPeriodEnd = Instant.ofEpochMilli(subscription.getChargedThroughDate()
                    .toDateTimeAtStartOfDay(DateTimeZone.UTC)
                    .toInstant()
                    .getMillis());
        } else if (subscription.getPhaseType() == PhaseType.TRIAL
                && !PlanStore.STOP_TRIAL_FOR_PLANS.contains(subscription.getPlanName())) {

            LocalDate trialStart = subscription.getChargedThroughDate();
            if (trialStart == null) {
                trialStart = subscription.getStartDate();
            }
            trialStart = trialStart.plusDays(14);
            billingPeriodEnd = Instant.ofEpochMilli(trialStart
                    .toDateTimeAtStartOfDay(DateTimeZone.UTC)
                    .toInstant()
                    .getMillis());
        }

        long accountReceivable = kbAccount.getAccountBalance() == null ? 0L : kbAccount.getAccountBalance().longValueExact();
        long accountPayable = kbAccount.getAccountCBA() == null ? 0L : kbAccount.getAccountCBA().longValueExact();

        Optional<Plan> endOfTermChangeToPlan = billing.getEndOfTermChangeToPlanId(subscription)
                .flatMap(planId -> planStore.getPlan(planId, Optional.empty()));

        Optional<AccountBillingPaymentActionRequired> actions = billing.getActions(subscription.getAccountId());

        return new AccountBilling(
                plan,
                status,
                accountBillingPayment.orElse(null),
                billingPeriodEnd,
                (trackedUsers == null || trackedUsers <= 0) ? null : trackedUsers,
                availablePlans.asList(),
                invoices,
                accountReceivable,
                accountPayable,
                endOfTermChangeToPlan.orElse(null),
                actions.orElse(null));
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public void accountNoopAdmin() {
        // Noop
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public AccountAdmin accountLoginAsSuperAdmin(AccountLoginAs accountLoginAs) {
        sanitizer.email(accountLoginAs.getEmail());

        Optional<Account> accountOpt = accountStore.getAccountByEmail(accountLoginAs.getEmail());
        if (!accountOpt.isPresent()) {
            log.info("Account login with non-existent email {}", accountLoginAs.getEmail());
            throw new ApiException(Response.Status.NOT_FOUND, "Account does not exist");
        }
        Account account = accountOpt.get();

        AccountStore.AccountSession accountSession = accountStore.createSession(
                account,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());

        return account.toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate);
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public AccountSearchResponse accountSearchSuperAdmin(AccountSearchSuperAdmin accountSearchSuperAdmin, String cursor) {
        SearchAccountsResponse searchAccountsResponse = accountStore.searchAccounts(
                accountSearchSuperAdmin,
                false,
                Optional.ofNullable(Strings.emptyToNull(cursor)),
                Optional.empty());

        return new AccountSearchResponse(
                searchAccountsResponse.getCursorOpt().orElse(null),
                searchAccountsResponse.getAccounts());
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public LegalResponse legalGet() {
        return new LegalResponse(legalStore.termsOfService(), legalStore.privacyPolicy());
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public PlansGetResponse plansGet() {
        return planStore.getPublicPlans();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AccountResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(AccountResource.class);
            }
        };
    }
}
