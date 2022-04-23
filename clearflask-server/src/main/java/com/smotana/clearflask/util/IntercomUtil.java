// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.hash.HashFunction;
import com.google.common.hash.Hashing;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import java.util.Optional;
import java.util.function.Function;

@Slf4j
@Singleton
public class IntercomUtil {

    public interface Config {
        @DefaultValue("")
        String identityVerificationSecret();

        Observable<String> identityVerificationSecretObservable();
    }

    @Inject
    private Config config;

    private volatile Optional<Function<String, String>> emailToIdentityOpt = Optional.empty();

    @Inject
    private void setup() {
        Runnable updateHash = () -> this.emailToIdentityOpt = Optional.ofNullable(Strings.emptyToNull(config.identityVerificationSecret()))
                .map(this::getEmailToIdentityFun);
        config.identityVerificationSecretObservable().subscribe(secret -> updateHash.run());
        updateHash.run();
    }

    public Optional<String> getIdentity(String email) {
        return emailToIdentityOpt.map(fun -> fun.apply(email));
    }

    public Function<String, String> getEmailToIdentityFun(String secret) {
        HashFunction hashFunction = Hashing.hmacSha256(secret.getBytes());
        return (String email) -> hashFunction.hashString(email, Charsets.UTF_8).toString();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(IntercomUtil.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
