package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.AccountAdminApi;
import com.smotana.clearflask.api.AccountSuperAdminApi;
import com.smotana.clearflask.api.PlanApi;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountBilling;
import com.smotana.clearflask.api.model.AccountBillingPayment;
import com.smotana.clearflask.api.model.AccountBillingPaymentActionRequired;
import com.smotana.clearflask.api.model.AccountBindAdminResponse;
import com.smotana.clearflask.api.model.AccountLogin;
import com.smotana.clearflask.api.model.AccountLoginAs;
import com.smotana.clearflask.api.model.AccountSearchResponse;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdmin;
import com.smotana.clearflask.api.model.AccountUpdateSuperAdmin;
import com.smotana.clearflask.api.model.InvoiceHtmlResponse;
import com.smotana.clearflask.api.model.Invoices;
import com.smotana.clearflask.api.model.LegalResponse;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.api.model.PlansGetResponse;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.Billing.Gateway;
import com.smotana.clearflask.billing.PlanStore;
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
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTimeZone;
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
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class AccountResource extends AbstractResource implements AccountAdminApi, AccountSuperAdminApi, PlanApi {

    public interface Config {
        @DefaultValue("P30D")
        Duration sessionExpiry();

        @DefaultValue("P20D")
        Duration sessionRenewIfExpiringIn();
    }

    public static final String SUPER_ADMIN_AUTH_COOKIE_NAME = "cf_sup_auth";
    public static final String ACCOUNT_AUTH_COOKIE_NAME = "cf_act_auth";

    @Inject
    private Config config;
    @Inject
    private Environment env;
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
    public AccountBindAdminResponse accountBindAdmin() {
        Optional<AccountSession> accountSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt);
        Optional<AccountSession> superAdminSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getSuperAdminSessionOpt);
        if (!accountSessionOpt.isPresent()) {
            return new AccountBindAdminResponse(null, false);
        }
        AccountSession accountSession = accountSessionOpt.get();

        // Token refresh
        if (accountSession.getTtlInEpochSec() < Instant.now().plus(config.sessionRenewIfExpiringIn()).getEpochSecond()) {
            accountSession = accountStore.refreshSession(
                    accountSession,
                    Instant.now().plus(config.sessionExpiry()).getEpochSecond());

            authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        }
        if (superAdminSessionOpt.isPresent()) {
            if (superAdminSessionOpt.get().getTtlInEpochSec() < Instant.now().plus(config.sessionRenewIfExpiringIn()).getEpochSecond()) {
                AccountSession superAdminSession = accountStore.refreshSession(
                        superAdminSessionOpt.get(),
                        Instant.now().plus(config.sessionExpiry()).getEpochSecond());

                authCookie.setAuthCookie(response, SUPER_ADMIN_AUTH_COOKIE_NAME, superAdminSession.getSessionId(), superAdminSession.getTtlInEpochSec());
            }
        }

        // Fetch account
        Optional<Account> accountOpt = accountStore.getAccountByAccountId(accountSession.getAccountId());
        if (!accountOpt.isPresent()) {
            log.info("Account bind on valid session to non-existent account, revoking all sessions for accountId {}",
                    accountSession.getAccountId());
            accountStore.revokeSessions(accountSession.getAccountId());
            authCookie.unsetAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME);
            return new AccountBindAdminResponse(null, false);
        }
        Account account = accountOpt.get();

        return new AccountBindAdminResponse(
                account.toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate),
                superAdminSessionOpt.isPresent());
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 5)
    @Override
    public AccountAdmin accountLoginAdmin(AccountLogin credentials) {
        sanitizer.email(credentials.getEmail());

        Optional<Account> accountOpt = accountStore.getAccountByEmail(credentials.getEmail());
        if (!accountOpt.isPresent()) {
            log.info("Account login with non-existent email {}", credentials.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        Account account = accountOpt.get();

        String passwordSupplied = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, credentials.getPassword(), account.getEmail());
        if (!account.getPassword().equals(passwordSupplied)) {
            log.info("Account login incorrect password for email {}", credentials.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
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
        Optional<String> superAdminSessionIdOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getSuperAdminSessionOpt).map(AccountSession::getAccountId);

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
        sanitizer.email(signup.getEmail());
        sanitizer.accountName(signup.getName());

        String accountId = accountStore.genAccountId();
        Plan plan = planStore.getPublicPlans().getPlans().stream()
                .filter(p -> p.getBasePlanId().equals(signup.getBasePlanId()))
                .findAny()
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Plan not available"));
        if (plan.getComingSoon() == Boolean.TRUE) {
            throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Plan not available");
        }

        // Create customer in KillBill
        Billing.AccountWithSubscription accountWithSubscription = billing.createAccountWithSubscription(
                accountId,
                signup.getEmail(),
                signup.getName(),
                plan.getBasePlanId());
        SubscriptionStatus status = billing.getEntitlementStatus(accountWithSubscription.getAccount(), accountWithSubscription.getSubscription());

        // Create account locally
        String passwordHashed = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, signup.getPassword(), signup.getEmail());
        Account account;
        account = new Account(
                accountId,
                signup.getEmail(),
                status,
                null,
                plan.getBasePlanId(),
                Instant.now(),
                signup.getName(),
                passwordHashed,
                ImmutableSet.of());
        accountStore.createAccount(account);

        // Create auth session
        AccountStore.AccountSession accountSession = accountStore.createSession(
                account,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        if (superAdminPredicate.isEmailSuperAdmin(account.getEmail())) {
            authCookie.setAuthCookie(response, SUPER_ADMIN_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        }

        notificationService.onAccountSignup(account);

        return account.toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public AccountAdmin accountUpdateAdmin(AccountUpdateAdmin accountUpdateAdmin) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = null;
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getName())) {
            sanitizer.accountName(accountUpdateAdmin.getName());
            account = accountStore.updateName(accountSession.getAccountId(), accountUpdateAdmin.getName()).getAccount();
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getApiKey())) {
            account = accountStore.updateApiKey(accountSession.getAccountId(), accountUpdateAdmin.getApiKey());
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getPassword())) {
            account = accountStore.updatePassword(accountSession.getAccountId(), accountUpdateAdmin.getPassword(), accountSession.getSessionId());
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getEmail())) {
            sanitizer.email(accountUpdateAdmin.getEmail());
            account = accountStore.updateEmail(accountSession.getAccountId(), accountUpdateAdmin.getEmail(), accountSession.getSessionId()).getAccount();
        }
        boolean alsoResume = false;
        if (accountUpdateAdmin.getPaymentToken() != null) {
            Optional<Gateway> gatewayOpt = Arrays.stream(Gateway.values())
                    .filter(g -> g.getPluginName().equals(accountUpdateAdmin.getPaymentToken().getType()))
                    .findAny();

            if (!gatewayOpt.isPresent()
                    || (env.isProduction() && !gatewayOpt.get().isAllowedInProduction())) {
                log.warn("Account update payment token fails with invalid gateway type {}", accountUpdateAdmin.getPaymentToken().getType());
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Invalid payment gateway");
            }
            billing.updatePaymentToken(accountSession.getAccountId(), gatewayOpt.get(), accountUpdateAdmin.getPaymentToken().getToken());

            if (account == null) {
                account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
            }
            if (account.getStatus() == SubscriptionStatus.ACTIVENORENEWAL) {
                alsoResume = true;
            }
        }
        if (accountUpdateAdmin.getCancelEndOfTerm() == Boolean.TRUE) {
            if (account == null) {
                account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
            }
            Subscription subscription = billing.cancelSubscription(accountSession.getAccountId());
            SubscriptionStatus newStatus = billing.updateAndGetEntitlementStatus(
                    account.getStatus(),
                    billing.getAccount(accountSession.getAccountId()),
                    subscription,
                    "user requested cancel");
        }
        if (accountUpdateAdmin.getResume() == Boolean.TRUE || alsoResume) {
            if (account == null) {
                account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
            }
            Subscription subscription = billing.resumeSubscription(accountSession.getAccountId());
            SubscriptionStatus newStatus = billing.updateAndGetEntitlementStatus(
                    account.getStatus(),
                    billing.getAccount(accountSession.getAccountId()),
                    subscription,
                    alsoResume ? "user requested update payment and resume" : "user requested resume");
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getBasePlanId())) {
            String newPlanid = accountUpdateAdmin.getBasePlanId();
            Optional<Plan> newPlanOpt = planStore.getAccountChangePlanOptions(accountSession.getAccountId()).stream()
                    .filter(p -> p.getBasePlanId().equals(newPlanid))
                    .findAny();
            if (!newPlanOpt.isPresent() || newPlanOpt.get().getComingSoon() == Boolean.TRUE) {
                log.warn("Account {} not allowed to change plans to {}",
                        accountSession.getAccountId(), newPlanid);
                throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot change to this plan");
            }

            if (account == null) {
                account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
            }
            account.getProjectIds().stream()
                    .map(projectId -> projectStore.getProject(projectId, true))
                    .filter(Optional::isPresent)
                    .map(Optional::get)
                    .forEach(project -> planStore.verifyConfigMeetsPlanRestrictions(newPlanid, project.getVersionedConfigAdmin().getConfig()));

            Subscription subscription = billing.changePlan(accountSession.getAccountId(), newPlanid);
            // Only update account if plan was changed immediately, as oppose to end of term
            if (newPlanid.equals(subscription.getPlanName())) {
                account = accountStore.setPlan(accountSession.getAccountId(), newPlanid).getAccount();
            } else if (!newPlanid.equals((billing.getEndOfTermChangeToPlanId(subscription).orElse(null)))) {
                if (LogUtil.rateLimitAllowLog("accountResource-planChangeMismatch")) {
                    log.warn("Plan change to {} doesnt seem to reflect killbill, accountId {} subscriptionId {} subscription plan {}",
                            newPlanid, accountSession.getAccountId(), subscription.getSubscriptionId(), subscription.getPlanName());
                }
            }
        }
        return (account == null
                ? accountStore.getAccountByAccountId(accountSession.getAccountId()).orElseThrow(() -> new IllegalStateException("Unknown account with email " + accountSession.getAccountId()))
                : account)
                .toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate);
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public AccountAdmin accountUpdateSuperAdmin(AccountUpdateSuperAdmin accountUpdateAdmin) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();

        if (accountUpdateAdmin.getChangeToFlatPlanWithYearlyPrice() != null) {
            Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();

            Subscription subscription = billing.changePlanToFlatYearly(accountSession.getAccountId(), accountUpdateAdmin.getChangeToFlatPlanWithYearlyPrice());

            // Sync entitlement status
            SubscriptionStatus status = billing.updateAndGetEntitlementStatus(
                    account.getStatus(),
                    billing.getAccount(accountSession.getAccountId()),
                    subscription,
                    "Change to flat plan");
        }

        return accountStore.getAccountByAccountId(accountSession.getAccountId()).get()
                .toAccountAdmin(intercomUtil, planStore, cfSso, superAdminPredicate);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public InvoiceHtmlResponse invoiceHtmlGetAdmin(String invoiceIdStr) {
        if (invoiceIdStr == null) {
            throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Invalid invoice number");
        }
        UUID invoiceId;
        try {
            invoiceId = UUID.fromString(invoiceIdStr);
        } catch (IllegalArgumentException ex) {
            throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Invalid invoice number");
        }
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        String invoiceHtml = billing.getInvoiceHtml(accountSession.getAccountId(), invoiceId);
        return new InvoiceHtmlResponse(invoiceHtml);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public Invoices invoicesSearchAdmin(String cursor) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        return billing.getInvoices(
                accountSession.getAccountId(),
                Optional.ofNullable(Strings.emptyToNull(cursor)));
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 1)
    @Override
    public void accountDeleteAdmin() {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
        account.getProjectIds().forEach(projectResource::projectDeleteAdmin);
        accountStore.deleteAccount(accountSession.getAccountId());
        billing.closeAccount(account.getAccountId());
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public AccountBilling accountBillingAdmin(Boolean refreshPayments) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();

        if (refreshPayments == Boolean.TRUE) {
            billing.syncActions(accountSession.getAccountId());
        }

        Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
        org.killbill.billing.client.model.gen.Account kbAccount = billing.getAccount(accountSession.getAccountId());
        Subscription subscription = billing.getSubscription(accountSession.getAccountId());

        // Sync entitlement status
        SubscriptionStatus status = billing.updateAndGetEntitlementStatus(
                account.getStatus(),
                kbAccount,
                subscription,
                "Get account billing");
        if (!account.getStatus().equals(status)) {
            account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
        }

        // Sync plan id
        if (!subscription.getPlanName().equals(account.getPlanid())) {
            log.info("Account billing caused accountId {} plan change {} -> {}",
                    account.getAccountId(), account.getPlanid(), subscription.getPlanName());
            account = accountStore.setPlan(account.getAccountId(), subscription.getPlanName()).getAccount();
        }


        Plan plan = planStore.getPlan(account.getPlanid(), Optional.of(subscription)).get();
        ImmutableSet<Plan> availablePlans = planStore.getAccountChangePlanOptions(accountSession.getAccountId());
        Invoices invoices = billing.getInvoices(accountSession.getAccountId(), Optional.empty());
        Optional<Billing.PaymentMethodDetails> paymentMethodDetails = billing.getDefaultPaymentMethodDetails(accountSession.getAccountId());

        Optional<AccountBillingPayment> accountBillingPayment = paymentMethodDetails.map(p -> new AccountBillingPayment(
                p.getCardBrand().orElse(null),
                p.getCardLast4().orElse("****"),
                p.getCardExpiryMonth().orElse(1L),
                p.getCardExpiryYear().orElse(99L)));

        Long billingPeriodMau = null;
        if (Billing.SUBSCRIPTION_STATUS_ACTIVE_ENUMS.contains(status)) {
            billingPeriodMau = billing.getUsageCurrentPeriod(accountSession.getAccountId());
        }

        Instant billingPeriodEnd = null;
        if (subscription.getPhaseType() == PhaseType.EVERGREEN
                && subscription.getChargedThroughDate() != null) {
            // TODO double check this is the correct time, should it not be at end of day instead?
            billingPeriodEnd = Instant.ofEpochMilli(subscription.getChargedThroughDate()
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
                (billingPeriodMau == null || billingPeriodMau <= 0) ? null : billingPeriodMau,
                availablePlans.asList(),
                invoices,
                accountReceivable,
                accountPayable,
                endOfTermChangeToPlan.orElse(null),
                actions.orElse(null));
    }

    @RolesAllowed({Role.SUPER_ADMIN})
    @Override
    public AccountAdmin accountLoginAsSuperAdmin(AccountLoginAs accountLoginAs) {
        sanitizer.email(accountLoginAs.getEmail());

        Optional<Account> accountOpt = accountStore.getAccountByEmail(accountLoginAs.getEmail());
        if (!accountOpt.isPresent()) {
            log.info("Account login with non-existent email {}", accountLoginAs.getEmail());
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Account does not exist");
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
            }
        };
    }
}
