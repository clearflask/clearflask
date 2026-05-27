// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.core.ManagedService;
import io.dataspray.singletable.DynamoTable;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.Optional;

import static io.dataspray.singletable.TableType.Primary;

/**
 * Tiny key-value store for service-level secrets that need to survive restarts.
 *
 * <p>Currently used to persist the auto-registered Stripe webhook signing secret
 * (only readable from Stripe at the moment of WebhookEndpoint creation, so we must
 * cache it locally for subsequent app restarts).
 *
 * <p>Schema: name (PK) -> value. Values are stored as-is; encrypt at rest is provided
 * by DynamoDB at the table level.
 */
@Slf4j
@Singleton
public class ServiceSecretStore extends ManagedService {

    @Inject
    private SingleTable singleTable;

    private TableSchema<ServiceSecret> schema;

    @Override
    protected void serviceStart() {
        schema = singleTable.parseTableSchema(ServiceSecret.class);
    }

    public Optional<String> get(String name) {
        ServiceSecret row = schema.fromItem(schema.table().getItem(new GetItemSpec()
                .withPrimaryKey(schema.primaryKey(Map.of("name", name)))));
        return row == null ? Optional.empty() : Optional.ofNullable(row.getValue());
    }

    public void put(String name, String value) {
        schema.table().putItem(new PutItemSpec()
                .withItem(schema.toItem(new ServiceSecret(name, value))));
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"name"}, rangePrefix = "serviceSecret")
    public static class ServiceSecret {
        @NonNull
        String name;

        @NonNull
        String value;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ServiceSecretStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(ServiceSecretStore.class).asEagerSingleton();
            }
        };
    }
}
