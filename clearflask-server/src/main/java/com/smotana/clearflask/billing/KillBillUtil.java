package com.smotana.clearflask.billing;

import org.killbill.billing.client.RequestOptions;

public class KillBillUtil {

    private static final RequestOptions roDefault = RequestOptions.builder()
            .withCreatedBy("clearflask-system")
            .build();

    public static RequestOptions roDefault() {
        return roDefault;
    }

}
