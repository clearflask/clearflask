// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.inject.Inject;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameter;
import org.junit.runners.Parameterized.Parameters;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.Month;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAccessor;
import java.util.Optional;
import java.util.stream.Stream;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

@Slf4j
@RunWith(Parameterized.class)
public class DateUtilFormatsTest extends AbstractTest {

    @Inject
    private DateUtil dateUtil;

    @Parameter(0)
    public String format;

    @Parameters(name = "{0}")
    public static Object[][] data() {
        DateUtil dateUtil = new DateUtil();
        return Stream.concat(
                        dateUtil.dateFormats.values().stream(),
                        dateUtil.dateTimeFormats.values().stream())
                .map(formatStr -> new Object[]{formatStr})
                .toArray(Object[][]::new);
    }

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        LocalDateTime now = LocalDateTime.of(2022, Month.APRIL, 23, 23, 55, 34, 4);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(this.format);
        String nowStr = formatter.format(now);
        log.info("Now {} formatted as {}", now, nowStr);
        Optional<DateTimeFormatter> formatterActualOpt = dateUtil.determineDateFormat(nowStr);
        assertTrue(formatterActualOpt.isPresent());
        TemporalAccessor parsed = formatterActualOpt.get().parse(nowStr);
        assertEquals(
                DateTimeFormatter.ofPattern("yyyy-MM-dd").format(now),
                DateTimeFormatter.ofPattern("yyyy-MM-dd").format(parsed));
        assertEquals(nowStr, formatter.format(parsed));

        Instant instActual = dateUtil.parse(nowStr, formatterActualOpt.get());
        assertEquals(
                DateTimeFormatter.ofPattern("yyyy-MM-dd").format(now),
                DateTimeFormatter.ofPattern("yyyy-MM-dd")
                        .withZone(ZoneOffset.UTC)
                        .format(instActual));
    }
}
