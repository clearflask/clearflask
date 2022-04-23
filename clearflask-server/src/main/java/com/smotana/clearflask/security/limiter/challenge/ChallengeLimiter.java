// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security.limiter.challenge;

import java.util.Optional;

public interface ChallengeLimiter {

    /**
     * Tracks attempts, issues challenges and validates responses.
     *
     * @param challengeAfter Amount of challenge-free attempts to allow.
     * @param target Unique target identification such as username or IP.
     * @param challengeResponse Challenge response string.
     * @return If present, deny this request and ask user to solve given challenge.
     */
    Optional<String> process(long challengeAfter, String remoteIp, String target, Optional<String> challengeResponse);
}
