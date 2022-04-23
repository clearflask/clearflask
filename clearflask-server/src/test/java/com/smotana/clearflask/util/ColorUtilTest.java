// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.inject.Inject;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.awt.*;
import java.util.Optional;

import static org.junit.Assert.assertEquals;

@Slf4j
public class ColorUtilTest extends AbstractTest {

    @Inject
    private ColorUtil colorUtil;

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        assertColorEquals(Optional.of(new Color(246, 23, 127)), colorUtil.parseColor("rgba(246,23,127)"));
        assertColorEquals(Optional.of(new Color(246, 23, 127)), colorUtil.parseColor("   rgba    (   246    ,    23   ,    127   )     "));
        assertColorEquals(Optional.of(new Color(246, 23, 127, 127)), colorUtil.parseColor("rgba(246,23,127,0.5)"));
        assertColorEquals(Optional.of(new Color(246, 23, 127, 127)), colorUtil.parseColor("   rgba    (   246    ,    23   ,    127  ,   0.5 )     "));

        assertColorEquals(Optional.empty(), colorUtil.parseColor("rgba(256,23,127)"));
        assertColorEquals(Optional.empty(), colorUtil.parseColor("rgba(246,23,127,1.1)"));

        assertColorEquals(Optional.of(new Color(246, 23, 127)), colorUtil.parseColor("#f6177f"));
        assertColorEquals(Optional.of(new Color(246, 23, 127)), colorUtil.parseColor("   #f6177f   "));
        assertColorEquals(Optional.of(new Color(246, 23, 127, 127)), colorUtil.parseColor("#f6177f7f"));
        assertColorEquals(Optional.of(new Color(246, 23, 127, 127)), colorUtil.parseColor("   #f6177f7f    "));

        assertEquals("f6177f", colorUtil.colorToHex(new Color(246, 23, 127)));
        assertEquals("f6177f7f", colorUtil.colorToHex(new Color(246, 23, 127, 127)));
    }

    private void assertColorEquals(Optional<Color> expected, Optional<Color> actual) {
        assertEquals(expected.map(this::colorToString), actual.map(this::colorToString));
    }

    /** Color.toString() is missin alpha channel */
    private String colorToString(Color color) {
        return "[r=" + color.getRed() + ",g=" + color.getGreen() + ",b=" + color.getBlue() + ",a=" + color.getAlpha() + "]";
    }

}