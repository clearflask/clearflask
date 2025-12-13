package com.smotana.clearflask.core.email;

import junit.framework.TestCase;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.time.Duration;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Slf4j
@RunWith(Parameterized.class)
public class WeeklyDigestServiceNextRuntimeTest extends TestCase {

    @Parameterized.Parameter(0)
    public ZonedDateTime now;

    @Parameterized.Parameter(1)
    public int sendAtTime;

    @Parameterized.Parameter(2)
    public Duration expectedDuration;

    @Parameterized.Parameters(name = "now {0} sendAtTime {1}")
    public static Object[][] data() {
        return new Object[][]{
                {ZonedDateTime.of(2024, 3, 4, 10, 15, 0, 0, ZoneId.of("America/New_York")),
                        9,
                        Duration.ofHours(22).plusMinutes(45)},
                {ZonedDateTime.of(2024, 3, 4, 10, 15, 0, 0, ZoneId.of("America/Los_Angeles")),
                        9,
                        Duration.ofHours(22).plusMinutes(45)},
                {ZonedDateTime.of(2024, 3, 4, 8, 15, 0, 0, ZoneId.of("America/New_York")),
                        9,
                        Duration.ofHours(0).plusMinutes(45)},
        };
    }

    @Test(timeout = 10_000L)
    public void test() {
        assertEquals(expectedDuration, WeeklyDigestService.getNextRuntime(now, sendAtTime, 0));

        // Assert jitter
        assertTrue(expectedDuration.plusSeconds(10).compareTo(WeeklyDigestService.getNextRuntime(now, sendAtTime, 20)) >= 0);
        assertTrue(expectedDuration.minusSeconds(10).compareTo(WeeklyDigestService.getNextRuntime(now, sendAtTime, 20)) <= 0);
    }
}