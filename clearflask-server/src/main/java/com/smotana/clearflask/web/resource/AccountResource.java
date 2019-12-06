package com.smotana.clearflask.web.resource.api;

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
import com.smotana.clearflask.web.security.AuthCookieUtil;
import com.smotana.clearflask.web.security.AuthCookieUtil.AuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Path;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Singleton
@Path("/v1")
public class AccountResource implements AccountAdminApi {

    private interface Config {
        @DefaultValue("P30D")
        Duration sessionExpiry();

        @DefaultValue("P20D")
        Duration sessionRenewIfExpiringIn();
    }

    public static final String ACCOUNT_AUTH_COOKIE_NAME = "cf_act_auth";

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;
    @Context
    private SecurityContext securityContext;

    @Inject
    private Config config;
    @Inject
    private AccountStore accountStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private AuthCookieUtil authCookieUtil;

    @RolesAllowed({Role.ADMINISTRATOR})
    @Override
    public AccountAdmin accountBindAdmin() {
        if (!(securityContext instanceof ExtendedSecurityContext)) {
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED).build());
        }
        Optional<Session> accountSessionOpt = ((ExtendedSecurityContext) securityContext).getSession();
        if (!accountSessionOpt.isPresent()) {
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED).build());
        }
        Session session = accountSessionOpt.get();

        // Token refresh
        if (session.getExpiry().isAfter(Instant.now().plus(config.sessionRenewIfExpiringIn()))) {
            session = accountStore.refreshSession(
                    session.getAccountId(),
                    session.getSessionId(),
                    Instant.now().plus(config.sessionExpiry()));

            Cookie authCookie = new Cookie(
                    ACCOUNT_AUTH_COOKIE_NAME,
                    authCookieUtil.encode(new AuthCookie(
                            session.getAccountId(),
                            session.getSessionId(),
                            AuthCookieUtil.Type.ACCOUNT)));
            authCookie.setDomain(request.getServerName());
            authCookie.setPath("/");
            authCookie.setSecure(true);
            authCookie.setHttpOnly(true);
            authCookie.setMaxAge((int) Duration.between(Instant.now(), session.getExpiry()).getSeconds());
            response.addCookie(authCookie);
        }

        // Fetch account
        Optional<Account> accountOpt = accountStore.getAccount(session.getAccountId());
        if (!accountOpt.isPresent()) {
            log.info("Account bind on valid session to non-existent account, revoking all sessions; accountId {} sessionId {}",
                    session.getAccountId(), session.getSessionId());
            accountStore.revokeSessions(session.getAccountId());
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
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED).build());
        }
        Account account = accountOpt.get();

        if (!account.getPassword().equals(credentials.getPassword())) {
            throw new WebApplicationException(Response.status(Response.Status.UNAUTHORIZED).build());
        }

        Session session = accountStore.createSession(
                account.getAccountId(),
                Instant.now().plus(config.sessionExpiry()));
        Cookie authCookie = new Cookie(
                ACCOUNT_AUTH_COOKIE_NAME,
                authCookieUtil.encode(new AuthCookie(
                        session.getAccountId(),
                        session.getSessionId(),
                        AuthCookieUtil.Type.ACCOUNT)));
        authCookie.setDomain(request.getServerName());
        authCookie.setPath("/");
        authCookie.setSecure(true);
        authCookie.setHttpOnly(true);
        authCookie.setMaxAge((int) Duration.between(Instant.now(), session.getExpiry()).getSeconds());
        response.addCookie(authCookie);

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
        if (!(securityContext instanceof ExtendedSecurityContext)) {
            return;
        }
        ((ExtendedSecurityContext) securityContext).getSession().ifPresent(session ->
                accountStore.revokeSession(session.getAccountId(), session.getSessionId()));
    }

    @PermitAll
    @Override
    public AccountAdmin accountSignupAdmin(AccountSignupAdmin signup) {
        Optional<Plan> planOpt = planStore.getPlan(signup.getPlanid());
        if (!planOpt.isPresent()) {
            throw new WebApplicationException(Response
                    .status(Response.Status.BAD_REQUEST)
                    .entity(new ErrorResponse("Plan does not exist")).build());
        }
        Plan plan = planOpt.get();

        Account account = new Account(
                UUID.randomUUID().toString(),
                ImmutableSet.of(plan.getPlanid()),
                signup.getCompany(),
                signup.getName(),
                signup.getEmail(),
                signup.getPassword(),
                signup.getPhone(),
                signup.getPaymentToken());
        accountStore.createAccount(account);

        Session session = accountStore.createSession(
                account.getAccountId(),
                Instant.now().plus(config.sessionExpiry()));
        Cookie authCookie = new Cookie(
                ACCOUNT_AUTH_COOKIE_NAME,
                authCookieUtil.encode(new AuthCookie(
                        session.getAccountId(),
                        session.getSessionId(),
                        AuthCookieUtil.Type.ACCOUNT)));
        authCookie.setDomain(request.getServerName());
        authCookie.setPath("/");
        authCookie.setSecure(true);
        authCookie.setHttpOnly(true);
        authCookie.setMaxAge((int) Duration.between(Instant.now(), session.getExpiry()).getSeconds());
        response.addCookie(authCookie);

        // TODO Stripe setup recurring billing

        return new AccountAdmin(
                planStore.mapIdsToPlans(account.getPlanIds()).asList(),
                account.getCompany(),
                account.getName(),
                account.getEmail(),
                account.getPhone());
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
