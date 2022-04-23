// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
