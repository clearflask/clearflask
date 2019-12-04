package com.smotana.clearflask.testutil;

import com.github.rholder.retry.RetryerBuilder;
import com.github.rholder.retry.StopStrategies;
import com.github.rholder.retry.WaitStrategies;

import java.util.concurrent.TimeUnit;

public class RetryUtil {

    public interface Assertable {
        void assertIt() throws Exception;
    }

    public static void retry(Assertable assertable) throws Exception {
        RetryerBuilder.newBuilder()
                .withStopStrategy(StopStrategies.stopAfterDelay(5, TimeUnit.SECONDS))
                .withWaitStrategy(WaitStrategies.exponentialWait())
                .retryIfExceptionOfType(Throwable.class)
                .build()
                .call(() -> {
                    assertable.assertIt();
                    return null;
                });
    }
}
