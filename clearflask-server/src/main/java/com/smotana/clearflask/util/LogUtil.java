// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.RateLimiter;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.TimeUnit;

@Slf4j
public class LogUtil {
    private static final LoadingCache<String, RateLimiter> logRateLimiters = CacheBuilder.newBuilder()
            .expireAfterAccess(10, TimeUnit.SECONDS)
            .build(new CacheLoader<>() {
                @Override
                public RateLimiter load(String key) throws Exception {
                    return RateLimiter.create(1d);
                }
            });
    private static final RateLimiter rateLimitingInfoLog = RateLimiter.create(10);

    private LogUtil() {
        // Disallow ctor
    }

    public static boolean rateLimitAllowLog(String identifier) {
        boolean allowed = logRateLimiters.getUnchecked(identifier).tryAcquire();
        if (!allowed) {
            if (rateLimitingInfoLog.tryAcquire()) {
                log.info("Rate limiting log lines for {}", identifier);
            }
        }
        return allowed;
    }
}
