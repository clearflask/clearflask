// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableMap;
import com.google.inject.Singleton;

import java.text.ParseException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.Map;
import java.util.Optional;

/**
 * Useful Date utilities.
 *
 * @author BalusC
 * @link http://balusc.omnifaces.org/2007/09/dateutil.html
 */
@Singleton
public class DateUtil {
    @VisibleForTesting
    final ImmutableMap<String, String> dateFormats;
    final ImmutableMap<String, String> dateTimeFormats;

    protected DateUtil() {
        dateFormats = ImmutableMap.<String, String>builder()
                .put("^\\d{8}$", "yyyyMMdd")
                .put("^\\d{1,2}-(0?\\d|1[012])-\\d{4}$", "d-M-yyyy")
                .put("^\\d{4}-(0?\\d|1[012])-\\d{1,2}$", "yyyy-M-d")
                .put("^(0?\\d|1[012])/\\d{1,2}/\\d{4}$", "M/d/yyyy")
                .put("^\\d{4}/(0?\\d|1[012])/\\d{1,2}$", "yyyy/M/d")
                .put("^\\d{1,2}\\s[a-zA-Z]{3}\\.?\\s\\d{4}$", "d MMM yyyy")
                .put("^\\d{1,2}\\s[a-zA-Z]{4,}\\s\\d{4}$", "d MMMM yyyy")
                .build();
        dateTimeFormats = ImmutableMap.<String, String>builder()
                .put("^\\d{12}$", "yyyyMMddHHmm")
                .put("^\\d{8}\\s\\d{4}$", "yyyyMMdd HHmm")
                .put("^\\d{1,2}-(0?\\d|1[012])-\\d{4}\\s\\d{1,2}:\\d{1,2}$", "d-M-yyyy H:m")
                .put("^\\d{4}-(0?\\d|1[012])-\\d{1,2}\\s\\d{1,2}:\\d{1,2}$", "yyyy-M-d H:m")
                .put("^(0?\\d|1[012])/\\d{1,2}/\\d{4}\\s\\d{1,2}:\\d{1,2}$", "M/d/yyyy H:m")
                .put("^\\d{4}/(0?\\d|1[012])/\\d{1,2}\\s\\d{1,2}:\\d{1,2}$", "yyyy/M/d H:m")
                .put("^\\d{1,2}\\s[a-zA-Z]{3}\\.?\\s\\d{4}\\s\\d{1,2}:\\d{1,2}$", "d MMM yyyy H:m")
                .put("^\\d{1,2}\\s[a-zA-Z]{4,}\\s\\d{4}\\s\\d{1,2}:\\d{1,2}$", "d MMMM yyyy H:m")
                .put("^\\d{14}$", "yyyyMMddHHmmss")
                .put("^\\d{8}\\s\\d{6}$", "yyyyMMdd HHmmss")
                .put("^\\d{1,2}-(0?\\d|1[012])-\\d{4}\\s\\d{1,2}:\\d{1,2}:\\d{1,2}$", "d-M-yyyy H:m:s")
                .put("^\\d{4}-(0?\\d|1[012])-\\d{1,2}\\s\\d{1,2}:\\d{1,2}:\\d{1,2}$", "yyyy-M-d H:m:s")
                .put("^(0?\\d|1[012])/\\d{1,2}/\\d{4}\\s\\d{1,2}:\\d{1,2}:\\d{1,2}$", "M/d/yyyy H:m:s")
                .put("^\\d{4}/(0?\\d|1[012])/\\d{1,2}\\s\\d{1,2}:\\d{1,2}:\\d{1,2}$", "yyyy/M/d H:m:s")
                .put("^\\d{1,2}\\s[a-zA-Z]{3}\\.?\\s\\d{4}\\s\\d{1,2}:\\d{1,2}:\\d{1,2}$", "d MMM yyyy H:m:s")
                .put("^\\d{1,2}\\s[a-zA-Z]{4,}\\s\\d{4}\\s\\d{1,2}:\\d{1,2}:\\d{1,2}$", "d MMMM yyyy H:m:s")
                .build();
    }

    public Optional<DateTimeFormatter> determineDateFormat(String dateString) {
        dateString = dateString.toLowerCase();
        for (Map.Entry<String, String> entry : dateFormats.entrySet()) {
            if (dateString.matches(entry.getKey())) {
                return Optional.of(new DateTimeFormatterBuilder()
                        .appendPattern(entry.getValue())
                        .parseDefaulting(ChronoField.NANO_OF_DAY, 0)
                        .toFormatter()
                        .withZone(ZoneOffset.UTC));
            }
        }
        for (Map.Entry<String, String> entry : dateTimeFormats.entrySet()) {
            if (dateString.matches(entry.getKey())) {
                return Optional.of(new DateTimeFormatterBuilder()
                        .appendPattern(entry.getValue())
                        .toFormatter()
                        .withZone(ZoneOffset.UTC));
            }
        }
        return Optional.empty();
    }


    public Instant parse(String dateTimeStr, DateTimeFormatter formatter) throws ParseException {
        return Instant.from(formatter.parse(dateTimeStr));
    }
}
