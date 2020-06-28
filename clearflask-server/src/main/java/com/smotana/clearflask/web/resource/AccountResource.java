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
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.LegalStore;
import com.smotana.clearflask.store.PlanStore;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import com.stripe.exception.StripeException;
import com.stripe.model.Address;
import com.stripe.model.Customer;
import com.stripe.model.Subscription;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerUpdateParams;
import com.stripe.param.SubscriptionCreateParams;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
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
    private Application.Config configApp;
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
        Plan plan = planStore.getPlan(signup.getPlanid())
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Plan does not exist"));
        String stripePriceId = planStore.getStripePriceId(plan.getPlanid())
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Plan does not exist"));

        // Create customer in Stripe
        Customer customer;
        try {
            customer = Customer.create(CustomerCreateParams.builder()
                    .setEmail(signup.getEmail())
                    .setName(signup.getName())
                    .build());
        } catch (StripeException ex) {
            log.error("Failed to create Stripe customer on signup", ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to contact payment processor, try again later");
        }

        // Create customer subscription in Stripe
        Subscription subscription;
        try {
            subscription = Subscription.create(SubscriptionCreateParams.builder()
                    .addAddInvoiceItem(SubscriptionCreateParams.AddInvoiceItem.builder()
                            .setPrice(stripePriceId)
                            .build())
                    .setCustomer(customer.getId())
                    .setTrialPeriodDays(14L)
                    .build());
        } catch (StripeException ex) {
            log.error("Failed to create Stripe subscription on signup", ex);
            try {
                customer.delete();
            } catch (StripeException ex2) {
                log.error("Failed to delete Stripe customer after failing to create subscription", ex2);
            }
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to contact payment processor, try again later");
        }

        // Create account locally
        String passwordHashed = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, signup.getPassword(), signup.getEmail());
        Account account;
        try {
            account = new Account(
                    accountStore.genAccountId(),
                    signup.getEmail(),
                    customer.getId(),
                    plan.getPlanid(),
                    Optional.ofNullable(subscription.getTrialEnd())
                            .map(Instant::ofEpochSecond)
                            .orElse(null),
                    Instant.now(),
                    signup.getName(),
                    passwordHashed,
                    null,
                    ImmutableSet.of());
            accountStore.createAccount(account);
        } catch (Exception ex) {
            try {
                customer.delete();
            } catch (StripeException ex2) {
                log.error("Failed to delete Stripe customer after failing to create it in the first place during signup", ex2);
            }
            throw ex;
        }

        // Create auth session
        AccountStore.AccountSession accountSession = accountStore.createSession(
                account.getAccountId(),
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec());

        return account.toAccountAdmin(planStore, cfSso);
    }

    // TODO
    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 3)
//    @Override
    public AccountAdmin accountUpdatePaymentAdmin(String paymentSource) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();

        Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).orElseThrow();

        try {
            Customer.retrieve(account.getStripeCusId()).update(CustomerUpdateParams.builder()
                    .setSource(paymentSource)
                    .build());
        } catch (StripeException ex) {
            log.error("Failed to update account {} payment source", account.getAccountId(), ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to contact payment processor");
        }

        return null;
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
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
        return (account == null
                ? accountStore.getAccountByAccountId(accountSession.getAccountId()).orElseThrow(() -> new IllegalStateException("Unknown account with email " + accountSession.getAccountId()))
                : account)
                .toAccountAdmin(planStore, cfSso);
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
        return planStore.plansGet();
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
