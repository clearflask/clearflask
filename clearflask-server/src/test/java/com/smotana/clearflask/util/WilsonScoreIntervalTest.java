// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameter;
import org.junit.runners.Parameterized.Parameters;

import java.util.Optional;

import static org.junit.Assert.assertEquals;

@Slf4j
@RunWith(Parameterized.class)
public class WilsonScoreIntervalTest {

    @Parameter(0)
    public double confidenceLevel;
    @Parameter(1)
    public int numberOfTrials;
    @Parameter(2)
    public int numberOfSuccesses;

    @Parameters(name = "{0} {1} {2}")
    public static Object[][] data() {
        return new Object[][]{
                {0.95d, 4, 3},
                {0.95d, 4, 6},
                {0.95d, 40, 40},
                {2.0d, 4, 3},
                {0.90d, 4123, 3321},
                {0.20d, 76223, 890},
                {0.95d, 76223, 76223},
                {0.95d, 76223, 0},
                {0.95d, 0, 0},
        };
    }

    @Test(timeout = 10_000L)
    public void test() {
        Throwable expectedThrowable = null;
        Double expectedLowerBound = null;
        try {
            expectedLowerBound = tryExpected();
            log.info("Expected lower bound {}", expectedLowerBound);
        } catch (Throwable ex) {
            expectedThrowable = ex;
            log.info("Expected throwable", expectedThrowable);
        }

        Throwable actualThrowable = null;
        Double actualLowerBound = null;
        try {
            actualLowerBound = tryExpected();
            log.info("Actual lower bound {}", actualLowerBound);
        } catch (Throwable ex) {
            actualThrowable = ex;
            log.info("Expected throwable", actualThrowable);
        }

        assertEquals(Optional.ofNullable(expectedThrowable).map(Throwable::toString),
                Optional.ofNullable(actualThrowable).map(Throwable::toString));
        assertEquals(expectedLowerBound, actualLowerBound);
    }

    private double tryExpected() {
        return new org.apache.commons.math3.stat.interval.WilsonScoreInterval()
                .createInterval(numberOfTrials, numberOfSuccesses, confidenceLevel)
                .getLowerBound();
    }

    private double tryActual() {
        return new WilsonScoreInterval(confidenceLevel).lowerBound(numberOfTrials, numberOfSuccesses);
    }
}