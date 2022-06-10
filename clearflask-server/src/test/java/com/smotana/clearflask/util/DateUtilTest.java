package com.smotana.clearflask.util;

import com.google.inject.Inject;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.text.SimpleDateFormat;
import java.time.Instant;
import java.util.TimeZone;

import static org.junit.Assert.assertEquals;

@Slf4j
public class DateUtilTest extends AbstractTest {
    @Inject
    private DateUtil dateUtil;

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        assertDate("2011-08-28 01:00:00", "08/28/2011 01:00:00");
        assertDate("2011-08-28 01:00:00", "28-08-2011 01:00:0");
        assertDate("2011-08-28 01:00:00", "08/28/2011 1:0:00");
        assertDate("2011-08-28 01:00:00", "28-08-2011 1:0:0");
        assertDate("2011-08-28 01:00:00", "8/28/2011 1:0:0");
        assertDate("2011-08-28 01:00:00", "28-8-2011 1:0");

        assertDate("2002-03-04 01:00:00", "03/04/2002 01:00:00");
        assertDate("2002-03-04 01:00:00", "3/4/2002 1:0:0");
        assertDate("2002-03-04 01:00:00", "4-3-2002 1:0");
    }

    private void assertDate(String expectedStr, String actualStr) throws Exception {
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd hh:mm:ss");
        simpleDateFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
        Instant expected = simpleDateFormat
                .parse(expectedStr)
                .toInstant();
        Instant actual = dateUtil.parse(actualStr,
                dateUtil.determineDateFormat(actualStr).get());
        assertEquals(expected, actual);
    }
}