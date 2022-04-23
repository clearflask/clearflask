// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameter;
import org.junit.runners.Parameterized.Parameters;

import java.util.Arrays;

import static com.smotana.clearflask.util.StringSerdeUtil.DELIMITER;
import static com.smotana.clearflask.util.StringSerdeUtil.ESCAPER;
import static org.junit.Assert.assertArrayEquals;

@Slf4j
@RunWith(Parameterized.class)
public class StringSerdeUtilTest {

    @Parameter(0)
    public String[] expected;

    @Parameters(name = "{index}")
    public static Object[][] data() {
        return new Object[][]{
                {new String[]{}},
                {new String[]{"a"}},
                {new String[]{"1c9292364aaa485ebeb0911c593e24df", "41f739088dfc457782b46c396ed00992"}},
                {new String[]{"a", "b"}},
                {new String[]{"a", "b", "c"}},
                {new String[]{"a" + ESCAPER, "a"}},
                {new String[]{"a", ESCAPER + "a"}},
                {new String[]{"a\\" + ESCAPER, ESCAPER + "a"}},
                {new String[]{"a" + DELIMITER, "a"}},
                {new String[]{"a", DELIMITER + "a"}},
                {new String[]{"a" + DELIMITER, DELIMITER + "a"}},
                {new String[]{"" + ESCAPER + ESCAPER + ESCAPER + ESCAPER, "" + ESCAPER + ESCAPER + ESCAPER + ESCAPER}},
                {new String[]{"" + DELIMITER + DELIMITER + DELIMITER + DELIMITER, "" + DELIMITER + DELIMITER + DELIMITER + DELIMITER}},
                {new String[]{"" + ESCAPER + DELIMITER + DELIMITER + ESCAPER, "" + DELIMITER + ESCAPER + ESCAPER + DELIMITER}},
        };
    }

    @Test(timeout = 10_000L)
    public void testSerde() throws Exception {
        String merged = StringSerdeUtil.mergeStrings(expected);
        String[] actual = StringSerdeUtil.unMergeString(merged);
        log.info(" Input: {}", Arrays.toString(expected));
        log.info("Merged: {}", merged);
        log.info("Output: {}", Arrays.toString(actual));
        assertArrayEquals(expected, actual);
    }
}