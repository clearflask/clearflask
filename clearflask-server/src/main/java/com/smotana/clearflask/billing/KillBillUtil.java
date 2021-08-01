// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.billing;

import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.RequestOptions.RequestOptionsBuilder;

public class KillBillUtil {
    private static final String CREATED_BY = "system";

    private static final RequestOptions roDefault = RequestOptions.builder()
            .withCreatedBy(CREATED_BY)
            .build();

    public static RequestOptions roDefault() {
        return roDefault;
    }

    public static RequestOptionsBuilder roBuilder() {
        return RequestOptions.builder()
                .withCreatedBy(CREATED_BY);
    }

}
