package com.smotana.clearflask.security.limiter.challenge;

import com.google.common.cache.CacheBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Singleton
public class LocalChallengeLimiter implements ChallengeLimiter {

    public interface Config {
        // TODO Enable after client supports captcha challenges
        @DefaultValue("false")
        boolean enabled();

        @DefaultValue("PT15M")
        Duration inactivityPeriod();

        Observable<Duration> inactivityPeriodObservable();
    }

    @Inject
    private Config config;
    @Inject
    private Challenger challenger;

    private ConcurrentMap<String, Integer> attemptsCounter;

    @Inject
    private void setup() {
        config.inactivityPeriodObservable().subscribe(this::setupAttemptsCounter);
        setupAttemptsCounter(config.inactivityPeriod());
    }

    private void setupAttemptsCounter(Duration inactivityPeriod) {
        this.attemptsCounter = CacheBuilder.newBuilder()
                .expireAfterAccess(inactivityPeriod)
                .maximumSize(100000)
                .<String, Integer>build()
                .asMap();
    }

    @Override
    public Optional<String> process(long challengeAfter, String remoteIp, String target, Optional<String> challengeResponse) {
        if (!config.enabled()) {
            return Optional.empty();
        }

        int attemptsCount = attemptsCounter.compute(target, (k, ac) -> ac == null ? 1 : ac + 1);

        if (attemptsCount <= challengeAfter) {
            return Optional.empty();
        }

        if (!challengeResponse.isPresent()) {
            return Optional.of(challenger.issue(remoteIp, target));
        }

        if (!challenger.verify(remoteIp, target, challengeResponse.get())) {
            return Optional.of(challenger.issue(remoteIp, target));
        }

        return Optional.empty();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ChallengeLimiter.class).to(LocalChallengeLimiter.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
