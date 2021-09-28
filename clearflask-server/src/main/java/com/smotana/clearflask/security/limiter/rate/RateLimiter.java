// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.security.limiter.rate;

public interface RateLimiter {

    boolean tryAcquire(
            String target,
            int permits,
            double prechargedDurationInSeconds,
            double permitsPerSecond,
            double capacityInSeconds);

    boolean tryAcquire(
            String target,
            int permits,
            double prechargedDurationInSeconds,
            double... alternatingPermitsPerSecondAndCapacityInSeconds);

    void clearAll();
}
