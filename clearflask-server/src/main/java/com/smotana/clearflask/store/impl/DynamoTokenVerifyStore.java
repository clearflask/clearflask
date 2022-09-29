// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.TokenVerifyStore;
import com.smotana.clearflask.util.Extern;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;

@Slf4j
@Singleton
public class DynamoTokenVerifyStore implements TokenVerifyStore {

    public interface Config {
        @DefaultValue("6")
        long tokenSize();

        @DefaultValue("PT15M")
        Duration tokenExpiry();
    }

    @Inject
    private Config config;
    @Inject
    private SingleTable singleTable;

    private TableSchema<Token> tokenSchema;

    @Inject
    private void setup() {
        tokenSchema = singleTable.parseTableSchema(Token.class);
    }

    @Extern
    @Override
    public Token createToken(String... targetIdParts) {
        String targetId = String.join("-", targetIdParts);
        Token token = new Token(
                targetId,
                genTokenId(config.tokenSize()),
                Instant.now().plus(config.tokenExpiry()).getEpochSecond());

        tokenSchema.table().putItem(new PutItemSpec()
                .withItem(tokenSchema.toItem(token)));

        return token;
    }

    @Extern
    @Override
    public boolean useToken(String tokenStr, String... targetIdParts) {
        String targetId = String.join("-", targetIdParts);
        Token deletedToken = tokenSchema.fromItem(tokenSchema.table().deleteItem(new DeleteItemSpec()
                        .withPrimaryKey(tokenSchema.primaryKey(ImmutableMap.of(
                                "targetId", targetId,
                                "token", tokenStr)))
                        .withReturnValues(ReturnValue.ALL_OLD))
                .getItem());

        return deletedToken != null
                && targetId.equals(deletedToken.getTargetId())
                && tokenStr.equals(deletedToken.getToken())
                && deletedToken.getTtlInEpochSec() >= Instant.now().getEpochSecond();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(TokenVerifyStore.class).to(DynamoTokenVerifyStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
