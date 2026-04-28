// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.collect.ImmutableMap;
import com.google.common.hash.Hashing;
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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Slf4j
@Singleton
public class DynamoTokenVerifyStore implements TokenVerifyStore {

    public interface Config {
        /**
         * Plaintext token entropy in bytes. 16 bytes = 128 bits → ~22 base64url chars.
         */
        @DefaultValue("16")
        int tokenEntropyBytes();

        @DefaultValue("PT15M")
        Duration tokenExpiry();
    }

    @Inject
    private Config config;
    @Inject
    private SingleTable singleTable;

    private final SecureRandom secureRandom = new SecureRandom();

    private TableSchema<Token> tokenSchema;

    @Inject
    private void setup() {
        tokenSchema = singleTable.parseTableSchema(Token.class);
    }

    @Extern
    @Override
    public Token createToken(String... targetIdParts) {
        String targetId = String.join("-", targetIdParts);
        String plaintextToken = genTokenPlaintext();
        long expiry = Instant.now().plus(config.tokenExpiry()).getEpochSecond();

        Token stored = new Token(targetId, hashToken(plaintextToken), expiry);
        tokenSchema.table().putItem(new PutItemSpec()
                .withItem(tokenSchema.toItem(stored)));

        return new Token(targetId, plaintextToken, expiry);
    }

    @Extern
    @Override
    public boolean useToken(String tokenStr, String... targetIdParts) {
        if (tokenStr == null || tokenStr.isEmpty()) {
            return false;
        }
        String targetId = String.join("-", targetIdParts);
        String hashed = hashToken(tokenStr);
        Token deletedToken = tokenSchema.fromItem(tokenSchema.table().deleteItem(new DeleteItemSpec()
                        .withPrimaryKey(tokenSchema.primaryKey(ImmutableMap.of(
                                "targetId", targetId,
                                "token", hashed)))
                        .withReturnValues(ReturnValue.ALL_OLD))
                .getItem());

        if (deletedToken == null) {
            return false;
        }
        byte[] expected = hashed.getBytes(StandardCharsets.UTF_8);
        byte[] actual = deletedToken.getToken().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual)
                && targetId.equals(deletedToken.getTargetId())
                && deletedToken.getTtlInEpochSec() >= Instant.now().getEpochSecond();
    }

    private String genTokenPlaintext() {
        byte[] bytes = new byte[config.tokenEntropyBytes()];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hashToken(String plaintext) {
        return Hashing.sha256()
                .hashString(plaintext, StandardCharsets.UTF_8)
                .toString();
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
