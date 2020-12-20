package com.smotana.clearflask.util;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.inject.Inject;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
@Singleton
public class ConfigSchemaUpgrader {

    public static final long LATEST_SCHEMA_VERSION = 3L;

    @Inject
    private Gson gson;

    public Optional<String> upgrade(String configJson) {
        return upgrade(gson.fromJson(configJson, JsonElement.class));
    }

    public Optional<String> upgrade(JsonElement config) {
        long schemaVersion = Optional.ofNullable(config.getAsJsonObject().get("schemaVersion"))
                .map(JsonElement::getAsLong)
                .orElse(1L);

        if (schemaVersion == LATEST_SCHEMA_VERSION) {
            return Optional.empty();
        }

        if (schemaVersion < 2L) {
            JsonElement emailEl = config.getAsJsonObject().get("users")
                    .getAsJsonObject().get("onboarding")
                    .getAsJsonObject().get("notificationMethods")
                    .getAsJsonObject().get("email");
            if (emailEl != null) {
                emailEl.getAsJsonObject().addProperty("mode", "SignupAndLogin");
            }
            config.getAsJsonObject().addProperty("schemaVersion", 2L);
        }

        if (schemaVersion < 3L) {
            JsonElement integrationsEl = config.getAsJsonObject().get("integrations");
            if (integrationsEl == null) {
                config.getAsJsonObject().add("integrations", new JsonObject());
            }
            config.getAsJsonObject().addProperty("schemaVersion", 3L);
        }

        // Important notes:
        // - Don't forget to increment schema version udner LATEST_SCHEMA_VERSION
        // - Don't forget to set the schemaVersion property
        // - Make sure the upgrade is idempotent
        // - Add a test assertion in ConfigSchemaUpgraderTest.assertUpgraded

        return Optional.of(gson.toJson(config));
    }
}
