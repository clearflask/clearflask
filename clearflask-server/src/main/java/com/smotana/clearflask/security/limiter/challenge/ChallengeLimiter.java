// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
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
