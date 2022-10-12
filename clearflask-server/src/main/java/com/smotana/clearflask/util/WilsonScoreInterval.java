// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import org.apache.commons.math3.distribution.NormalDistribution;
import org.apache.commons.math3.exception.NotPositiveException;
import org.apache.commons.math3.exception.NotStrictlyPositiveException;
import org.apache.commons.math3.exception.NumberIsTooLargeException;
import org.apache.commons.math3.exception.OutOfRangeException;
import org.apache.commons.math3.exception.util.LocalizedFormats;
import org.apache.commons.math3.util.FastMath;

public class WilsonScoreInterval {
    private final double z;
    private final double zSquared;

    public WilsonScoreInterval(double confidenceLevel) {
        if (confidenceLevel <= 0.0D || confidenceLevel >= 1.0D) {
            throw new OutOfRangeException(LocalizedFormats.OUT_OF_BOUNDS_CONFIDENCE_LEVEL, confidenceLevel, 0, 1);
        }
        double alpha = (1.0D - confidenceLevel) / 2.0D;
        NormalDistribution normalDistribution = new NormalDistribution();
        z = normalDistribution.inverseCumulativeProbability(1.0D - alpha);
        zSquared = FastMath.pow(z, 2);
    }

    public double getZ() {
        return z;
    }

    public double getZSquared() {
        return zSquared;
    }

    public double lowerBound(int numberOfTrials, int numberOfSuccesses) {
        if (numberOfTrials == 0) {
            return 0d;
        } else if (numberOfTrials < 0) {
            throw new NotStrictlyPositiveException(LocalizedFormats.NUMBER_OF_TRIALS, numberOfTrials);
        } else if (numberOfSuccesses < 0) {
            throw new NotPositiveException(LocalizedFormats.NEGATIVE_NUMBER_OF_SUCCESSES, numberOfSuccesses);
        } else if (numberOfSuccesses > numberOfTrials) {
            throw new NumberIsTooLargeException(LocalizedFormats.NUMBER_OF_SUCCESS_LARGER_THAN_POPULATION_SIZE, numberOfSuccesses, numberOfTrials, true);
        }

        double mean = (double) numberOfSuccesses / (double) numberOfTrials;
        double factor = 1.0D / (1.0D + 1.0D / (double) numberOfTrials * zSquared);
        double modifiedSuccessRatio = mean + 1.0D / (double) (2 * numberOfTrials) * zSquared;
        double difference = z * FastMath.sqrt(1.0D / (double) numberOfTrials * mean * (1.0D - mean) + 1.0D / (4.0D * FastMath.pow((double) numberOfTrials, 2)) * zSquared);
        double lowerBound = factor * (modifiedSuccessRatio - difference);

        return lowerBound;
    }
}
