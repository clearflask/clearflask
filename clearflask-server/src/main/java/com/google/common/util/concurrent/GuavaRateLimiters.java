// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.google.common.util.concurrent;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.util.concurrent.RateLimiter.SleepingStopwatch;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class GuavaRateLimiters {

    @Inject
    private Provider<SleepingStopwatch> stopwatchProvider;

    public RateLimiter create(double permitsPerSecond, double capacityInSeconds, double prechargedInSeconds) {
        checkArgument(prechargedInSeconds >= 0, "Precharged %s must be >=0", prechargedInSeconds);
        checkArgument(capacityInSeconds >= 0, "Capacity %s must be >=0", capacityInSeconds);
        checkArgument(capacityInSeconds >= prechargedInSeconds, "Capacity %s must be larger or equal to precharged %s", capacityInSeconds, prechargedInSeconds);

        SleepingStopwatch stopwatch = stopwatchProvider.get();
        SmoothRateLimiter.SmoothBursty rateLimiter = new SmoothRateLimiter.SmoothBursty(stopwatch, capacityInSeconds);

        rateLimiter.setRate(permitsPerSecond);
        rateLimiter.storedPermits = prechargedInSeconds * permitsPerSecond;

        return rateLimiter;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(GuavaRateLimiters.class);
                bind(SleepingStopwatch.class).toProvider(SleepingStopwatch::createFromSystemTimer);
            }
        };
    }

    @VisibleForTesting
    public static Module testModule(SleepingStopwatch stopwatch) {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(GuavaRateLimiters.class);
                bind(SleepingStopwatch.class).toInstance(stopwatch);
            }
        };
    }
}
