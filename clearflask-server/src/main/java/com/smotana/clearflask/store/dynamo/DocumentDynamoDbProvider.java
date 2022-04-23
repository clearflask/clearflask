// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.dynamo;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;

@Singleton
public class DocumentDynamoDbProvider implements Provider<DynamoDB> {

    @Inject
    private AmazonDynamoDB dynamo;

    @Override
    public DynamoDB get() {
        return new DynamoDB(dynamo);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DynamoDB.class).toProvider(DocumentDynamoDbProvider.class).asEagerSingleton();
            }
        };
    }
}
