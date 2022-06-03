// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableMap;
import com.google.inject.Singleton;

import java.text.ParseException;
import java.time.Instant;
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
 * @see CalendarUtil
 */
@Singleton
public class DateUtil {
    @VisibleForTesting
    final ImmutableMap<String, String> dateFormats;
    final ImmutableMap<String, String> dateTimeFormats;

    protected DateUtil() {
        dateFormats = ImmutableMap.<String, String>builder()
                .put("^\\d{8}$", "yyyyMMdd")
                .put("^\\d{1,2}-\\d{1,2}-\\d{4}$", "dd-MM-yyyy")
                .put("^\\d{4}-\\d{1,2}-\\d{1,2}$", "yyyy-MM-dd")
                .put("^\\d{1,2}/\\d{1,2}/\\d{4}$", "MM/dd/yyyy")
                .put("^\\d{4}/\\d{1,2}/\\d{1,2}$", "yyyy/MM/dd")
                .put("^\\d{1,2}\\s[a-z]{3}\\s\\d{4}$", "dd MMM yyyy")
                .put("^\\d{1,2}\\s[a-z]{4,}\\s\\d{4}$", "dd MMMM yyyy")
                .build();
        dateTimeFormats = ImmutableMap.<String, String>builder()
                .put("^\\d{12}$", "yyyyMMddHHmm")
                .put("^\\d{8}\\s\\d{4}$", "yyyyMMdd HHmm")
                .put("^\\d{1,2}-\\d{1,2}-\\d{4}\\s\\d{1,2}:\\d{2}$", "dd-MM-yyyy HH:mm")
                .put("^\\d{4}-\\d{1,2}-\\d{1,2}\\s\\d{1,2}:\\d{2}$", "yyyy-MM-dd HH:mm")
                .put("^\\d{1,2}/\\d{1,2}/\\d{4}\\s\\d{1,2}:\\d{2}$", "MM/dd/yyyy HH:mm")
                .put("^\\d{4}/\\d{1,2}/\\d{1,2}\\s\\d{1,2}:\\d{2}$", "yyyy/MM/dd HH:mm")
                .put("^\\d{1,2}\\s[a-z]{3}\\s\\d{4}\\s\\d{1,2}:\\d{2}$", "dd MMM yyyy HH:mm")
                .put("^\\d{1,2}\\s[a-z]{4,}\\s\\d{4}\\s\\d{1,2}:\\d{2}$", "dd MMMM yyyy HH:mm")
                .put("^\\d{14}$", "yyyyMMddHHmmss")
                .put("^\\d{8}\\s\\d{6}$", "yyyyMMdd HHmmss")
                .put("^\\d{1,2}-\\d{1,2}-\\d{4}\\s\\d{1,2}:\\d{2}:\\d{2}$", "dd-MM-yyyy HH:mm:ss")
                .put("^\\d{4}-\\d{1,2}-\\d{1,2}\\s\\d{1,2}:\\d{2}:\\d{2}$", "yyyy-MM-dd HH:mm:ss")
                .put("^\\d{1,2}/\\d{1,2}/\\d{4}\\s\\d{1,2}:\\d{2}:\\d{2}$", "MM/dd/yyyy HH:mm:ss")
                .put("^\\d{4}/\\d{1,2}/\\d{1,2}\\s\\d{1,2}:\\d{2}:\\d{2}$", "yyyy/MM/dd HH:mm:ss")
                .put("^\\d{1,2}\\s[a-z]{3}\\s\\d{4}\\s\\d{1,2}:\\d{2}:\\d{2}$", "dd MMM yyyy HH:mm:ss")
                .put("^\\d{1,2}\\s[a-z]{4,}\\s\\d{4}\\s\\d{1,2}:\\d{2}:\\d{2}$", "dd MMMM yyyy HH:mm:ss")
                .build();
    }

    public Optional<DateTimeFormatter> determineDateFormat(String dateString) {
        dateString = dateString.toLowerCase();
        for (Map.Entry<String, String> entry : dateFormats.entrySet()) {
            if (dateString.matches(entry.getKey())) {
                return Optional.of(new DateTimeFormatterBuilder()
                        .appendPattern(entry.getValue())
                        .parseDefaulting(ChronoField.NANO_OF_DAY, 0)
                        .toFormatter());
            }
        }
        for (Map.Entry<String, String> entry : dateTimeFormats.entrySet()) {
            if (dateString.matches(entry.getKey())) {
                return Optional.of(new DateTimeFormatterBuilder()
                        .appendPattern(entry.getValue())
                        .toFormatter());
            }
        }
        return Optional.empty();
    }


    public Instant parse(String dateTimeStr, DateTimeFormatter formatter) throws ParseException {
        return Instant.from(formatter.parse(dateTimeStr));
    }
}
