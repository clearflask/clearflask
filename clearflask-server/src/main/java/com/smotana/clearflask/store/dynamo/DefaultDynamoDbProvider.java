// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store.dynamo;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

@Slf4j
@Singleton
public class DefaultDynamoDbProvider extends ManagedService implements Provider<AmazonDynamoDB> {

    public static final int DYNAMO_READ_BATCH_MAX_SIZE = 100;
    public static final int DYNAMO_WRITE_BATCH_MAX_SIZE = 25;
    public static final String DYNAMO_WRITE_BATCH_MAX_SIZE_STR = "25";

    public interface Config {
        @DefaultValue("")
        String productionRegion();

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
        log.info("Opening Dynamo client on {}", config.serviceEndpoint());
        AmazonDynamoDBClientBuilder amazonDynamoDBClientBuilder = AmazonDynamoDBClientBuilder
                .standard()
                .withCredentials(AwsCredentialsProvider);
        String serviceEndpoint = config.serviceEndpoint();
        String signingRegion = config.signingRegion();
        String productionRegion = config.productionRegion();
        if (!Strings.isNullOrEmpty(serviceEndpoint) && !Strings.isNullOrEmpty(signingRegion)) {
            amazonDynamoDBClientBuilder.withEndpointConfiguration(
                    new AwsClientBuilder.EndpointConfiguration(serviceEndpoint, signingRegion));
        } else if (!Strings.isNullOrEmpty(productionRegion)) {
            amazonDynamoDBClientBuilder.withRegion(productionRegion);
        }

        amazonDynamoDBOpt = Optional.of(amazonDynamoDBClientBuilder.build());
        return amazonDynamoDBOpt.get();
    }

    @Override
    protected void serviceStop() throws Exception {
        amazonDynamoDBOpt.ifPresent(AmazonDynamoDB::shutdown);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AmazonDynamoDB.class).toProvider(DefaultDynamoDbProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DefaultDynamoDbProvider.class);
                install(ConfigSystem.configModule(Config.class));

                install(DocumentDynamoDbProvider.module());
            }
        };
    }
}
