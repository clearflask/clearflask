// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import static io.dataspray.singletable.TableType.Primary;

public interface TokenVerifyStore {

    Token createToken(String... targetIdParts);

    boolean useToken(String tokenStr, String... targetIdParts);

    /**
     * Persisted form of a verification token. The {@link #token} stored on disk is the
     * server-side hash; the plaintext value is only ever returned to the caller of
     * {@link #createToken} (so it can be emailed to the user) and is never written to the table.
     */
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
