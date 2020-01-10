package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class MathUtil {
    public static long minmax(long min, long input, long max) {
        if (input < min) return min;
        if (input > max) return max;
        return input;
    }

    public static int minmax(int min, int input, int max) {
        if (input < min) return min;
        if (input > max) return max;
        return input;
    }
}
