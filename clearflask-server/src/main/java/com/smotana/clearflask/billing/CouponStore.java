// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.google.common.collect.ImmutableCollection;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.util.Optional;
import java.util.function.Consumer;

import static io.dataspray.singletable.TableType.Primary;

public interface CouponStore {

    void generate(String basePlanId, long amount, Optional<Instant> expiryOpt, Consumer<ImmutableCollection<String>> batchedConsumer);

    Optional<CouponModel> check(String couponId);

    Optional<CouponModel> redeem(String couponId, String accountId);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"couponId"}, rangePrefix = "coupon")
    class CouponModel {
        @NonNull
        String couponId;

        @NonNull
        String basePlanId;

        @NonNull
        Instant created;

        String redeemedAccountId;

        Long ttlInEpochSec;
    }
}
