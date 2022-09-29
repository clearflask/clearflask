// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Strings;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import java.awt.*;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Singleton
public class ColorUtil {
    private Pattern patternRgba = Pattern.compile("^ *rgba? *\\( *([0-9]+) *, *([0-9]+) *, *([0-9]+)( *, *([0-1](\\.[0-9]+)?))? *\\) *$");
    private Pattern patternHex = Pattern.compile("^ *# *([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}) *$");

    public Optional<Color> parseColor(String input) {
        if (Strings.isNullOrEmpty(input)) {
            return Optional.empty();
        }

        Optional<Color> colorOpt = Optional.empty();

        try {
            if (colorOpt.isEmpty()) {
                Matcher m = patternHex.matcher(input);
                if (m.matches()) {
                    String hex = m.group(1);
                    int r = 0, g = 0, b = 0, a = 255;
                    if (hex.length() == 3 || hex.length() == 4) {
                        r = Integer.parseInt(hex.charAt(0) + "" + hex.charAt(0), 16);
                        g = Integer.parseInt(hex.charAt(1) + "" + hex.charAt(1), 16);
                        b = Integer.parseInt(hex.charAt(2) + "" + hex.charAt(2), 16);
                    }
                    if (hex.length() == 4) {
                        a = Integer.parseInt(Character.toString(hex.charAt(3)), 16) * 255;
                    }
                    if (hex.length() == 6 || hex.length() == 8) {
                        r = Integer.parseInt(hex.substring(0, 2), 16);
                        g = Integer.parseInt(hex.substring(2, 4), 16);
                        b = Integer.parseInt(hex.substring(4, 6), 16);
                    }
                    if (hex.length() == 8) {
                        a = Integer.parseInt(hex.substring(6, 8), 16);
                    }
                    colorOpt = Optional.of(new Color(r, g, b, a));
                }
            }

            if (colorOpt.isEmpty()) {
                Matcher m = patternRgba.matcher(input);
                if (m.matches()) {
                    colorOpt = Optional.of(new Color(
                            Integer.parseInt(m.group(1)),
                            Integer.parseInt(m.group(2)),
                            Integer.parseInt(m.group(3)),
                            Optional.ofNullable(Strings.emptyToNull(m.group(5)))
                                    .map(Double::parseDouble)
                                    .map(a -> (int) Math.floor(a * 255d))
                                    .orElse(255)));
                }
            }
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }

        return colorOpt;
    }

    public String colorToHex(Color color) {
        if (color.getAlpha() < 255) {
            return String.format("%02x%02x%02x%02x",
                    color.getRed(),
                    color.getGreen(),
                    color.getBlue(),
                    color.getAlpha());
        } else {
            return String.format("%02x%02x%02x",
                    color.getRed(),
                    color.getGreen(),
                    color.getBlue());
        }
    }
}
