// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.smotana.clearflask.api.model.CreditFormatterEntry;
import com.smotana.clearflask.api.model.Credits;

import javax.annotation.Nullable;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Optional;

public class CreditViewUtil {
    /**
     * If changed, also change CreditView.tsx
     */
    public static String creditView(long amount, @Nullable Credits credits) {
        Optional<CreditFormatterEntry> formatOpt = creditGetFormat(amount, credits);
        String valFormatted = formatOpt.map(format -> creditFormatVal(amount, format)).orElse(amount + "");
        return renderCreditVal(valFormatted, amount < 0);
    }

    /**
     * If changed, also change CreditView.tsx
     */
    private static Optional<CreditFormatterEntry> creditGetFormat(long amount, @Nullable Credits credits) {
        if (credits == null) {
            return Optional.empty();
        }
        long valAbs = Math.abs(amount);
        return credits.getFormats().stream()
                .filter(format -> {
                    if (format.getGreaterOrEqual() != null && valAbs < format.getGreaterOrEqual()) {
                        return false;
                    }
                    if (format.getLessOrEqual() != null && valAbs > format.getLessOrEqual()) {
                        return false;
                    }
                    return true;
                })
                .findFirst();
    }

    /**
     * If changed, also change CreditView.tsx
     */
    private static String creditFormatVal(long amount, CreditFormatterEntry format) {
        long resultLong = amount;

        resultLong = Math.abs(resultLong);

        if (format.getMultiplier() != null) {
            resultLong = (long) (resultLong * format.getMultiplier());
        }

        if (format.getMaximumFractionDigits() != null) {
            double exp = Math.pow(10, format.getMaximumFractionDigits());
            resultLong = (long) (Math.floor(resultLong * exp) / exp);
        }

        NumberFormat numberInstance = NumberFormat.getNumberInstance(Locale.US);
        if (format.getMinimumFractionDigits() != null) {
            numberInstance.setMinimumFractionDigits(format.getMinimumFractionDigits().intValue());
        }
        String resultStr = numberInstance.format(resultLong);

        resultStr = Optional.ofNullable(format.getPrefix()).orElse("")
                + resultStr
                + Optional.ofNullable(format.getSuffix()).orElse("");

        return resultStr;

    }

    /**
     * If changed, also change CreditView.tsx
     */
    private static String renderCreditVal(String valFormatted, boolean isNegative) {
        String result = valFormatted;
        if (isNegative) {
            result = "("
                    + result
                    + ")";
        }
        return result;
    }
}
