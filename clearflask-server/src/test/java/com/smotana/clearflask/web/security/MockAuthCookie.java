package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.web.resource.UserResource;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.http.HttpServletResponse;
import java.util.Optional;
import java.util.function.Predicate;

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
    private Optional<UserSession> userSession = Optional.empty();

    @Override
    public void setAuthCookie(HttpServletResponse response, String cookieName, String sessionId, long ttlInEpochSec) {
        if (mockExtendedSecurityContext != null) {
            switch (cookieName) {
                case AccountResource.ACCOUNT_AUTH_COOKIE_NAME:
                    if (accountStore != null) {
                        accountSession = accountStore.getSession(sessionId);
                        updateSecurityContext();
                    }
                    break;
                case UserResource.USER_AUTH_COOKIE_NAME:
                    if (userStore != null) {
                        userSession = userStore.getSession(sessionId);
                        updateSecurityContext();
                    }
                    break;
            }
        }
    }

    @Override
    public void unsetAuthCookie(HttpServletResponse response, String cookieName) {
        if (mockExtendedSecurityContext != null) {
            switch (cookieName) {
                case AccountResource.ACCOUNT_AUTH_COOKIE_NAME:
                    accountSession = Optional.empty();
                    break;
                case UserResource.USER_AUTH_COOKIE_NAME:
                    userSession = Optional.empty();
                    break;
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
                        accountSession.map(AccountSession::getAccountId).orElseGet(() -> userSession.map(UserSession::getUserId).orElse(null)),
                        accountSession,
                        userSession);
                userHasRolePredicate = role -> {
                    switch (role) {
                        case Role.ADMINISTRATOR_ACTIVE:
                        case Role.PROJECT_OWNER_ACTIVE:
                            return accountSession.isPresent();
                        case Role.USER:
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
