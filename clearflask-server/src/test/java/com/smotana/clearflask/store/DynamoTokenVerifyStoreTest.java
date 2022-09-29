// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.smotana.clearflask.store.TokenVerifyStore.Token;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.DynamoTokenVerifyStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.IdUtil;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import static org.junit.Assert.assertEquals;

@Slf4j
public class DynamoTokenVerifyStoreTest extends AbstractTest {

    @Inject
    private TokenVerifyStore store;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DynamoTokenVerifyStore.module(),
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
            }
        }));
    }

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        String targetId = IdUtil.randomId();

        configSet(DynamoTokenVerifyStore.Config.class, "tokenExpiry", "PT1H");
        configSet(DynamoTokenVerifyStore.Config.class, "tokenSize", "6");
        Token token = store.createToken(targetId);
        assertEquals(targetId, token.getTargetId());
        assertEquals(6, token.getToken().length());

        configSet(DynamoTokenVerifyStore.Config.class, "tokenSize", "20");
        Token token2 = store.createToken(targetId);
        assertEquals(targetId, token2.getTargetId());
        assertEquals(20, token2.getToken().length());
    }
}
