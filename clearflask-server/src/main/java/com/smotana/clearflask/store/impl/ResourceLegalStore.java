package com.smotana.clearflask.store.impl;

import com.google.common.base.Charsets;
import com.google.common.io.Resources;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.smotana.clearflask.store.LegalStore;

public class ResourceLegalStore implements LegalStore {

    private String termsOfService;
    private String privacyPolicy;

    @Inject
    private void setup() throws Exception {
        this.termsOfService = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("legal/Terms-of-Service.md"), Charsets.UTF_8);
        this.privacyPolicy = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("legal/Privacy-Policy.md"), Charsets.UTF_8);
    }

    @Override
    public String termsOfService() {
        return termsOfService;
    }

    @Override
    public String privacyPolicy() {
        return privacyPolicy;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LegalStore.class).to(ResourceLegalStore.class).asEagerSingleton();
            }
        };
    }
}
