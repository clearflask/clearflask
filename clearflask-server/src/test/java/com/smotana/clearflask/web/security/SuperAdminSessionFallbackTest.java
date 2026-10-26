// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.resource.AccountResource;
import org.junit.Test;
import org.mockito.ArgumentCaptor;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.core.Cookie;
import javax.ws.rs.core.MultivaluedHashMap;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class SuperAdminSessionFallbackTest {
    private static final String SUPER_SESSION = "11111111111111111111111111111111";
    private static final String REGULAR_SESSION = "22222222222222222222222222222222";
    private static final String SUPER_EMAIL = "owner@example.com";

    @Test
    public void verifiedSuperSessionAloneRestoresOwnAdministratorIdentity() throws Exception {
        Fixture fixture = new Fixture();
        fixture.session(AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME, SUPER_SESSION, "owner", SUPER_EMAIL);
        ExtendedSecurityContext context = fixture.authenticate(null);

        assertIdentity(context, "owner", "owner");
        assertTrue(context.isUserInRole(Role.ADMINISTRATOR));
        assertTrue(context.isUserInRole(Role.SUPER_ADMIN));
    }

    @Test
    public void revokedImpersonatedSessionFallsBackToVerifiedSuperAccount() throws Exception {
        Fixture fixture = new Fixture();
        fixture.session(AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME, SUPER_SESSION, "owner", SUPER_EMAIL);
        fixture.cookie(AccountResource.ACCOUNT_AUTH_COOKIE_NAME, REGULAR_SESSION);
        // A deleted impersonated account has no valid session in the store.
        when(fixture.accounts.getSession(REGULAR_SESSION)).thenReturn(Optional.empty());

        ExtendedSecurityContext context = fixture.authenticate(null);
        assertIdentity(context, "owner", "owner");
        assertTrue(context.isUserInRole(Role.ADMINISTRATOR));
    }

    @Test
    public void validImpersonationKeepsRegularIdentityAndProjectPermissions() throws Exception {
        Fixture fixture = new Fixture();
        fixture.session(AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME, SUPER_SESSION, "owner", SUPER_EMAIL);
        fixture.session(AccountResource.ACCOUNT_AUTH_COOKIE_NAME, REGULAR_SESSION, "customer", "customer@example.com");
        fixture.project("customer-project", "customer");
        fixture.project("owner-project", "owner");

        ExtendedSecurityContext customerProject = fixture.authenticate("customer-project");
        assertIdentity(customerProject, "customer", "owner");
        assertTrue(customerProject.isUserInRole(Role.ADMINISTRATOR));
        assertTrue(customerProject.isUserInRole(Role.SUPER_ADMIN));
        assertTrue(customerProject.isUserInRole(Role.PROJECT_ADMIN));
        assertTrue(customerProject.isUserInRole(Role.PROJECT_ADMIN_ACTIVE));
        assertFalse(fixture.authenticate("owner-project").isUserInRole(Role.PROJECT_ADMIN));
    }

    @Test
    public void ordinaryRegularSessionRemainsAuthenticatedWithoutSuperPrivileges() throws Exception {
        Fixture fixture = new Fixture();
        fixture.session(AccountResource.ACCOUNT_AUTH_COOKIE_NAME, REGULAR_SESSION, "customer", "customer@example.com");
        fixture.project("customer-project", "customer");

        ExtendedSecurityContext context = fixture.authenticate("customer-project");
        assertIdentity(context, "customer", null);
        assertTrue(context.isUserInRole(Role.ADMINISTRATOR));
        assertTrue(context.isUserInRole(Role.PROJECT_ADMIN));
        assertFalse(context.isUserInRole(Role.SUPER_ADMIN));
    }

    @Test
    public void nonSuperSessionInSuperCookieDoesNotGrantAdministratorIdentity() throws Exception {
        Fixture fixture = new Fixture();
        fixture.session(AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME, SUPER_SESSION, "customer", "customer@example.com");
        assertUnauthenticated(fixture.authenticate(null));
    }

    @Test
    public void expiredOrRevokedSuperSessionDoesNotAuthenticate() throws Exception {
        Fixture fixture = new Fixture();
        fixture.cookie(AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME, SUPER_SESSION);
        // Session lookup validates expiry/revocation; an invalid session is absent.
        when(fixture.accounts.getSession(SUPER_SESSION)).thenReturn(Optional.empty());
        assertUnauthenticated(fixture.authenticate(null));
        verify(fixture.accounts).getSession(SUPER_SESSION);
    }

    @Test
    public void malformedSuperCookieNeverReachesSessionLookup() throws Exception {
        Fixture fixture = new Fixture();
        fixture.cookie(AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME, "not-a-session");
        assertUnauthenticated(fixture.authenticate(null));
        verify(fixture.accounts, never()).getSession(anyString());
    }

    @Test
    public void superFallbackStillCannotAccessAnUnrelatedProject() throws Exception {
        Fixture fixture = new Fixture();
        fixture.session(AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME, SUPER_SESSION, "owner", SUPER_EMAIL);
        fixture.project("own-project", "owner");
        fixture.project("foreign-project", "someone-else");

        ExtendedSecurityContext own = fixture.authenticate("own-project");
        assertIdentity(own, "owner", "owner");
        assertTrue(own.isUserInRole(Role.ADMINISTRATOR));
        assertTrue(own.isUserInRole(Role.PROJECT_ADMIN));
        assertTrue(own.isUserInRole(Role.PROJECT_ADMIN_ACTIVE));
        ExtendedSecurityContext foreign = fixture.authenticate("foreign-project");
        assertTrue(foreign.isUserInRole(Role.ADMINISTRATOR));
        assertFalse(foreign.isUserInRole(Role.PROJECT_ADMIN));
        assertFalse(foreign.isUserInRole(Role.PROJECT_ADMIN_ACTIVE));
    }

    private static void assertIdentity(ExtendedSecurityContext context, String accountId, String superAccountId) {
        assertEquals(Optional.ofNullable(accountId), context.getUserPrincipal().getAuthenticatedAccountIdOpt());
        assertEquals(Optional.ofNullable(superAccountId), context.getUserPrincipal().getAuthenticatedSuperAccountIdOpt());
        if (accountId != null) assertEquals(accountId, context.getUserPrincipal().getName());
    }

    private static void assertUnauthenticated(ExtendedSecurityContext context) {
        assertIdentity(context, null, null);
        assertFalse(context.isUserInRole(Role.ADMINISTRATOR));
        assertFalse(context.isUserInRole(Role.SUPER_ADMIN));
    }

    private static class Fixture {
        final AuthenticationFilter filter = new AuthenticationFilter();
        final AccountStore accounts = mock(AccountStore.class);
        final ProjectStore projects = mock(ProjectStore.class);
        final Map<String, Cookie> cookies = new HashMap<>();

        Fixture() throws Exception {
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getRemoteAddr()).thenReturn("127.0.0.1");
            AuthCookie authCookie = mock(AuthCookie.class);
            when(authCookie.wireName(anyString())).thenAnswer(call -> "__Host-" + call.getArgument(0));
            SuperAdminPredicate superAdmin = mock(SuperAdminPredicate.class);
            when(superAdmin.isEmailSuperAdmin(SUPER_EMAIL)).thenReturn(true);
            when(accounts.getSession(anyString())).thenReturn(Optional.empty());
            inject(filter, "request", request);
            inject(filter, "env", Environment.TEST);
            inject(filter, "accountStore", accounts);
            inject(filter, "projectStore", projects);
            inject(filter, "userStore", mock(UserStore.class));
            inject(filter, "authCookie", authCookie);
            inject(filter, "superAdminPredicate", superAdmin);
        }

        void cookie(String name, String sessionId) {
            String wireName = "__Host-" + name;
            cookies.put(wireName, new Cookie(wireName, sessionId));
        }

        void session(String cookieName, String sessionId, String accountId, String email) {
            cookie(cookieName, sessionId);
            when(accounts.getSession(sessionId)).thenReturn(Optional.of(new AccountStore.AccountSession(
                    sessionId, accountId, email, Instant.now().plusSeconds(3600).getEpochSecond())));
            AccountStore.Account account = mock(AccountStore.Account.class);
            when(account.getAccountId()).thenReturn(accountId);
            when(account.getEmail()).thenReturn(email);
            when(account.getStatus()).thenReturn(SubscriptionStatus.ACTIVE);
            when(accounts.getAccount(eq(accountId), anyBoolean())).thenReturn(Optional.of(account));
        }

        void project(String projectId, String accountId) {
            ProjectStore.Project project = mock(ProjectStore.Project.class);
            when(project.getAccountId()).thenReturn(accountId);
            when(project.isAdmin(anyString())).thenAnswer(call -> accountId.equals(call.getArgument(0)));
            when(projects.getProject(projectId, true)).thenReturn(Optional.of(project));
        }

        ExtendedSecurityContext authenticate(String projectId) throws Exception {
            ContainerRequestContext request = mock(ContainerRequestContext.class);
            UriInfo uri = mock(UriInfo.class);
            MultivaluedHashMap<String, String> path = new MultivaluedHashMap<>();
            if (projectId != null) path.putSingle("projectId", projectId);
            when(uri.getPathParameters()).thenReturn(path);
            when(request.getUriInfo()).thenReturn(uri);
            when(request.getCookies()).thenReturn(cookies);
            filter.filter(request);
            ArgumentCaptor<SecurityContext> context = ArgumentCaptor.forClass(SecurityContext.class);
            verify(request).setSecurityContext(context.capture());
            return (ExtendedSecurityContext) context.getValue();
        }
    }

    private static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
