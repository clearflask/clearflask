package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal.ExtendedPrincipalBuilder;
import lombok.NonNull;
import org.mockito.Mockito;

import javax.ws.rs.container.ContainerRequestContext;
import java.util.Optional;
import java.util.function.Predicate;

@Singleton
public class MockExtendedSecurityContext extends ExtendedSecurityContext {

    @Inject(optional = true)
    private AccountStore accountStore;
    @Inject(optional = true)
    private UserStore userStore;

    private ExtendedPrincipal userPrincipalBase;
    Optional<String> accountIdOpt;
    Optional<String> superAccountIdOpt;
    private Predicate<String> userHasRolePredicate;

    protected MockExtendedSecurityContext() {
        super(null, role -> false, Mockito.mock(ContainerRequestContext.class));
    }

    public void override(ExtendedPrincipal userPrincipal, @NonNull Predicate<String> userHasRolePredicate) {
        this.userPrincipalBase = userPrincipal;
        this.userHasRolePredicate = userHasRolePredicate;

    }

    @Override
    public boolean isSecure() {
        return true;
    }

    @Override
    public ExtendedPrincipal getUserPrincipal() {
        if (userPrincipalBase == null) {
            return null;
        }
        ExtendedPrincipalBuilder extendedPrincipalBuilder = userPrincipalBase.toBuilder();

        // Refresh account details every time
        if (accountStore != null) {
            extendedPrincipalBuilder.accountOpt(userPrincipalBase.getAccountOpt()
                    .map(AccountStore.Account::getAccountId)
                    .flatMap(accountStore::getAccountByAccountId));
        }
        if (accountStore != null) {
            extendedPrincipalBuilder.superAccountOpt(userPrincipalBase.getSuperAccountOpt()
                    .map(AccountStore.Account::getAccountId)
                    .flatMap(accountStore::getAccountByAccountId));
        }

        return extendedPrincipalBuilder.build();
    }

    @Override
    public boolean isUserInRole(String role) {
        return userHasRolePredicate.test(role);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ExtendedSecurityContext.class).to(MockExtendedSecurityContext.class).asEagerSingleton();
            }
        };
    }
}
