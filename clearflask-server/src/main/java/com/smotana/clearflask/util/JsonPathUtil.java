// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Strings;
import com.jayway.jsonpath.Configuration;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.Option;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static com.google.common.base.Predicates.not;

@Slf4j
public class JsonPathUtil {

    public static Optional<String> findFirstAsString(String jsonPath, String input) {
        return extractStrings(JsonPath.compile(jsonPath).<List<Object>>read(input, Configuration.builder().options(
                        Option.ALWAYS_RETURN_LIST,
                        Option.SUPPRESS_EXCEPTIONS).build())
                .stream())
                .filter(not(Strings::isNullOrEmpty))
                .findFirst();
    }

    public static Stream<String> extractStrings(Stream<?> result) {
        return result.flatMap(o -> {
            if (o == null) {
                return Stream.of();
            } else if (o instanceof List<?>) {
                return extractStrings(((List<?>) o).stream());
            } else if (o instanceof Map<?, ?>) {
                return extractStrings(((Map<?, ?>) o).values().stream());
            } else {
                return Stream.of(o.toString());
            }
        });
    }
}
