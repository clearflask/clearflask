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

    private volatile Optional<HashFunction> identityHashFunctionOpt = Optional.empty();

    @Inject
    private void setup() {
        Runnable updateHash = () -> this.identityHashFunctionOpt = Optional.ofNullable(Strings.emptyToNull(config.identityVerificationSecret()))
                .map(secret -> Hashing.hmacSha256(secret.getBytes()));
        config.identityVerificationSecretObservable().subscribe(secret -> updateHash.run());
        updateHash.run();
    }

    public Optional<String> getIdentity(String email) {
        return identityHashFunctionOpt.map(fun -> fun.hashString(email, Charsets.UTF_8).toString());
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
