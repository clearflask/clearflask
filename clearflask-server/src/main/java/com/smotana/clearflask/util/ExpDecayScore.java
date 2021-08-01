// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import java.time.Duration;

public class ExpDecayScore {
    private final double rate;

    public ExpDecayScore(Duration decayPeriod) {
        this(decayPeriod.toMillis());
    }

    public ExpDecayScore(long decayPeriodMillis) {
        this.rate = 1d / decayPeriodMillis;
    }

    /** If changed, also change in exp-decay.painless */
    public double updateScore(double prevScore, long timeInMillis) {
        double u = Math.max(prevScore, rate * timeInMillis);
        double v = Math.min(prevScore, rate * timeInMillis);
        return u + Math.log1p(Math.exp(v - u));
    }
}
