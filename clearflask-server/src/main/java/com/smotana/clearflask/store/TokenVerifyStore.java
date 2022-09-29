// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.util.concurrent.ThreadLocalRandom;

import static io.dataspray.singletable.TableType.Primary;

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
