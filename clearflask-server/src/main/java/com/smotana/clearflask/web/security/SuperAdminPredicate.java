// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;
import rx.functions.Action1;

import java.util.function.Predicate;
import java.util.regex.Pattern;

@Slf4j
@Singleton
public class SuperAdminPredicate {

    public interface Config {
        /** By default does not match anything */
        @DefaultValue(".^")
        String superAdminEmailRegex();

        Observable<String> superAdminEmailRegexObservable();
    }

    @Inject
    private Config config;

    private Predicate<String> superAdminEmailPredicate;

    @Inject
    private void setup() {
        Action1<String> compileSuperAdminEmailRegex = r -> superAdminEmailPredicate = Pattern.compile(r).asPredicate();
        config.superAdminEmailRegexObservable().subscribe(compileSuperAdminEmailRegex);
        compileSuperAdminEmailRegex.call(config.superAdminEmailRegex());
    }

    public boolean isEmailSuperAdmin(String email) {
        return superAdminEmailPredicate.test(email);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(SuperAdminPredicate.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
