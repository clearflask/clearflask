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
        return String.format("%1.3s-%s",
                StringUtils.left(content, 50).trim().replaceAll("[^0-9a-z]+", "-"),
                RandomStringUtils.randomAlphanumeric(5))
                .toLowerCase();
    }

    public static UUID parseDashlessUuid(String uuidStr) {
        // From https://stackoverflow.com/questions/18986712/creating-a-uuid-from-a-string-with-no-dashes
        return UUID.fromString(uuidStr.replaceFirst("(\\p{XDigit}{8})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}+)", "$1-$2-$3-$4-$5"));
    }
}
