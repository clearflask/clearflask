// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.RandomStringUtils;
import org.apache.commons.lang.StringUtils;

import java.util.UUID;

/**
 * Used for intercepting registration of already registered beans. Handles it by re-registering instead of throwing.
 */
@Slf4j
public class IdUtil {
    public static String randomId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public static String randomAscId() {
        return UUIDGen.getTimeUUID().toString().replace("-", "");
    }

    public static String contentUnique(String content) {
        String contentPart = StringUtils.left(content, 50)
                .toLowerCase()
                .replaceAll("[^0-9a-z ]+", "")
                .replaceAll(" +", "-")
                .trim();
        int randomChars;
        if (contentPart.length() < 5) {
            randomChars = 8;
        } else if (contentPart.length() < 10) {
            randomChars = 5;
        } else if (contentPart.length() < 15) {
            randomChars = 4;
        } else {
            randomChars = 3;
        }
        return (contentPart + '-' + RandomStringUtils.randomAlphanumeric(randomChars))
                .toLowerCase();
    }

    public static String randomId(int charCount) {
        return UUID.randomUUID().toString().replace("-", "")
                .substring(0, charCount);
    }

    public static UUID parseDashlessUuid(String uuidStr) {
        // From https://stackoverflow.com/questions/18986712/creating-a-uuid-from-a-string-with-no-dashes
        return UUID.fromString(uuidStr.replaceFirst("(\\p{XDigit}{8})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}+)", "$1-$2-$3-$4-$5"));
    }
}
