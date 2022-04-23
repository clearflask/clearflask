// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.Optional;

import static org.junit.Assert.*;

@Slf4j
public class CouponStoreTest extends AbstractTest {

    @Inject
    private DynamoMapper mapper;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private CouponStore couponStore;


    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DynamoCouponStore.module(),
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
            }
        }));
    }

    @Test(timeout = 20_000L)
    public void test() throws Exception {
        ImmutableList.Builder<String> couponIdBuilder = ImmutableList.builder();
        couponStore.generate(
                "plan1",
                3,
                Optional.empty(),
                couponIdBuilder::addAll);
        ImmutableList<String> couponIds = couponIdBuilder.build();
        assertEquals(3, couponIds.size());
        couponIds.forEach(couponId -> {
            Optional<CouponStore.CouponModel> couponOpt = couponStore.check(couponId);
            assertTrue(couponOpt.isPresent());
            assertEquals("plan1", couponOpt.get().getBasePlanId());
            assertNull(couponOpt.get().getTtlInEpochSec());
            assertNull(couponOpt.get().getRedeemedAccountId());
        });

        String couponId = couponIds.get(0);
        Optional<CouponStore.CouponModel> redeemedCouponOpt = couponStore.redeem(couponId, "account1");
        assertTrue(redeemedCouponOpt.isPresent());
        assertEquals("account1", redeemedCouponOpt.get().getRedeemedAccountId());

        redeemedCouponOpt = couponStore.check(couponId);
        assertTrue(redeemedCouponOpt.isPresent());
        assertEquals("account1", redeemedCouponOpt.get().getRedeemedAccountId());

        assertEquals(redeemedCouponOpt, couponStore.redeem(couponId, "account1"));

        assertEquals(Optional.empty(), couponStore.redeem(couponId, "account2   "));
    }
}