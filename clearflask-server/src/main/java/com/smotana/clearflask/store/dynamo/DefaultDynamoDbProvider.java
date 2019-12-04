package com.smotana.clearflask.store.dynamo;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.google.common.base.Strings;
import com.google.common.util.concurrent.AbstractIdleService;
import com.google.common.util.concurrent.Service;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;

import java.util.Optional;

@Singleton
public class ProductionDynamoDbProvider extends AbstractIdleService implements Provider<AmazonDynamoDB> {

    private interface Config {
        @DefaultValue("")
        String serviceEndpoint();

        @DefaultValue("")
        String signingRegion();
    }

    @Inject
    private Config config;
    @Inject
    private AWSCredentialsProvider AwsCredentialsProvider;

    private Optional<AmazonDynamoDB> amazonDynamoDBOpt = Optional.empty();

    @Override
    public AmazonDynamoDB get() {
        AmazonDynamoDBClientBuilder amazonDynamoDBClientBuilder = AmazonDynamoDBClientBuilder
                .standard()
                .withCredentials(AwsCredentialsProvider);
        String serviceEndpoint = config.serviceEndpoint();
        String signingRegion = config.signingRegion();
        if (!Strings.isNullOrEmpty(serviceEndpoint) && !Strings.isNullOrEmpty(signingRegion)) {
            amazonDynamoDBClientBuilder.withEndpointConfiguration(
                    new AwsClientBuilder.EndpointConfiguration(serviceEndpoint, signingRegion));
        }
        amazonDynamoDBOpt = Optional.of(amazonDynamoDBClientBuilder.build());
        return amazonDynamoDBOpt.get();
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
                bind(AmazonDynamoDB.class).toProvider(ProductionDynamoDbProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), Service.class).addBinding().to(ProductionDynamoDbProvider.class);
                install(ConfigSystem.configModule(Config.class));

                install(DocumentDynamoDbProvider.module());
            }
        };
    }
}
