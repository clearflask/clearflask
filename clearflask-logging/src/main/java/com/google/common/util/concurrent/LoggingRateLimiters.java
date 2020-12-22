package com.google.common.util.concurrent;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.util.concurrent.RateLimiter.SleepingStopwatch;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;

/** Copied over from GuavaRateLimiters and de-Guicified */
public class LoggingRateLimiters {

    public static RateLimiter create(double permitsPerSecond, double capacityInSeconds, double prechargedInSeconds) {
        checkArgument(prechargedInSeconds >= 0, "Precharged %s must be >=0", prechargedInSeconds);
        checkArgument(capacityInSeconds >= 0, "Capacity %s must be >=0", capacityInSeconds);
        checkArgument(capacityInSeconds >= prechargedInSeconds, "Capacity %s must be larger or equal to precharged %s", capacityInSeconds, prechargedInSeconds);

        SleepingStopwatch stopwatch = SleepingStopwatch.createFromSystemTimer();
        SmoothRateLimiter.SmoothBursty rateLimiter = new SmoothRateLimiter.SmoothBursty(stopwatch, capacityInSeconds);

        rateLimiter.setRate(permitsPerSecond);
        rateLimiter.storedPermits = prechargedInSeconds * permitsPerSecond;

        return rateLimiter;
    }
}
