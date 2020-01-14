package com.smotana.clearflask.security.limiter.rate;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class LocalRateLimiter implements RateLimiter {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();
    }

    private final ConcurrentMap<Double, Cache<String, com.google.common.util.concurrent.RateLimiter>> rateLimiters = CacheBuilder.newBuilder()
            .expireAfterAccess(Duration.ofDays(30))
            .<Double, Cache<String, com.google.common.util.concurrent.RateLimiter>>build()
            .asMap();

    @Inject
    private Config config;
    @Inject
    private GuavaRateLimiters guavaRateLimiters;

    @Override
    public boolean tryAcquire(String target, int permits, double prechargedDuration, double permitsPerSecond, double capacityInSeconds) {
        return getRateLimiter(target, permitsPerSecond, prechargedDuration, capacityInSeconds).tryAcquire(permits);
    }

    @Override
    public boolean tryAcquire(String target, int permits, double prechargedDuration, double... altPermCap) {
        if (!config.enabled()) {
            return true;
        }
        checkArgument(altPermCap.length % 2 == 0);

        for (int i = 0; i < altPermCap.length; i += 2) {
            if (!getRateLimiter(target, prechargedDuration, altPermCap[i], altPermCap[i + 1]).tryAcquire(permits)) {
                return false;
            }
        }
        return true;
    }

    @Override
    public void clearAll() {
        rateLimiters.clear();
    }

    private com.google.common.util.concurrent.RateLimiter getRateLimiter(String target, double prechargedDuration, double permitsPerSecond, double capacityInSeconds) {
        Cache<String, com.google.common.util.concurrent.RateLimiter> rateLimiterCache = rateLimiters.get(capacityInSeconds);
        if (rateLimiterCache == null) {
            rateLimiterCache = rateLimiters.computeIfAbsent(capacityInSeconds, capacityInSec -> CacheBuilder.newBuilder()
                    .expireAfterAccess(capacityInSec.longValue(), TimeUnit.SECONDS)
                    .maximumSize(100000)
                    .build());
        }
        try {
            return rateLimiterCache.get(target, () -> guavaRateLimiters.create(
                    permitsPerSecond, capacityInSeconds, Math.min(capacityInSeconds, prechargedDuration)));
        } catch (ExecutionException ex) {
            throw new RuntimeException(ex);
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(RateLimiter.class).to(LocalRateLimiter.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
