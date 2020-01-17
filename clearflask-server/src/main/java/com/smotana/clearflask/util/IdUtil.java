package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;

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
}
