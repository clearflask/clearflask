package com.smotana.clearflask.core.email;

import junit.framework.TestCase;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Slf4j
@RunWith(Parameterized.class)
public class WeeklyDigestServiceDigestRangeTest extends TestCase {

    @Parameterized.Parameter(0)
    public ZonedDateTime now;

    @Parameterized.Parameter(1)
    public Instant expectedStart;

    @Parameterized.Parameter(2)
    public Instant expectedEnd;

    @Parameterized.Parameters(name = "now {0} sendAtTime {1}")
    public static Object[][] data() {
        return new Object[][]{
                // Saturday
                {ZonedDateTime.of(2024, 3, 9, 10, 15, 0, 0, ZoneId.of("America/New_York")),
                        ZonedDateTime.of(2024, 2, 26, 0, 0, 0, 0, ZoneId.of("America/New_York")).toInstant(),
                        ZonedDateTime.of(2024, 3, 3, 23, 59, 59, 999999999, ZoneId.of("America/New_York")).toInstant()},
                // Monday
                {ZonedDateTime.of(2024, 3, 4, 10, 15, 0, 0, ZoneId.of("America/New_York")),
                        ZonedDateTime.of(2024, 2, 26, 0, 0, 0, 0, ZoneId.of("America/New_York")).toInstant(),
                        ZonedDateTime.of(2024, 3, 3, 23, 59, 59, 999999999, ZoneId.of("America/New_York")).toInstant()},
        };
    }

    @Test(timeout = 10_000L)
    public void test() {
        assertEquals(expectedStart, WeeklyDigestService.getDigestStart(now));
        assertEquals(expectedEnd, WeeklyDigestService.getDigestEnd(now));
    }
}