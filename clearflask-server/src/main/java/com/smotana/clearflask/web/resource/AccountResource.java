package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.AccountAdminApi;
import com.smotana.clearflask.api.PlanApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.Billing.Gateway;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.LegalStore;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.LocalDate;
import org.killbill.billing.catalog.api.PhaseType;
import org.killbill.billing.client.model.gen.EventSubscription;
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
import java.util.Date;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class AccountResource extends AbstractResource implements AccountAdminApi, PlanApi {

    public interface Config {
        @DefaultValue("P30D")
        Duration sessionExpiry();

        @DefaultValue("P20D")
        Duration sessionRenewIfExpiringIn();
    }

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
    private PlanStore planStore;
    @Inject
    private LegalStore legalStore;
    @Inject
    private PasswordUtil passwordUtil;
    @Inject
    private AuthCookie authCookie;
    @Inject
    private ClearFlaskSso cfSso;

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public AccountBindAdminResponse accountBindAdmin() {
        Optional<AccountSession> accountSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt);
        if (!accountSessionOpt.isPresent()) {
            return new AccountBindAdminResponse(null);
        }
        AccountSession accountSession = accountSessionOpt.get();

        // Token refresh
        if (accountSession.getTtlInEpochSec() < Instant.now().plus(config.sessionRenewIfExpiringIn()).getEpochSecond()) {
            accountSession = accountStore.refreshSession(
                    accountSession,
                    Instant.now().plus(config.sessionExpiry()).getEpochSecond());

            authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());
        }

        // Fetch account
        Optional<Account> accountOpt = accountStore.getAccountByAccountId(accountSession.getAccountId());
        if (!accountOpt.isPresent()) {
            log.info("Account bind on valid session to non-existent account, revoking all sessions for accountId {}",
                    accountSession.getAccountId());
            accountStore.revokeSessions(accountSession.getAccountId());
            authCookie.unsetAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME);
            return new AccountBindAdminResponse(null);
        }
        Account account = accountOpt.get();

        return new AccountBindAdminResponse(account.toAccountAdmin(planStore, cfSso));
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 5)
    @Override
    public AccountAdmin accountLoginAdmin(AccountLogin credentials) {
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
                account.getAccountId(),
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());

        return account.toAccountAdmin(planStore, cfSso);
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public void accountLogoutAdmin() {
        Optional<AccountSession> accountSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt);
        if (!accountSessionOpt.isPresent()) {
            log.trace("Cannot logout account, already not logged in");
            return;
        }

        log.debug("Logout session for accountId {} sessionId {}",
                accountSessionOpt.get().getAccountId(), accountSessionOpt.get().getSessionId());
        accountStore.revokeSession(accountSessionOpt.get().getSessionId());

        authCookie.unsetAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME);
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public AccountAdmin accountSignupAdmin(AccountSignupAdmin signup) {
        String accountId = accountStore.genAccountId();
        Plan plan = planStore.getPublicPlans().getPlans().stream()
                .filter(p -> p.getPlanid().equals(signup.getPlanid()))
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
                plan.getPlanid());
        SubscriptionStatusEnum status = billing.getSubscriptionStatusFrom(accountWithSubscription.getAccount(), accountWithSubscription.getSubscription());

        // Create account locally
        String passwordHashed = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, signup.getPassword(), signup.getEmail());
        Account account;
        account = new Account(
                accountId,
                signup.getEmail(),
                status,
                plan.getPlanid(),
                Instant.now(),
                signup.getName(),
                passwordHashed,
                null,
                ImmutableSet.of());
        accountStore.createAccount(account);

        // Create auth session
        AccountStore.AccountSession accountSession = accountStore.createSession(
                account.getAccountId(),
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());

        return account.toAccountAdmin(planStore, cfSso);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public AccountAdmin accountUpdateAdmin(AccountUpdateAdmin accountUpdateAdmin) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = null;
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getName())) {
            account = accountStore.updateName(accountSession.getAccountId(), accountUpdateAdmin.getName());
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getPassword())) {
            account = accountStore.updatePassword(accountSession.getAccountId(), accountUpdateAdmin.getPassword(), accountSession.getSessionId());
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getEmail())) {
            account = accountStore.updateEmail(accountSession.getAccountId(), accountUpdateAdmin.getEmail(), accountSession.getSessionId());
        }
        if (accountUpdateAdmin.getPaymentToken() != null) {
            Optional<Gateway> gatewayOpt = Arrays.stream(Gateway.values())
                    .filter(g -> g.getPluginName().equals(accountUpdateAdmin.getPaymentToken().getType()))
                    .findAny();

            if (!gatewayOpt.isPresent()
                    || (env.isProduction() && !gatewayOpt.get().isAllowedInProduction())) {
                log.error("Account update payment token fails with invalid gateway type {}", accountUpdateAdmin.getPaymentToken().getType());
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Invalid payment gateway");
            }
            billing.updatePaymentToken(accountSession.getAccountId(), gatewayOpt.get(), accountUpdateAdmin.getPaymentToken().getToken());
        }
        if (accountUpdateAdmin.getSubscriptionActive() != null) {
            Subscription subscription;
            if (accountUpdateAdmin.getSubscriptionActive()) {
                subscription = billing.undoPendingCancel(accountSession.getAccountId());
            } else {
                subscription = billing.cancelSubscription(accountSession.getAccountId());
            }
            SubscriptionStatusEnum newStatus = billing.getSubscriptionStatusFrom(
                    billing.getAccount(accountSession.getAccountId()),
                    subscription);
            account = accountStore.updateStatus(accountSession.getAccountId(), newStatus);
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getPlanid())) {
            String newPlanid = accountUpdateAdmin.getPlanid();
            Optional<Plan> newPlanOpt = planStore.getAccountChangePlanOptions(accountSession.getAccountId()).stream()
                    .filter(p -> p.getPlanid().equals(newPlanid))
                    .findAny();
            if (!newPlanOpt.isPresent() || newPlanOpt.get().getComingSoon() == Boolean.TRUE) {
                log.error("Account {} not allowed to change plans to {}",
                        accountSession.getAccountId(), newPlanid);
                throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot change to this plan");
            }
            billing.changePlan(accountSession.getAccountId(), newPlanid);
            account = accountStore.setPlan(accountSession.getAccountId(), newPlanid);
        }
        return (account == null
                ? accountStore.getAccountByAccountId(accountSession.getAccountId()).orElseThrow(() -> new IllegalStateException("Unknown account with email " + accountSession.getAccountId()))
                : account)
                .toAccountAdmin(planStore, cfSso);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public InvoiceHtmlResponse invoiceHtmlGetAdmin(String invoiceId) {
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
        billing.cancelSubscription(account.getAccountId());
        account.getProjectIds().forEach(projectResource::projectDeleteAdmin);
        accountStore.deleteAccount(accountSession.getAccountId());
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public AccountBilling accountBillingAdmin() {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();

        Subscription subscription = billing.getSubscription(accountSession.getAccountId());
        ImmutableSet<Plan> availablePlans = planStore.getAccountChangePlanOptions(accountSession.getAccountId());
        Invoices invoices = billing.getInvoices(accountSession.getAccountId(), Optional.empty());
        Optional<Billing.PaymentMethodDetails> paymentMethodDetails = billing.getDefaultPaymentMethodDetails(accountSession.getAccountId());

        Optional<AccountBillingPayment> accountBillingPayment = paymentMethodDetails.flatMap(p -> {
            if (!p.getCardLast4().isPresent()
                    || !p.getCardExpiryMonth().isPresent()
                    || !p.getCardExpiryYear().isPresent()) {
                return Optional.empty();
            } else {
                return Optional.of(new AccountBillingPayment(
                        p.getCardBrand().orElse(null),
                        p.getCardLast4().get(),
                        p.getCardExpiryMonth().get(),
                        p.getCardExpiryYear().get()));
            }
        });

        Instant billingPeriodEnd = null;
        if (subscription.getPhaseType() == PhaseType.TRIAL) {
            billingPeriodEnd = subscription.getEvents().stream()
                    .filter(e -> !e.getPhase().endsWith("-trial"))
                    .filter(e -> e.getEffectiveDate().isAfter(LocalDate.now()))
                    .findAny()
                    .map(EventSubscription::getEffectiveDate)
                    .map(LocalDate::toDate)
                    .map(Date::toInstant)
                    .orElse(null);
        }
        if (billingPeriodEnd == null
                && subscription.getChargedThroughDate() != null) {
            billingPeriodEnd = subscription.getChargedThroughDate().toDate().toInstant();
        }

        log.debug("DEBUGDEBUG {}", subscription);

        return new AccountBilling(
                accountBillingPayment.orElse(null),
                billingPeriodEnd,
                availablePlans.asList(),
                invoices);
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
