// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.google.common.util.concurrent;

import com.google.common.util.concurrent.RateLimiter.SleepingStopwatch;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.atomic.AtomicLong;

@Slf4j
public class ControllableSleepingStopwatch extends SleepingStopwatch {

    private AtomicLong elapsedInMicros = new AtomicLong(System.nanoTime());

    public long addMicros(long micros) {
        return elapsedInMicros.addAndGet(micros);
    }

    @Override
    protected long readMicros() {
        return elapsedInMicros.get();
    }

    @Override
    protected void sleepMicrosUninterruptibly(long micros) {
        // Add without actually sleeping for test purposes
        addMicros(micros);
    }
}
