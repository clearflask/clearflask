package com.smotana.clearflask.store.dynamo;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.google.common.util.concurrent.AbstractIdleService;
import com.google.common.util.concurrent.Service;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;

import java.util.Optional;

@Singleton
public class ProductionDynamoDbProvider extends AbstractIdleService implements Provider<DynamoDB> {

    @Inject
    private AWSCredentialsProvider AwsCredentialsProvider;

    private Optional<AmazonDynamoDB> amazonDynamoDBOpt = Optional.empty();

    @Override
    public DynamoDB get() {
        amazonDynamoDBOpt = Optional.of(AmazonDynamoDBClientBuilder
                .standard()
                .withCredentials(AwsCredentialsProvider)
                .build());
        return new DynamoDB(amazonDynamoDBOpt.get());
    }

    @Override
    protected void startUp() throws Exception {
    }

    @Override
    protected void shutDown() throws Exception {
        amazonDynamoDBOpt.ifPresent(AmazonDynamoDB::shutdown);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DynamoDB.class).toProvider(ProductionDynamoDbProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), Service.class).addBinding().to(ProductionDynamoDbProvider.class);
            }
        };
    }
}
