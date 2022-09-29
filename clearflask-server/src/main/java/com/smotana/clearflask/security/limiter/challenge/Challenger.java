// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security.limiter.challenge;

public interface Challenger {

    /**
     * Issue challenge
     *
     * @return challenge
     */
    String issue(String remoteIp, String target);

    /**
     * Verifies challenge solution
     *
     * @return True on success, false on challenge failure
     */
    boolean verify(String remoteIp, String target, String solution);
}
