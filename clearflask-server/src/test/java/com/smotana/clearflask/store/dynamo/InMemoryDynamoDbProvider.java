// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store.dynamo;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.local.embedded.DynamoDBEmbedded;
import com.amazonaws.services.dynamodbv2.local.shared.access.AmazonDynamoDBLocal;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
@Singleton
public class InMemoryDynamoDbProvider extends ManagedService implements Provider<AmazonDynamoDB> {

    private Optional<AmazonDynamoDBLocal> amazonDynamoDBLocalOpt = Optional.empty();
    private Optional<AmazonDynamoDB> amazonDynamoDBOpt = Optional.empty();

    @Override
    public AmazonDynamoDB get() {
        System.setProperty("sqlite4java.library.path", "target/native-lib");
        amazonDynamoDBLocalOpt = Optional.of(DynamoDBEmbedded.create());
        amazonDynamoDBOpt = Optional.of(amazonDynamoDBLocalOpt.get().amazonDynamoDB());
        return amazonDynamoDBOpt.get();
    }

    @Override
    protected void serviceStop() throws Exception {
        amazonDynamoDBOpt.ifPresent(AmazonDynamoDB::shutdown);

        amazonDynamoDBLocalOpt.ifPresent(AmazonDynamoDBLocal::shutdown);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AmazonDynamoDB.class).toProvider(InMemoryDynamoDbProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(InMemoryDynamoDbProvider.class);

                install(DocumentDynamoDbProvider.module());
            }
        };
    }
}
