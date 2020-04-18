package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.AccountAdminApi;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountBindAdminResponse;
import com.smotana.clearflask.api.model.AccountLogin;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdmin;
import com.smotana.clearflask.api.model.LegalResponse;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.LegalStore;
import com.smotana.clearflask.store.PlanStore;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.AuthCookieUtil;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
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
public class AccountResource extends AbstractResource implements AccountAdminApi {

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
    private AuthCookieUtil authCookieUtil;

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
        if (accountSession.getTtlInEpochSec() > Instant.now().plus(config.sessionRenewIfExpiringIn()).getEpochSecond()) {
            accountSession = accountStore.refreshSession(
                    accountSession,
                    Instant.now().plus(config.sessionExpiry()).getEpochSecond());

            authCookieUtil.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec(), configApp.domain());
        }

        // Fetch account
        Optional<Account> accountOpt = accountStore.getAccount(accountSession.getEmail());
        if (!accountOpt.isPresent()) {
            log.info("Account bind on valid session to non-existent account, revoking all sessions for email {}",
                    accountSession.getEmail());
            accountStore.revokeSessions(accountSession.getEmail());
            authCookieUtil.unsetAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME);
            return new AccountBindAdminResponse(null);
        }
        Account account = accountOpt.get();

        return new AccountBindAdminResponse(account.toAccountAdmin(planStore));
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 5)
    @Override
    public AccountAdmin accountLoginAdmin(AccountLogin credentials) {
        Optional<Account> accountOpt = accountStore.getAccount(credentials.getEmail());
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
                account.getEmail(),
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookieUtil.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec(), configApp.domain());

        return account.toAccountAdmin(planStore);
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public void accountLogoutAdmin() {
        Optional<ExtendedPrincipal> extendedPrincipal = getExtendedPrincipal();
        if (!extendedPrincipal.isPresent()) {
            log.trace("Cannot logout account, already not logged in");
            return;
        }
        AccountSession accountSession = extendedPrincipal.get().getAccountSessionOpt().get();

        log.debug("Logout session for email {}", accountSession.getEmail());
        accountStore.revokeSession(accountSession);

        authCookieUtil.unsetAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME);
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public AccountAdmin accountSignupAdmin(AccountSignupAdmin signup) {
        Optional<Plan> planOpt = planStore.getPlan(signup.getPlanid());
        if (!planOpt.isPresent()) {
            log.error("Signup for plan that does not exist, planid {} email {} phone {}",
                    signup.getPlanid(), signup.getEmail(), signup.getPhone());
            throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Plan does not exist");
        }
        Plan plan = planOpt.get();

        String passwordHashed = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, signup.getPassword(), signup.getEmail());
        Account account = new Account(
                signup.getEmail(),
                plan.getPlanid(),
                Instant.now(),
                signup.getName(),
                passwordHashed,
                signup.getPhone(),
                signup.getPaymentToken(),
                ImmutableSet.of());
        accountStore.createAccount(account);

        AccountStore.AccountSession accountSession = accountStore.createSession(
                account.getEmail(),
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookieUtil.setAuthCookie(response, ACCOUNT_AUTH_COOKIE_NAME, accountSession.getSessionId(), accountSession.getTtlInEpochSec(), configApp.domain());

        // TODO setup recurring billing
        // TODO for now, the only way to signup is if you guess the payment token to be "letmein"
        if (!"letmein".equals(signup.getPaymentToken())) {
            throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Sign ups are not currently allowed");
        }

        return account.toAccountAdmin(planStore);
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public AccountAdmin accountUpdateAdmin(AccountUpdateAdmin accountUpdateAdmin) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = null;
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getName())) {
            account = accountStore.updateAccountName(accountSession.getEmail(), accountUpdateAdmin.getName());
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getPassword())) {
            account = accountStore.updateAccountPassword(accountSession.getEmail(), accountUpdateAdmin.getPassword(), accountSession.getSessionId());
        }
        if (!Strings.isNullOrEmpty(accountUpdateAdmin.getEmail())) {
            account = accountStore.updateAccountEmail(accountSession.getEmail(), accountUpdateAdmin.getEmail());
        }
        return (account == null
                ? accountStore.getAccount(accountSession.getEmail()).orElseThrow(() -> new IllegalStateException("Unknown account with email " + accountSession.getEmail()))
                : account)
                .toAccountAdmin(planStore);
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public LegalResponse legalGet() {
        return new LegalResponse(legalStore.termsOfService(), legalStore.privacyPolicy());
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
