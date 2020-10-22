package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.http.HttpServletResponse;
import java.util.Optional;
import java.util.function.Predicate;

import static com.smotana.clearflask.web.resource.AccountResource.ACCOUNT_AUTH_COOKIE_NAME;
import static com.smotana.clearflask.web.resource.AccountResource.SUPER_ADMIN_AUTH_COOKIE_NAME;
import static com.smotana.clearflask.web.resource.UserResource.USER_AUTH_COOKIE_NAME_PREFIX;

@Singleton
@Slf4j
public class MockAuthCookie implements AuthCookie {


    @Inject(optional = true)
    private MockExtendedSecurityContext mockExtendedSecurityContext;
    @Inject(optional = true)
    private AccountStore accountStore;
    @Inject(optional = true)
    private UserStore userStore;

    private Optional<AccountSession> accountSession = Optional.empty();
    private Optional<AccountSession> superAdminSession = Optional.empty();
    private Optional<UserSession> userSession = Optional.empty();

    @Override
    public void setAuthCookie(HttpServletResponse response, String cookieName, String sessionId, long ttlInEpochSec) {
        if (mockExtendedSecurityContext != null) {
            if (ACCOUNT_AUTH_COOKIE_NAME.equals(cookieName)) {
                if (accountStore != null) {
                    accountSession = accountStore.getSession(sessionId);
                    updateSecurityContext();
                }
            } else if (SUPER_ADMIN_AUTH_COOKIE_NAME.equals(cookieName)) {
                if (accountStore != null) {
                    superAdminSession = accountStore.getSession(sessionId);
                    updateSecurityContext();
                }
            } else if (cookieName.startsWith(USER_AUTH_COOKIE_NAME_PREFIX)) {
                if (userStore != null) {
                    userSession = userStore.getSession(sessionId);
                    updateSecurityContext();
                }
            }
        }
    }

    @Override
    public void unsetAuthCookie(HttpServletResponse response, String cookieName) {
        if (mockExtendedSecurityContext != null) {
            if (ACCOUNT_AUTH_COOKIE_NAME.equals(cookieName)) {
                accountSession = Optional.empty();
            } else if (cookieName.startsWith(USER_AUTH_COOKIE_NAME_PREFIX)) {
                userSession = Optional.empty();
            }
            updateSecurityContext();
        }
    }

    private void updateSecurityContext() {
        if (mockExtendedSecurityContext != null) {
            ExtendedPrincipal principal = null;
            Predicate<String> userHasRolePredicate = role -> false;
            if (accountSession.isPresent() || userSession.isPresent()) {
                principal = new ExtendedPrincipal(
                        accountSession.map(AccountSession::getAccountId).orElseGet(() -> userSession.map(UserSession::getUserId).orElse("127.0.0.1")),
                        "127.0.0.1",
                        accountSession,
                        superAdminSession,
                        userSession);
                userHasRolePredicate = role -> {
                    switch (role) {
                        case Role.SUPER_ADMIN:
                            return superAdminSession.isPresent();
                        case Role.ADMINISTRATOR_ACTIVE:
                        case Role.PROJECT_OWNER_ACTIVE:
                            return accountSession.isPresent();
                        case Role.PROJECT_MODERATOR:
                        case Role.PROJECT_MODERATOR_ACTIVE:
                            return userSession.isPresent() && userSession.get().getIsMod() == Boolean.TRUE;
                        case Role.PROJECT_USER:
                        case Role.IDEA_OWNER:
                        case Role.COMMENT_OWNER:
                            return userSession.isPresent();
                        default:
                            return false;
                    }
                };
            }
            mockExtendedSecurityContext.override(principal, userHasRolePredicate);
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AuthCookie.class).to(MockAuthCookie.class).asEagerSingleton();
            }
        };
    }
}
