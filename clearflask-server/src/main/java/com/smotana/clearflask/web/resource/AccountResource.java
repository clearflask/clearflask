// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.primitives.Longs;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.antispam.AntiSpam;
import com.smotana.clearflask.api.AccountAdminApi;
import com.smotana.clearflask.api.AccountApi;
import com.smotana.clearflask.api.AccountSuperAdminApi;
import com.smotana.clearflask.api.PlanAdminApi;
import com.smotana.clearflask.api.PlanSuperAdminApi;
import com.smotana.clearflask.api.model.AccountAcceptInvitationResponse;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountAttrsUpdateAdmin;
import com.smotana.clearflask.api.model.AccountBilling;
import com.smotana.clearflask.api.model.AccountBillingPayment;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.AccountBindAdmin;
import com.smotana.clearflask.api.model.AccountBindAdminResponse;
import com.smotana.clearflask.api.model.AccountCreditAdjustment;
import com.smotana.clearflask.api.model.AccountDeleteSuperAdmin;
import com.smotana.clearflask.api.model.AccountLogin;
import com.smotana.clearflask.api.model.AccountLoginAs;
import com.smotana.clearflask.api.model.AccountSearchResponse;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdmin;
import com.smotana.clearflask.api.model.AccountUpdateSuperAdmin;
import com.smotana.clearflask.api.model.AllPlansGetResponse;
import com.smotana.clearflask.api.model.AvailableRepos;
import com.smotana.clearflask.api.model.CouponGenerateSuperAdmin;
import com.smotana.clearflask.api.model.InvitationResult;
import com.smotana.clearflask.api.model.InvoiceHtmlResponse;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.LegalResponse;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlanPricingAdmins;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.api.model.ProjectOwnerSwapSuperAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.api.model.ViewCouponResponse;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.Billing.Gateway;
import com.smotana.clearflask.billing.CouponStore;
import com.smotana.clearflask.billing.CouponStore.CouponModel;
import com.smotana.clearflask.billing.KillBillPlanStore;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.billing.PlanStore.PlanWithAddons;
import com.smotana.clearflask.billing.PlanVerifyStore;
import com.smotana.clearflask.billing.RequiresUpgradeException;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.EmailValidator;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.AccountStore.SearchAccountsResponse;
import com.smotana.clearflask.store.GitHubStore;
import com.smotana.clearflask.store.GitLabStore;
import com.smotana.clearflask.store.LegalStore;
import com.smotana.clearflask.store.LocalLicenseStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.InvitationModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.RemoteLicenseStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.ChatwootUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.IpUtil;
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
import org.joda.time.DateTime;
import org.joda.time.DateTimeZone;
import org.joda.time.LocalDate;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.model.gen.EventSubscription;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.entitlement.api.SubscriptionEventType;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.NotFoundException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.StreamingOutput;
import java.io.PrintWriter;
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
public class AccountResource extends AbstractResource implements AccountApi, AccountAdminApi, AccountSuperAdminApi, PlanAdminApi, PlanSuperAdminApi {

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

        /**
         * For testing only, allow signup and plan changes to any plan
         */
        @DefaultValue("false")
        boolean enableNonPublicPlans();
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
    private PlanVerifyStore planVerifyStore;
    @Inject
    private LegalStore legalStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private GitHubStore gitHubStore;
    @Inject
    private GitLabStore gitLabStore;
    @Inject
    private CouponStore couponStore;
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
    @Inject
    private ChatwootUtil chatwootUtil;
    @Inject
    private EmailValidator emailValidator;
    @Inject
    private RemoteLicenseStore remoteLicenseStore;
    @Inject
    private LocalLicenseStore localLicenseStore;
    @Inject
    private AntiSpam antiSpam;

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

