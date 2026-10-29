// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.smotana.clearflask.api.model.RegistrationAbuseSettings;
import com.smotana.clearflask.web.ApiException;
import javax.ws.rs.core.Response;
import io.dataspray.singletable.DynamoTable;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import lombok.Value;

import javax.inject.Inject;
import javax.inject.Singleton;
import java.util.Map;

import static io.dataspray.singletable.TableType.Primary;

/** Shared, strongly consistent dashboard account registration controls. */
@Singleton
public class RegistrationAbusePolicy {
    private final TableSchema<Settings> schema;

    @Inject
    public RegistrationAbusePolicy(SingleTable singleTable) {
        schema = singleTable.parseTableSchema(Settings.class);
    }

    public RegistrationAbuseSettings get() {
        Settings settings = schema.fromItem(schema.table().getItem(new GetItemSpec()
                .withPrimaryKey(schema.primaryKey(Map.of("policyId", "global")))
                .withConsistentRead(true)));
        return settings == null ? new RegistrationAbuseSettings(true, true)
                : new RegistrationAbuseSettings(settings.isRegistrationsEnabled(), settings.isRegistrationCaptchaEnabled());
    }

    public void requireRegistrationsEnabled() {
        if (!get().getRegistrationsEnabled()) {
            throw new ApiException(Response.Status.FORBIDDEN, "New admin account registrations are temporarily disabled");
        }
    }

    public RegistrationAbuseSettings update(RegistrationAbuseSettings settings) {
        if (settings == null || settings.getRegistrationsEnabled() == null || settings.getRegistrationCaptchaEnabled() == null) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Both registration settings are required");
        }
        schema.table().putItem(schema.toItem(new Settings("global",
                settings.getRegistrationsEnabled(), settings.getRegistrationCaptchaEnabled())));
        return get();
    }

    @Value
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "policyId", rangePrefix = "registrationAbusePolicy")
    public static class Settings {
        @NonNull String policyId;
        boolean registrationsEnabled;
        boolean registrationCaptchaEnabled;
    }
}
