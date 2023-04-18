// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.inject.Inject;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTime;
import org.joda.time.LocalDate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.killbill.billing.catalog.api.Currency;
import org.killbill.billing.notification.plugin.api.PaymentMetadata;
import org.killbill.billing.payment.api.TransactionStatus;
import org.killbill.billing.payment.api.TransactionType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

@RunWith(Parameterized.class)
@Slf4j
public class GsonConverterTest extends AbstractTest {

    @Parameterized.Parameter(0)
    public Class<Object> objectClazz;

    @Parameterized.Parameter(1)
    public Object object;

    @Parameterized.Parameters(name = "{0} {1}")
    public static Object[][] data() {
        return new Object[][]{
                {Instant.class, Instant.now()},
                {DateTime.class, DateTime.parse("2023-03-26T00:26:05.983-04:00")},
                {LocalDate.class, LocalDate.now()},
        };
    }

    @Inject
    private Gson gson;

    @Override
    protected void configure() {
        super.configure();

        install(GsonProvider.module());
    }

    @Test(timeout = 10_000L)
    public void testFromJson() throws Exception {
        assertEquals(object, gson.fromJson(gson.toJson(object), objectClazz));
    }
}
