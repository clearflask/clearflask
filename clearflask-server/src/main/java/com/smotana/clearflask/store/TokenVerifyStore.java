// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store;

import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.util.concurrent.ThreadLocalRandom;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface TokenVerifyStore {

    default String genTokenId(long tokenSize) {
        return String.format("%0" + tokenSize + "d", ThreadLocalRandom.current().nextLong((long) Math.pow(10, tokenSize)));
    }

    Token createToken(String... targetIdParts);

    boolean useToken(String tokenStr, String... targetIdParts);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"targetId", "token"}, rangePrefix = "tokenVerify")
    class Token {
        @NonNull
        String targetId;

        @NonNull
        String token;

        @NonNull
        long ttlInEpochSec;
    }
}
