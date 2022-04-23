// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.google.common.util.concurrent;

import com.google.common.util.concurrent.RateLimiter.SleepingStopwatch;

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
