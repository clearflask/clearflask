// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.logging;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.boolex.EvaluationException;
import ch.qos.logback.core.boolex.EventEvaluatorBase;

/**
 * see http://logback.qos.ch/xref/chapters/appenders/mail/CounterBasedEvaluator.html
 */
public class CounterBasedEvaluator extends EventEvaluatorBase<ILoggingEvent> {
    int counterLimit = 10;
    int counter = 0;
    long timeLimit = 10 * 60 * 1000; // 10 minutes
    long lastTime = 0;

    /**
     * Sets the counter to counterLimit. The default value is 10.
     *
     * @param counterLimit must be within the range of 1 and Integer.MAX_VALUE
     */
    public void setCounterLimit(int counterLimit) {
        this.counterLimit = counterLimit;
    }

    public int getCounterLimit() {
        return counterLimit;
    }

    public void setTimeLimit(long timeLimit) {
        this.timeLimit = timeLimit;
    }

    public long getTimeLimit() {
        return timeLimit;
    }

    @Override
    public boolean evaluate(ILoggingEvent event) throws NullPointerException, EvaluationException {
        // Return true if we have at least counterLimit log messages and we
        // haven't returned true for at least timeLimit milliseconds.
        if ((System.currentTimeMillis() - lastTime) >= timeLimit) {
            if (++counter >= counterLimit) {
                lastTime = System.currentTimeMillis();
                counter = 0;
                return true;
            } else {
                // Send immediately regardless of above conditions if error
                // level. Could flood... maybe use markers (see OnMarkerEvaluator).
                if (event.getLevel().levelInt >= Level.ERROR_INT) {
                    lastTime = System.currentTimeMillis();
                    counter = 0;
                    return true;
                }
            }
        }

        return false;
    }
}
