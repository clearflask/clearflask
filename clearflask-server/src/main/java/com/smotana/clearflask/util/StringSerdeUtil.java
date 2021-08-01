// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import com.google.common.collect.Lists;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

@Slf4j
public class StringSerdeUtil {

    public final static char DELIMITER = ':';
    public final static char ESCAPER = '\\';

    private StringSerdeUtil() {
        // disable ctor
    }

    public static String mergeStrings(String... ss) {
        if (ss == null || ss.length == 0) {
            return null;
        }
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < ss.length; i++) {
            String s = ss[i];
            for (int j = 0; j < s.length(); j++) {
                char c = s.charAt(j);
                switch (c) {
                    case ESCAPER:
                        result.append(ESCAPER).append(ESCAPER);
                        break;
                    case DELIMITER:
                        result.append(ESCAPER).append(DELIMITER);
                        break;
                    default:
                        result.append(c);
                        break;
                }
            }
            if (i + 1 < ss.length) {
                result.append(DELIMITER);
            }
        }
        return result.toString();
    }

    public static String[] unMergeString(String s) {
        if (s == null) {
            return new String[0];
        }
        List<String> results = Lists.newArrayList();
        StringBuilder result = new StringBuilder();
        boolean nextCharEscaped = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (nextCharEscaped) {
                nextCharEscaped = false;
                result.append(c);
                continue;
            }
            switch (c) {
                case ESCAPER:
                    nextCharEscaped = true;
                    break;
                case DELIMITER:
                    results.add(result.toString());
                    result = new StringBuilder();
                    break;
                default:
                    result.append(c);
                    break;
            }
        }
        results.add(result.toString());
        return results.toArray(new String[0]);
    }
}
