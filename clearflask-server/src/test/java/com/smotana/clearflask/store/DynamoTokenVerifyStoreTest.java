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
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

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
    public void testCreateAndUse() throws Exception {
        String targetId = IdUtil.randomId();

        configSet(DynamoTokenVerifyStore.Config.class, "tokenExpiry", "PT1H");
        configSet(DynamoTokenVerifyStore.Config.class, "tokenEntropyBytes", "16");
        Token token = store.createToken(targetId);
        assertEquals(targetId, token.getTargetId());
        // 16 bytes → 22 base64url chars (no padding).
        assertEquals(22, token.getToken().length());

        // Wrong token must not validate.
        assertFalse(store.useToken("not-the-token", targetId));
        // Correct plaintext validates exactly once.
        assertTrue(store.useToken(token.getToken(), targetId));
        assertFalse(store.useToken(token.getToken(), targetId));
    }

    @Test(timeout = 10_000L)
    public void testEntropyAndUniqueness() throws Exception {
        String targetIdA = IdUtil.randomId();
        String targetIdB = IdUtil.randomId();

        configSet(DynamoTokenVerifyStore.Config.class, "tokenExpiry", "PT1H");
        configSet(DynamoTokenVerifyStore.Config.class, "tokenEntropyBytes", "32");

        Token token1 = store.createToken(targetIdA);
        Token token2 = store.createToken(targetIdA);
        // 32 bytes → 43 base64url chars (no padding).
        assertEquals(43, token1.getToken().length());
        assertNotEquals(token1.getToken(), token2.getToken());

        // A token is bound to its targetId.
        Token tokenA = store.createToken(targetIdA);
        assertFalse(store.useToken(tokenA.getToken(), targetIdB));
        assertTrue(store.useToken(tokenA.getToken(), targetIdA));
    }

    @Test(timeout = 10_000L)
    public void testUseTokenRejectsEmptyAndNull() {
        String targetId = IdUtil.randomId();
        assertFalse(store.useToken(null, targetId));
        assertFalse(store.useToken("", targetId));
    }
}
