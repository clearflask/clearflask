// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.smotana.clearflask.api.model.SubscriptionStatus;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.util.Optional;

import static io.dataspray.singletable.TableType.Primary;

public interface LicenseStore {

    Optional<String> getLicense();

    void setLicense(String license);

    void clearLicense();

    Optional<Boolean> validate(boolean useCache);

    SubscriptionStatus getSelfhostEntitlementStatus(String planId);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "type", rangePrefix = "license")
    class License {
        @NonNull
        Type type;

        @NonNull
        String license;
    }

    enum Type {
        PRIMARY
    }
}
