// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security.limiter;

import com.google.common.collect.Sets;
import com.google.common.util.concurrent.ControllableSleepingStopwatch;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.convert.ConfigSystems;
import com.smotana.clearflask.security.limiter.challenge.LocalChallengeLimiter;
import com.smotana.clearflask.security.limiter.challenge.MockChallenger;
import com.smotana.clearflask.security.limiter.rate.LocalRateLimiter;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.mockito.Mockito;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.core.UriInfo;
import java.lang.annotation.Annotation;
import java.time.Duration;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.IntStream;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

@Slf4j
public class TieredWebLimiterTest extends AbstractTest {

    @Inject
    private Limiter limiter;
    @Inject
    private ControllableSleepingStopwatch stopwatch;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                LocalChallengeLimiter.module(),
                TieredWebLimiter.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(TieredWebLimiter.Config.class, om -> {
                    om.override(om.id().tiers()).withValue(ConfigSystems.configSafeCollection(Sets.newHashSet(
                            Duration.ofMinutes(1),
                            Duration.ofHours(1),
                            Duration.ofDays(1)
                    )));
                    om.override(om.id().prechargedPeriod()).withValue(Duration.ofHours(1));
                    om.override(om.id().qpsBase()).withValue(1d);
                    om.override(om.id().qpsStepUpMultiplier()).withValue(3.16d);
                }));
                install(ConfigSystem.overrideModule(LocalChallengeLimiter.Config.class, om -> {
                    om.override(om.id().enabled()).withValue(true);
                }));
            }
        }));

        install(MockChallenger.module());

        install(LocalRateLimiter.module());
        ControllableSleepingStopwatch controllableSleepingStopwatch = new ControllableSleepingStopwatch();
        install(GuavaRateLimiters.testModule(controllableSleepingStopwatch));
        bind(ControllableSleepingStopwatch.class).toInstance(controllableSleepingStopwatch);
    }


    @Test(timeout = 10_000L)
    public void testChallenger() throws Exception {
        Limit limit = createLimit(Optional.empty(), Optional.of(3));
        for (int i = 0; i < limit.challengeAfter(); i++) {
            limiter.filter(createRequestContext(Optional.empty()), limit, "127.0.0.1", "a");
        }
        try {
            limiter.filter(createRequestContext(Optional.empty()), limit, "127.0.0.1", "a");
            fail();
        } catch (WebApplicationException ex) {
            // Expected
        }
        try {
            limiter.filter(createRequestContext(Optional.of("false")), limit, "127.0.0.1", "a");
            fail();
        } catch (WebApplicationException ex) {
            // Expected
        }
        limiter.filter(createRequestContext(Optional.of("true")), limit, "127.0.0.1", "a");
    }

    @Test(timeout = 10_000L)
    public void testLimiterFresh() throws Exception {
        testLimiter(minutes -> {
            if (minutes == 0) {
                return 20d;
            } else if (minutes < 5) {
                return 10d;
            } else {
                return 1d;
            }
        }, 60);
    }

    @Test(timeout = 30_000L)
    public void testLimiterFullyCharged() throws Exception {
        configSet(TieredWebLimiter.Config.class, "prechargedPeriod", "P100D");
        stopwatch.addMicros(Duration.ofDays(100L).toSeconds() * 1_000_000L);
        testLimiter(minutes -> {
            if (minutes == 0) {
                return 20d;
            } else if (minutes < 23) {
                return 10d;
            } else if (minutes < 403) {
                return 3.16d;
            } else {
                return 1d;
            }
        }, 500);
    }

    private void testLimiter(Function<Integer, Double> minuteToExpectedQps, int minutesToAssert) throws Exception {
        Limit limit = createLimit(Optional.of(1), Optional.empty());
        for (int i = 0; i < minutesToAssert; i++) {
            int[] successes = new int[60];
            for (int j = 0; j < successes.length; j++) {
                int success = 0;
                try {
                    for (; ; ) {
                        limiter.filter(null, limit, "127.0.0.1", "a");
                        success++;
                    }
                } catch (ApiException ignored) {
                }
                successes[j] = success;
                stopwatch.addMicros(1_000_000);
            }
            int successesSum = IntStream.of(successes).sum();
            double qps = successesSum / 60d;
            double qpsExpected = minuteToExpectedQps.apply(i);
            assertEquals(qpsExpected, qps, 0.3);
            // Too verbose, uncomment to see better
            //log.info("{}m {}qps {}:\t{}", i, qps, successesSum, successes);
        }
    }

    private Limit createLimit(Optional<Integer> requiredPermitsOpt, Optional<Integer> challengeAfterOpt) {
        return new Limit() {
            @Override
            public Class<? extends Annotation> annotationType() {
                return Limit.class;
            }

            @Override
            public int requiredPermits() {
                return requiredPermitsOpt.orElse(-1);
            }

            @Override
            public int challengeAfter() {
                return challengeAfterOpt.orElse(-1);
            }
        };
    }

    private ContainerRequestContext createRequestContext(Optional<String> solutionOpt) {
        UriInfo uriInfo = Mockito.mock(UriInfo.class);
        Mockito.when(uriInfo
                .getPath())
                .thenReturn("/path/to/resource");
        ContainerRequestContext contextMock = Mockito.mock(ContainerRequestContext.class);
        Mockito.when(contextMock
                .getHeaderString(TieredWebLimiter.SOLUTION_HEADER))
                .thenReturn(solutionOpt.orElse(null));
        Mockito.when(contextMock
                .getUriInfo())
                .thenReturn(uriInfo);
        Mockito.when(contextMock
                .getMethod())
                .thenReturn("GET");
        return contextMock;
    }
}