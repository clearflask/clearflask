// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
@Singleton
public class ConfigSchemaUpgrader {

    @Inject
    private Gson gson;

    public Optional<String> upgrade(String configJson) {
        return upgrade(gson.fromJson(configJson, JsonElement.class));
    }

    public Optional<String> upgrade(JsonElement config) {
        boolean hasChanged = false;

        // Added email signup mode (Version 1 to 2 upgrade)
        JsonElement emailEl = config
                .getAsJsonObject().get("users")
                .getAsJsonObject().get("onboarding")
                .getAsJsonObject().get("notificationMethods")
                .getAsJsonObject().get("email");
        if (emailEl != null && !emailEl.getAsJsonObject().has("mode")) {
            emailEl.getAsJsonObject().addProperty("mode", "SignupAndLogin");
            hasChanged = true;
        }

        // Added integrations (Version 2 to 3 upgrade)
        JsonElement integrationsEl = config.getAsJsonObject().get("integrations");
        if (integrationsEl == null) {
            config.getAsJsonObject().add("integrations", new JsonObject());
            hasChanged = true;
        }

        // Added OAuth list (Version 3 to 4 upgrade)
        JsonObject notificationMethodsObj = config
                .getAsJsonObject().get("users")
                .getAsJsonObject().get("onboarding")
                .getAsJsonObject().get("notificationMethods")
                .getAsJsonObject();
        if (!notificationMethodsObj.has("oauth")) {
            notificationMethodsObj.add("oauth", new JsonArray());
            hasChanged = true;
        }

        // Important notes:
        // - Make sure the upgrade is idempotent, update hasChanged if necessary
        // - Add a test assertion in ConfigSchemaUpgraderTest.assertUpgraded

        return hasChanged ? Optional.of(gson.toJson(config)) : Optional.empty();
    }
}