            authCookie.setAuthCookie(request, response, ACCOUNT_AUTH_COOKIE_NAME, accountSessionOpt.get().getSessionId(), accountSessionOpt.get().getTtlInEpochSec());
        }
        Optional<AccountSession> superAccountSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getSuperAccountSessionOpt);
        if (superAccountSessionOpt.isPresent()) {
            if (superAccountSessionOpt.get().getTtlInEpochSec() < Instant.now().plus(config.sessionRenewIfExpiringIn()).getEpochSecond()) {
                superAccountSessionOpt = Optional.of(accountStore.refreshSession(
                        superAccountSessionOpt.get(),
                        Instant.now().plus(config.sessionExpiry()).getEpochSecond()));

                authCookie.setAuthCookie(request, response, SUPER_ADMIN_AUTH_COOKIE_NAME, superAccountSessionOpt.get().getSessionId(), superAccountSessionOpt.get().getTtlInEpochSec());
            }
        }

        // TODO OAuth login/signup should be refactored outside of bind into is own separate API
        boolean created = false;
        if (accountOpt.isEmpty()
                && accountBindAdmin != null
                && accountBindAdmin.getOauthToken() != null) {
            Optional<OAuthUtil.OAuthResult> oauthResult;
            boolean trustEmailVerified = false;
            String providerName = "OAuth provider";
            // Matches mock "bathtub" OAuth provider defined in oauthUtil.ts
            if (!env.isProduction() && "bathtub".equals(accountBindAdmin.getOauthToken().getId())) {
                providerName = "Bathtub";
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
                Optional<String> emailUrlOpt = Optional.empty();
                String emailJsonPath;
                if (config.oauthGithubClientId().equals(accountBindAdmin.getOauthToken().getId())) {
                    providerName = "GitHub";
                    tokenUrl = "https://github.com/login/oauth/access_token";
                    userProfileUrl = "https://api.github.com/user";
                    guidJsonPath = "id";
                    nameJsonPath = "['name','login']";
                    emailUrlOpt = Optional.of("https://api.github.com/user/emails");
                    // IMPORTANT: If you remove the 'verified == true' predicate, set trustEmailVerified to false
                    emailJsonPath = "[?(@.verified == true)][?(@.primary == true)].email";
                    clientSecret = config.oauthGithubClientSecret();
                    trustEmailVerified = true; // Verified as only verified emails are considered
                } else if (config.oauthGoogleClientId().equals(accountBindAdmin.getOauthToken().getId())) {
                    providerName = "Google";
                    tokenUrl = "https://www.googleapis.com/oauth2/v4/token";
                    userProfileUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
                    guidJsonPath = "id";
                    nameJsonPath = "name";
                    emailJsonPath = "email";
                    clientSecret = config.oauthGoogleClientSecret();
                    trustEmailVerified = true; // Verified due to being email provider itself
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
                        Optional.of(nameJsonPath),
                        emailUrlOpt,
                        Optional.of(emailJsonPath),
                        accountBindAdmin.getOauthToken().getId(),
                        clientSecret,
                        accountBindAdmin.getOauthToken().getCode());
            }
            if (oauthResult.isPresent()) {
                accountOpt = accountStore.getAccountByOauthGuid(oauthResult.get().getGuid());
                if (accountOpt.isEmpty()) {
                    String email = oauthResult.get().getEmailOpt().orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST,
                            "OAuth provider did not give us your email, please sign up using an email directly."));
                    if (trustEmailVerified) {
                        accountOpt = accountStore.getAccountByEmail(email);
                        if (accountOpt.isPresent()) {
                            log.debug("Associating OAuth login with verified email {} with an existing account {}",
                                    email, accountOpt.get().getAccountId());
                            accountOpt = Optional.of(accountStore.updateOauthGuid(accountOpt.get().getAccountId(), Optional.of(oauthResult.get().getGuid())));
                        }
                    } else {
                        if (!accountStore.isEmailAvailable(email)) {
                            throw new ApiException(Response.Status.CONFLICT,
                                    "You need to login using your email and password, because " + providerName + " has not verified your email.");
                        }
                    }
                    if (accountOpt.isEmpty()) {
                        accountOpt = Optional.of(createAccount(
                                email,
                                oauthResult.get().getNameOpt()
                                        .or(() -> Optional.ofNullable(Strings.emptyToNull(StringUtils.capitalize(email.replaceFirst("^[^a-zA-Z]*?([a-zA-Z]+).*?$", "$1")))))
                                        .orElse("No name"),
                                Optional.empty(),
                                Optional.of(oauthResult.get().getGuid()),
                                Optional.ofNullable(Strings.emptyToNull(accountBindAdmin.getOauthToken().getInvitationId())),
                                Optional.ofNullable(Strings.emptyToNull(accountBindAdmin.getOauthToken().getCouponId())),
                                Optional.ofNullable(Strings.emptyToNull(accountBindAdmin.getOauthToken().getBasePlanId())),
                                Optional.empty()));
                        created = true;
                    }
                }
                if (accountOpt.isPresent()) {
                    AccountStore.AccountSession accountSession = accountStore.createSession(
                            accountOpt.get(),
                            Instant.now().plus(config.sessionExpiry()).getEpochSecond());
                    authCookie.setAuthCookie(request, response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
                    if (superAdminPredicate.isEmailSuperAdmin(accountOpt.get().getEmail())) {
                        authCookie.setAuthCookie(request, response, SUPER_ADMIN_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
                    }
                }
            }
        }

        return new AccountBindAdminResponse(
                accountOpt.or(() -> superAccountOpt)
                        .map(account -> account.toAccountAdmin(intercomUtil, chatwootUtil, planStore, cfSso, superAdminPredicate))
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
        authCookie.setAuthCookie(request, response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        if (superAdminPredicate.isEmailSuperAdmin(account.getEmail())) {
            authCookie.setAuthCookie(request, response, SUPER_ADMIN_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        }

        return account.toAccountAdmin(intercomUtil, chatwootUtil, planStore, cfSso, superAdminPredicate);
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public void accountLogoutAdmin() {
        Optional<String> accountSessionIdOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).map(AccountSession::getSessionId);
        Optional<String> superAdminSessionIdOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getSuperAccountSessionOpt).map(AccountSession::getSessionId);

        log.debug("Logout session for account {} superAdminAccount {}",
                accountSessionIdOpt, superAdminSessionIdOpt);

        Arrays.stream(request.getCookies())
                .filter(c -> c.getName().startsWith(UserResource.USER_AUTH_COOKIE_NAME_PREFIX)
                        && !Strings.isNullOrEmpty(c.getValue()))
                .forEach(c -> {
                    userStore.revokeSession(c.getValue());
                    authCookie.unsetAuthCookie(request, response, c.getName());
                });

        accountSessionIdOpt.ifPresent(accountStore::revokeSession);
        accountSessionIdOpt.ifPresent(accountSessionId ->
                authCookie.unsetAuthCookie(request, response, ACCOUNT_AUTH_COOKIE_NAME));

        if (!accountSessionIdOpt.equals(superAdminSessionIdOpt)) {
            superAdminSessionIdOpt.ifPresent(accountStore::revokeSession);
            superAdminSessionIdOpt.ifPresent(superAdminSessionId ->
                    authCookie.unsetAuthCookie(request, response, SUPER_ADMIN_AUTH_COOKIE_NAME));
        }
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public AccountAdmin accountSignupAdmin(AccountSignupAdmin signup) {
        antiSpam.onAccountSignup(request, signup);
        Account account = createAccount(
                signup.getEmail(),
                signup.getName(),
                Optional.of(signup.getPassword()),
                Optional.empty(),
                Optional.ofNullable(Strings.emptyToNull(signup.getInvitationId())),
                Optional.ofNullable(Strings.emptyToNull(signup.getCouponId())),
                Optional.of(signup.getBasePlanId()),
                Optional.ofNullable(signup.getRequestedPrice())
        );

        return account.toAccountAdmin(intercomUtil, chatwootUtil, planStore, cfSso, superAdminPredicate);
    }

    private Account createAccount(
            String email,
            String name,
            Optional<String> passwordOpt,
            Optional<String> guidOpt,
            Optional<String> invitationIdOpt,
            Optional<String> couponIdOpt,
            Optional<String> preferredPlanIdOpt,
            Optional<Long> preferredPriceOpt) {
        if (!config.signupEnabled()) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Signups are disabled");
        }

        checkState(guidOpt.isPresent() || passwordOpt.isPresent());
        // More robust check than sanitizer.email(email);
        emailValidator.assertValid(email);
        name = sanitizer.accountName(name);

        String accountId = accountStore.genAccountId(name);

        // Accept coupon
        Optional<CouponModel> redeemedCouponOpt = Optional.empty();
        if (couponIdOpt.isPresent()) {
            redeemedCouponOpt = couponStore.redeem(couponIdOpt.get(), accountId);
            if (redeemedCouponOpt.isEmpty()) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Coupon is expired, please contact support");
            }
        }

        // Accept invitation
        ImmutableSet<String> externalProjectIds = invitationIdOpt
                .map(invitationId -> projectStore.acceptInvitation(invitationId, accountId))
                .stream()
                .collect(ImmutableSet.toImmutableSet());
        boolean isTeammate = !externalProjectIds.isEmpty();

        // Find preferred plan, otherwise find a first plan we find
        String planId;
        if (redeemedCouponOpt.isPresent()) {
            planId = redeemedCouponOpt.get().getBasePlanId();
        } else if (isTeammate) {
            planId = PlanStore.TEAMMATE_PLAN_ID;
        } else {
            planId = preferredPlanIdOpt.flatMap(pId -> (config.enableNonPublicPlans()
                            ? planStore.getAllPlans().getPlans()
                            : planStore.getPublicPlans().getPlans()).stream()
                            .filter(p -> p.getBasePlanId().equals(pId))
                            .filter(p -> p.getComingSoon() != Boolean.TRUE)
                            .findAny())
                    .orElseGet(() -> planStore.getPublicPlans().getPlans().stream()
                            .filter(p -> p.getComingSoon() != Boolean.TRUE)
                            .findFirst()
                            .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Signups are disabled")))
                    .getBasePlanId();
        }

        // Create account locally
        Account account = new Account(
                accountId,
                email,
                PlanStore.PLANS_WITHOUT_TRIAL.contains(planId)
                        ? SubscriptionStatus.ACTIVE
                        : SubscriptionStatus.ACTIVETRIAL,
                null,
                planId,
                Instant.now(),
                name,
                passwordOpt.map(password -> passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, password, email)).orElse(null),
                ImmutableSet.of(),
                externalProjectIds,
                guidOpt.orElse(null),
                ImmutableMap.of(),
                ImmutableMap.of(),
                preferredPriceOpt.orElse(null),
                ImmutableSet.of(),
                null,
                null);
        account = accountStore.createAccount(account).getAccount();

        // Create customer in KillBill asynchronously because:
        // - It takes too long
        // - Had spurious errors that prevented users from signing up
        billing.createAccountWithSubscriptionAsync(account);

        // Create auth session
        AccountStore.AccountSession accountSession = accountStore.createSession(
                account,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(request, response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        if (superAdminPredicate.isEmailSuperAdmin(account.getEmail())) {
            authCookie.setAuthCookie(request, response, SUPER_ADMIN_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        }

        notificationService.onAccountSignup(account);

        return account;
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 5)
    @Override
    public AccountAdmin accountUpdateAdmin(AccountUpdateAdmin accountUpdateAdmin) {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false))
                .orElseThrow();
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getName())) {
            String accountName = sanitizer.accountName(accountUpdateAdmin.getName());
            account = accountStore.updateName(account.getAccountId(), accountName).getAccount();
        }
        if (accountUpdateAdmin.getAttrs() != null && !accountUpdateAdmin.getAttrs().isEmpty()) {
            log.info("{} using deprecated call to update attrs via accountUpdateAdmin", accountUpdateAdmin.getName());
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
                planVerifyStore.verifyActionMeetsPlanRestrictions(account.getPlanid(), account.getAccountId(), PlanVerifyStore.Action.API_KEY);
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
        if (accountUpdateAdmin.getAddExtraTeammates() != null) {
            if (accountUpdateAdmin.getAddExtraTeammates() > 10) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot add more than 10 teammates at one time");
            }
            if (accountUpdateAdmin.getAddExtraTeammates() <= 0) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Invalid number of teammates to add");
            }
            long extraTeammates = Optional.ofNullable(account.getAddons())
                    .flatMap(addons -> Optional.ofNullable(addons.get(KillBillPlanStore.ADDON_EXTRA_TEAMMATE)))
                    .map(Longs::tryParse)
                    .orElse(0L);
            long adminAdditionalPrice = planStore.getPlan(account.getPlanid(), Optional.of(account.getAccountId()))
                    .flatMap(p -> Optional.ofNullable(p.getPricing()))
                    .flatMap(p -> Optional.ofNullable(p.getAdmins()))
                    .map(PlanPricingAdmins::getAdditionalPrice)
                    .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Cannot add teammates to this plan"));
            billing.creditAdjustment(account.getAccountId(), -adminAdditionalPrice * accountUpdateAdmin.getAddExtraTeammates(), "Additional " + accountUpdateAdmin.getAddExtraTeammates() + " teammates");
            accountStore.updateAddons(account.getAccountId(), ImmutableMap.of(
                            KillBillPlanStore.ADDON_EXTRA_TEAMMATE,
                            Long.toString(extraTeammates + accountUpdateAdmin.getAddExtraTeammates())),
                    false);
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getBasePlanId())) {
            String newPlanid = accountUpdateAdmin.getBasePlanId();
            Optional<Plan> newPlanOpt = (config.enableNonPublicPlans()
                    ? planStore.getAllPlans().getPlans()
                    : planStore.getAccountChangePlanOptions(account.getAccountId())).stream()
                    .filter(p -> p.getBasePlanId().equals(newPlanid))
                    .findAny();
            if (!newPlanOpt.isPresent() || newPlanOpt.get().getComingSoon() == Boolean.TRUE) {
                log.warn("Account {} not allowed to change plans to {}",
                        account.getAccountId(), newPlanid);
                throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot change to this plan");
            }

            account = changePlan(account, newPlanid, ImmutableMap.of(), Optional.empty());
        }
        if (accountUpdateAdmin.getApplyLicenseKey() != null) {
            if (env != Environment.PRODUCTION_SELF_HOST) {
                throw new ApiException(Response.Status.BAD_REQUEST, "License key can only be applied in self-hosted environment");
            }
            if (accountUpdateAdmin.getApplyLicenseKey().isEmpty()) {
                remoteLicenseStore.clearLicense();
            } else {
                remoteLicenseStore.setLicense(accountUpdateAdmin.getApplyLicenseKey());
                Optional<Boolean> licenseValid = remoteLicenseStore.validateLicenseRemotely(false);
                if (licenseValid.orElse(false)) {
                    Optional<Account> accountChangedOpt = billing.tryAutoUpgradeAfterSelfhostLicenseAdded(account);
                    if (accountChangedOpt.isPresent()) {
                        account = accountChangedOpt.get();
                    }
                }
            }
        }
        if (accountUpdateAdmin.getDigestOptOutForProjectIds() != null) {
            log.info("Digest opt out for account {} {} opted out projectIds {}",
                    account.getAccountId(), account.getEmail(), accountUpdateAdmin.getDigestOptOutForProjectIds());
            account = accountStore.setWeeklyDigestOptOut(account.getAccountId(), ImmutableSet.copyOf(accountUpdateAdmin.getDigestOptOutForProjectIds()));
        }
        return account.toAccountAdmin(intercomUtil, chatwootUtil, planStore, cfSso, superAdminPredicate);
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 10)
    @Override
    public ViewCouponResponse accountViewCouponAdmin(String couponId) {
        Optional<String> accountIdOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).map(AccountSession::getAccountId);
        Optional<CouponModel> couponOpt = couponStore.check(couponId);

        boolean isRedeemedByYou = false;
        if (couponOpt.isPresent() && !Strings.isNullOrEmpty(couponOpt.get().getRedeemedAccountId())) {
            isRedeemedByYou = accountIdOpt.isPresent() && accountIdOpt.get().equals(couponOpt.get().getRedeemedAccountId());
        }

        Optional<Plan> planOpt = couponOpt
                .filter(coupon -> Strings.isNullOrEmpty(coupon.getRedeemedAccountId()))
                .flatMap(coupon -> planStore.getCouponPlan(coupon, accountIdOpt))
                .map(PlanWithAddons::getPlan);

        return new ViewCouponResponse(
                planOpt.orElse(null),
                isRedeemedByYou);
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
                invitation.getProjectNameNonNull(),
                InvitationResult.RoleEnum.ADMIN,
                invitation.getIsAcceptedByAccountId() != null);
    }

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public AvailableRepos gitHubGetReposAdmin(String code) {
        String accountId = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .get();

        return gitHubStore.getReposForUser(accountId, code);
    }

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public GitLabAvailableProjects gitLabGetProjectsAdmin(GitLabGetProjectsBody body) {
        String accountId = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .get();

        return gitLabStore.getProjectsForUser(accountId, body.getCode(), body.getGitlabInstanceUrl());
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

        if (accountUpdateAdmin.getChangeToSponsorPlanWithMonthlyPrice() != null) {
            Subscription subscription = billing.changePlan(account.getAccountId(), "sponsor-monthly", Optional.of(accountUpdateAdmin.getChangeToSponsorPlanWithMonthlyPrice()));

            // Sync entitlement status
            SubscriptionStatus status = billing.updateAndGetEntitlementStatus(
                    account.getStatus(),
                    billing.getAccount(account.getAccountId()),
                    subscription,
                    "Change to sponsor plan");
        }

        if (accountUpdateAdmin.getAddons() != null && !accountUpdateAdmin.getAddons().isEmpty()) {
            accountStore.updateAddons(account.getAccountId(), accountUpdateAdmin.getAddons(), account.getAddons() == null || account.getAddons().isEmpty());
        }

        return accountStore.getAccount(account.getAccountId(), false).get()
                .toAccountAdmin(intercomUtil, chatwootUtil, planStore, cfSso, superAdminPredicate);
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public StreamingOutput couponGenerateSuperAdmin(CouponGenerateSuperAdmin couponGenerateSuperAdmin) {
        Plan plan = planStore.getPlan(couponGenerateSuperAdmin.getBasePlanId(), Optional.empty())
                .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "No plan exists with that ID"));

        String fileName = "coupons-" + plan.getBasePlanId() + "-" + couponGenerateSuperAdmin.getAmount() + "-" + DateTime.now().toString("yyyy-MM-dd-HH-mm-ss") + ".txt";
        response.setHeader("content-disposition", "attachment; filename=" + fileName);

        return (os) -> {
            try (PrintWriter pw = new PrintWriter(os)) {
                couponStore.generate(
                        plan.getBasePlanId(),
                        couponGenerateSuperAdmin.getAmount(),
                        Optional.ofNullable(couponGenerateSuperAdmin.getExpiry()),
                        batch -> {
                            batch.forEach(pw::println);
                            pw.flush();
                        });
            }
        };
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public void projectOwnerSwapSuperAdmin(ProjectOwnerSwapSuperAdmin projectOwnerSwapSuperAdmin) {
        Project project = projectStore.getProject(projectOwnerSwapSuperAdmin.getProjectId(), false).orElseThrow(NotFoundException::new);
        Account ownerNew = accountStore.getAccount(projectOwnerSwapSuperAdmin.getNewOwnerAccountId(), false).orElseThrow(NotFoundException::new);
        Account ownerOld = accountStore.getAccount(project.getAccountId(), false).orElseThrow();

        // Ensure old owner is an owner
        checkState(ownerOld.getProjectIds().contains(project.getProjectId()));
        checkState(project.getAccountId().equals(ownerOld.getAccountId()));

        // First remove new owner as an admin
        if (ownerNew.getExternalProjectIds().contains(project.getProjectId())) {
            ownerNew = accountStore.removeExternalProject(ownerNew.getAccountId(), project.getProjectId());
        }
        if (project.getModel().getAdminsAccountIds().contains(ownerNew.getAccountId())) {
            project = projectStore.removeAdmin(project.getProjectId(), ownerNew.getAccountId());
        }

        // Swap owner
        ownerOld = accountStore.removeProject(ownerOld.getAccountId(), project.getProjectId()).getAccount();
        project = projectStore.changeOwner(project.getProjectId(), ownerNew.getAccountId());
        ownerNew = accountStore.addProject(ownerNew.getAccountId(), project.getProjectId()).getAccount();
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 100)
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
        boolean isSuperAdmin = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedSuperAccountIdOpt)
                .isPresent();
        Optional<String> assertInvoiceBelongsToAccountId;
        if (isSuperAdmin) {
            assertInvoiceBelongsToAccountId = Optional.empty();
        } else {
            assertInvoiceBelongsToAccountId = getExtendedPrincipal()
                    .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                    .flatMap(accountId -> accountStore.getAccount(accountId, true))
                    .map(Account::getAccountId);
            checkState(assertInvoiceBelongsToAccountId.isPresent());
        }
        String invoiceHtml = billing.getInvoiceHtml(invoiceId, assertInvoiceBelongsToAccountId);
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
        deleteAccount(account);
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public void accountDeleteSuperAdmin(AccountDeleteSuperAdmin accountDeleteSuperAdmin) {
        for (String accountOrEmailId : accountDeleteSuperAdmin.getAccountOrEmailIds()) {
            Account account = accountStore.getAccount(accountOrEmailId, true)
                    .or(() -> accountStore.getAccountByEmail(accountOrEmailId))
                    .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found: " + accountOrEmailId));
            deleteAccount(account);
        }
    }

    private void deleteAccount(Account account) {
        account.getProjectIds().forEach(projectId -> projectResource.projectDeleteAdmin(account, projectId));
        account.getExternalProjectIds().forEach(projectId -> projectStore.removeAdmin(projectId, account.getAccountId()));
        accountStore.deleteAccount(account.getAccountId());
        billing.closeAccount(account.getAccountId());
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 10)
    @Override
    public AccountAdmin accountAcceptCouponAdmin(String couponId) {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false))
                .get();

        if (!Billing.SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(account.getStatus())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Account is not in good standing, please contact support.");
        }

        CouponModel coupon = couponStore.redeem(couponId, account.getAccountId())
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Coupon expired or invalid"));

        PlanWithAddons planWithAddons = planStore.getCouponPlan(coupon, Optional.of(account.getAccountId()))
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Coupon plan is not available"));

        account = changePlan(account, planWithAddons.getPlan().getBasePlanId(), planWithAddons.getAddons(), Optional.empty());

        return account.toAccountAdmin(intercomUtil, chatwootUtil, planStore, cfSso, superAdminPredicate);
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
    public AccountAdmin accountAttrsUpdateAdmin(AccountAttrsUpdateAdmin accountAttrsUpdateAdmin) {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false))
                .get();

        if (accountAttrsUpdateAdmin.getAttrs() != null && !accountAttrsUpdateAdmin.getAttrs().isEmpty()) {
            account = accountStore.updateAttrs(account.getAccountId(), accountAttrsUpdateAdmin.getAttrs(), account.getAttrs() == null || account.getAttrs().isEmpty());
        }

        return account.toAccountAdmin(intercomUtil, chatwootUtil, planStore, cfSso, superAdminPredicate);
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
            account = accountStore.setPlan(account.getAccountId(), subscription.getPlanName(), Optional.empty()).getAccount();
        }


        Plan plan = planStore.getPlan(account.getPlanid(), Optional.of(accountId)).get();
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

        Long postCount = null;
        if (KillBillPlanStore.PLAN_MAX_POSTS.containsKey(plan.getBasePlanId())) {
            postCount = accountStore.getPostCountForAccount(account.getAccountId());
        }

        Long teammateCount = null;
        if (PlanStore.RECORD_TEAMMATES_FOR_PLANS.contains(plan.getBasePlanId())
                || PlanStore.LIFETIME_TEAMMATES_FOR_PLANS.contains(plan.getBasePlanId())) {
            teammateCount = accountStore.getTeammateCountForAccount(account.getAccountId());
        }

        Long teammateMax = null;
        if (PlanStore.LIFETIME_TEAMMATES_FOR_PLANS.contains(plan.getBasePlanId())) {
            teammateMax = Optional.ofNullable(account.getAddons())
                    .flatMap(addons -> Optional.ofNullable(addons.get(KillBillPlanStore.ADDON_EXTRA_TEAMMATE)))
                    .map(Longs::tryParse)
                    .orElse(0L)
                    + Optional.ofNullable(plan.getPricing())
                    .flatMap(p -> Optional.ofNullable(p.getAdmins()))
                    .map(PlanPricingAdmins::getAmountIncluded)
                    .orElse(0L);
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

            LocalDate trialEnd = subscription.getEvents()
                    .stream()
                    .filter(e -> e.getPhase() != null && e.getPhase().contains("evergreen")
                            && e.getEventType() == SubscriptionEventType.PHASE)
                    .map(EventSubscription::getEffectiveDate)
                    .findFirst()
                    // Fallback assuming all plans have 14 day trial
                    .orElseGet(() -> Optional.ofNullable(subscription.getChargedThroughDate())
                            .orElseGet(subscription::getStartDate)
                            .plusDays(14));
            billingPeriodEnd = Instant.ofEpochMilli(trialEnd
                    .toDateTimeAtStartOfDay(DateTimeZone.UTC)
                    .toInstant()
                    .getMillis());
        }

        long accountReceivable = kbAccount.getAccountBalance() == null ? 0L : kbAccount.getAccountBalance().longValue();
        long accountPayable = kbAccount.getAccountCBA() == null ? 0L : kbAccount.getAccountCBA().longValue();

        Optional<Plan> endOfTermChangeToPlan = billing.getEndOfTermChangeToPlanId(subscription)
                .flatMap(planId -> planStore.getPlan(planId, Optional.empty()));

        Optional<AccountBillingPaymentActionRequired> actions = billing.getActions(subscription.getAccountId());

        String purchasedLicenseKey = null;
        if (KillBillPlanStore.SELFHOST_SERVICE_PLANS.contains(plan.getBasePlanId())
                // Only show license if account is in good standing
                && localLicenseStore.validateLicenseLocally(
                localLicenseStore.getLicense(accountId),
                IpUtil.getRemoteIp(request, env),
                Optional.of(kbAccount))) {
            purchasedLicenseKey = localLicenseStore.getLicense(accountId);
        }

        String appliedLicenseKey = null;
        if (env == Environment.PRODUCTION_SELF_HOST) {
            appliedLicenseKey = remoteLicenseStore.getLicense().orElse(null);
        }

        return new AccountBilling(
                plan,
                status,
                accountBillingPayment.orElse(null),
                billingPeriodEnd,
                (trackedUsers == null || trackedUsers <= 0) ? null : trackedUsers,
                postCount,
                teammateCount,
                teammateMax,
                availablePlans.asList(),
                invoices,
                accountReceivable,
                accountPayable,
                endOfTermChangeToPlan.orElse(null),
                actions.orElse(null),
                purchasedLicenseKey,
                appliedLicenseKey);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public void accountNoopAdmin() {
        // Noop
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public void accountCreditAdjustmentSuperAdmin(AccountCreditAdjustment accountCreditAdjustment) {
        Account account = accountStore.getAccount(accountCreditAdjustment.getAccountId(), true)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Account not found"));

        billing.creditAdjustment(account.getAccountId(), accountCreditAdjustment.getAmount(), accountCreditAdjustment.getDescription());
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
        authCookie.setAuthCookie(request, response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());

        return account.toAccountAdmin(intercomUtil, chatwootUtil, planStore, cfSso, superAdminPredicate);
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
                searchAccountsResponse.getAccounts().stream()
                        .map(Account::toAccount)
                        .collect(ImmutableList.toImmutableList()));
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

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public AllPlansGetResponse plansGetSuperAdmin() {
        return planStore.getAllPlans();
    }

    @PermitAll
    @Limit(requiredPermits = 100)
    @Override
    public void licenseCheck(String license) {

        if (!localLicenseStore.validateLicenseLocally(
                license,
                IpUtil.getRemoteIp(request, env),
                Optional.empty())) {
            throw new ApiException(Response.Status.UNAUTHORIZED);
        }
        // All good, return 2xx
    }

    private Account changePlan(Account account, String newPlanid, ImmutableMap<String, String> addons, Optional<Long> recurringPriceOpt) {
        planVerifyStore.verifyAccountMeetsPlanRestrictions(newPlanid, account.getAccountId());

        boolean isAddonsChangeOnly = newPlanid.equals(account.getPlanid()) && recurringPriceOpt.isEmpty();

        boolean isPlanChangingNow = false;
        if (!isAddonsChangeOnly) {
            Subscription subscription = billing.changePlan(account.getAccountId(), newPlanid, recurringPriceOpt);
            // Only update account if plan was changed immediately, as oppose to end of term
            isPlanChangingNow = newPlanid.equals(subscription.getPlanName());
            if (!newPlanid.equals(subscription.getPlanName())
                    && !newPlanid.equals((billing.getEndOfTermChangeToPlanId(subscription).orElse(null)))) {
                if (LogUtil.rateLimitAllowLog("accountResource-planChangeMismatch")) {
                    log.warn("Plan change to {} doesn't seem to reflect billing, accountId {} subscriptionId {} subscription plan {}",
                            newPlanid, account.getAccountId(), subscription.getSubscriptionId(), subscription.getPlanName());
                }
            }
        }
        if (isPlanChangingNow) {
            account = accountStore.setPlan(account.getAccountId(), newPlanid, Optional.of(addons)).getAccount();
        } else if (isAddonsChangeOnly) {
            account = accountStore.updateAddons(account.getAccountId(), addons, account.getAddons() == null || account.getAddons().isEmpty());
        }

        return account;
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
