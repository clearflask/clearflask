package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import lombok.NonNull;
import org.mockito.Mockito;

import javax.ws.rs.container.ContainerRequestContext;
import java.util.function.Predicate;

@Singleton
public class MockExtendedSecurityContext extends ExtendedSecurityContext {

    private ExtendedPrincipal userPrincipal;
    @NonNull
    private Predicate<String> userHasRolePredicate;

    protected MockExtendedSecurityContext() {
        super(null, role -> false, Mockito.mock(ContainerRequestContext.class));
    }

    public void override(ExtendedPrincipal userPrincipal, @NonNull Predicate<String> userHasRolePredicate) {
        this.userPrincipal = userPrincipal;
        this.userHasRolePredicate = userHasRolePredicate;
    }

    @Override
    public boolean isSecure() {
        return true;
    }

    @Override
    public ExtendedPrincipal getUserPrincipal() {
        return userPrincipal;
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
