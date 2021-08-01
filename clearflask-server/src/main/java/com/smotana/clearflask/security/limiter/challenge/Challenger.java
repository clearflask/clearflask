// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
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
