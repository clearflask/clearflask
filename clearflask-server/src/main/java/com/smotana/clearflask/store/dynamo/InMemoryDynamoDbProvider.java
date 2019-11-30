package com.smotana.clearflask.store.dynamo;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.local.embedded.DynamoDBEmbedded;
import com.amazonaws.services.dynamodbv2.local.shared.access.AmazonDynamoDBLocal;
import com.google.common.util.concurrent.AbstractIdleService;
import com.google.common.util.concurrent.Service;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;

import java.util.Optional;

@Singleton
public class InMemoryDynamoDbProvider extends AbstractIdleService implements Provider<DynamoDB> {

    private Optional<AmazonDynamoDBLocal> amazonDynamoDBLocalOpt = Optional.empty();
    private Optional<AmazonDynamoDB> amazonDynamoDBOpt = Optional.empty();

    @Override
    public DynamoDB get() {
        amazonDynamoDBLocalOpt = Optional.of(DynamoDBEmbedded.create());
        amazonDynamoDBOpt = Optional.of(amazonDynamoDBLocalOpt.get().amazonDynamoDB());
        return new DynamoDB(amazonDynamoDBOpt.get());
    }

    @Override
    protected void startUp() throws Exception {
    }

    @Override
    protected void shutDown() throws Exception {
        amazonDynamoDBOpt.ifPresent(AmazonDynamoDB::shutdown);

        amazonDynamoDBLocalOpt.ifPresent(AmazonDynamoDBLocal::shutdown);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DynamoDB.class).toProvider(InMemoryDynamoDbProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), Service.class).addBinding().to(InMemoryDynamoDbProvider.class);
            }
        };
    }
}
