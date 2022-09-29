// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask;

import com.github.rholder.retry.RetryerBuilder;
import com.github.rholder.retry.StopStrategies;
import com.github.rholder.retry.WaitStrategies;

import java.util.concurrent.TimeUnit;

public class TestUtil {

    public interface Assertable {
        void assertIt() throws Exception;
    }

    public static void retry(Assertable assertable) throws Exception {
        RetryerBuilder.newBuilder()
                .withStopStrategy(StopStrategies.stopAfterDelay(30, TimeUnit.SECONDS))
                .withWaitStrategy(WaitStrategies.exponentialWait())
                .retryIfExceptionOfType(Throwable.class)
                .build()
                .call(() -> {
                    assertable.assertIt();
                    return null;
                });
    }
}
