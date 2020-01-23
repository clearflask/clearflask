package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.RandomStringUtils;

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
                content.trim().replaceAll("[^0-9a-z]+", "-"),
                RandomStringUtils.randomAlphanumeric(3))
                .toLowerCase();
    }
}
