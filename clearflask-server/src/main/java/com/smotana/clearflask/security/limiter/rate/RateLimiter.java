package com.smotana.clearflask.security.limiter.rate;

public interface RateLimiter {

    boolean tryAcquire(
            String target,
            int permits,
            double prechargedDuration,
            double permitsPerSecond,
            double capacityInSeconds);

    boolean tryAcquire(
            String target,
            int permits,
            double prechargedDuration,
            double... alternatingPermitsPerSecondAndCapacityInSeconds);

    void clearAll();
}
