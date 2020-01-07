package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.AccountAdminApi;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountLogin;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.ErrorResponse;
import com.smotana.clearflask.api.model.Plan;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.Session;
import com.smotana.clearflask.store.PlanStore;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.util.RealCookie;
import com.smotana.clearflask.web.security.AuthCookieUtil.AccountAuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.ForbiddenException;
import javax.ws.rs.Path;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Singleton
@Path("/v1")
public class AccountResource extends AbstractResource implements AccountAdminApi {

    private interface Config {
        @DefaultValue("P30D")
        Duration sessionExpiry();

        @DefaultValue("P20D")
        Duration sessionRenewIfExpiringIn();
    }

    public static final String ACCOUNT_AUTH_COOKIE_NAME = "cf_act_auth";

    @Inject
    private Config config;
    @Inject
    private AccountStore accountStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private PasswordUtil passwordUtil;

    @RolesAllowed({Role.ADMINISTRATOR})
    @Override
    public AccountAdmin accountBindAdmin() {
        Session session = getExtendedPrincipal().get().getAccountSessionOpt().get();

        // Token refresh
        if (session.getExpiry().isAfter(Instant.now().plus(config.sessionRenewIfExpiringIn()))) {
            session = accountStore.refreshSession(
                    session.getAccountId(),
                    session.getSessionId(),
                    Instant.now().plus(config.sessionExpiry()));

            setAuthCookie(session);
        }

        // Fetch account
        Optional<Account> accountOpt = accountStore.getAccount(session.getAccountId());
        if (!accountOpt.isPresent()) {
            log.info("Account bind on valid session to non-existent account, revoking all sessions; accountId {} sessionId {}",
                    session.getAccountId(), session.getSessionId());
            accountStore.revokeSessions(session.getAccountId());
            unsetAuthCookie();
            throw new ForbiddenException();
        }
        Account account = accountOpt.get();

        return new AccountAdmin(
                planStore.mapIdsToPlans(account.getPlanIds()).asList(),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                account.getPhone());
    }

    @PermitAll
    @Override
    public AccountAdmin accountLoginAdmin(AccountLogin credentials) {
        Optional<Account> accountOpt = accountStore.getAccountByEmail(credentials.getEmail());
        if (!accountOpt.isPresent()) {
            log.info("Account login with non-existent email {}", credentials.getEmail());
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED).entity(new ErrorResponse("Email or password incorrect")).build());
        }
        Account account = accountOpt.get();

        String passwordSupplied = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, credentials.getPassword(), account.getAccountId());
        if (!account.getPassword().equals(passwordSupplied)) {
            log.info("Account login incorrect password for email {}", credentials.getEmail());
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED).entity(new ErrorResponse("Email or password incorrect")).build());
        }
        log.debug("Successful account login for email {}", credentials.getEmail());

        Session session = accountStore.createSession(
                account.getAccountId(),
                Instant.now().plus(config.sessionExpiry()));
        setAuthCookie(session);

        return new AccountAdmin(
                planStore.mapIdsToPlans(account.getPlanIds()).asList(),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                account.getPhone());
    }

    @PermitAll
    @Override
    public void accountLogoutAdmin() {
        Optional<ExtendedPrincipal> extendedPrincipal = getExtendedPrincipal();
        if (!extendedPrincipal.isPresent()) {
            log.trace("Cannot logout account, already not logged in");
            return;
        }
        Session session = extendedPrincipal.get().getAccountSessionOpt().get();

        log.debug("Logout session for account {}", session.getAccountId());
        accountStore.revokeSession(session.getAccountId(), session.getSessionId());

        unsetAuthCookie();
    }

    @PermitAll
    @Override
    public AccountAdmin accountSignupAdmin(AccountSignupAdmin signup) {
        Optional<Plan> planOpt = planStore.getPlan(signup.getPlanid());
        if (!planOpt.isPresent()) {
            log.error("Signup for plan that does not exist, planid {} email {} company {} phone {}",
                    signup.getPlanid(), signup.getEmail(), signup.getCompany(), signup.getPhone());
            throw new WebApplicationException(Response
                    .status(Response.Status.BAD_REQUEST)
                    .entity(new ErrorResponse("Plan does not exist")).build());
        }
        Plan plan = planOpt.get();

        String accountId = UUID.randomUUID().toString();
        String passwordHashed = passwordUtil.saltHashPassword(PasswordUtil.Type.ACCOUNT, signup.getPassword(), accountId);
        Account account = new Account(
                accountId,
                ImmutableSet.of(plan.getPlanid()),
                signup.getCompany(),
                signup.getName(),
                signup.getEmail(),
                passwordHashed,
                signup.getPhone(),
                signup.getPaymentToken(),
                ImmutableSet.of());
        accountStore.createAccount(account);

        Session session = accountStore.createSession(
                account.getAccountId(),
                Instant.now().plus(config.sessionExpiry()));
        setAuthCookie(session);

        // TODO Stripe setup recurring billing

        return new AccountAdmin(
                planStore.mapIdsToPlans(account.getPlanIds()).asList(),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                account.getPhone());
    }

    private void setAuthCookie(Session session) {
        log.trace("Setting account auth cookie for account {}", session.getAccountId());
        RealCookie.builder()
                .name(ACCOUNT_AUTH_COOKIE_NAME)
                .value(new AccountAuthCookie(
                        session.getSessionId(),
                        session.getAccountId()))
                .path("/")
                .secure(securityContext.isSecure())
                .httpOnly(true)
                .expiry(session.getExpiry())
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

    private void unsetAuthCookie() {
        log.trace("Removing account auth cookie");
        RealCookie.builder()
                .name(ACCOUNT_AUTH_COOKIE_NAME)
                .value("")
                .path("/")
                .secure(securityContext.isSecure())
                .httpOnly(true)
                .expiry(Instant.EPOCH)
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
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
