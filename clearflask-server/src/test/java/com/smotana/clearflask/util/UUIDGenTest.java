// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import org.junit.Test;

import static org.junit.Assert.assertTrue;

public class UUIDGenTest {

    @Test(timeout = 10_000L)
    public void getTimeUUID() {
        String uuid = UUIDGen.getTimeUUID().toString();
        for (int i = 0; i < 10_000; i++) {
            String uuidNext = UUIDGen.getTimeUUID().toString();
            assertTrue(uuid.compareTo(uuidNext) < 0);
            uuid = uuidNext;
        }
        long now = System.currentTimeMillis();
        for (int i = 0; i < 10_000; i++) {
            String uuidNext = UUIDGen.getTimeUUID(UUIDGen.instance.createTimeSafe(now)).toString();
            assertTrue(uuid.compareTo(uuidNext) != 0);
            uuid = uuidNext;
        }
    }
}