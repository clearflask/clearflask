// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store.route53;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.route53.AmazonRoute53;
import com.amazonaws.services.route53.AmazonRoute53ClientBuilder;
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
public class DefaultRoute53Provider extends ManagedService implements Provider<AmazonRoute53> {

    public interface Config {
        @DefaultValue("us-east-1")
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

    private Optional<AmazonRoute53> amazonRoute53Opt = Optional.empty();

    @Override
    public AmazonRoute53 get() {
        log.info("Opening Route53 client on {}", config.serviceEndpoint());
        AmazonRoute53ClientBuilder amazonRoute53ClientBuilder = AmazonRoute53ClientBuilder
                .standard()
                .withCredentials(AwsCredentialsProvider);
        String serviceEndpoint = config.serviceEndpoint();
        String signingRegion = config.signingRegion();
        String productionRegion = config.productionRegion();
        if (!Strings.isNullOrEmpty(serviceEndpoint) && !Strings.isNullOrEmpty(signingRegion)) {
            amazonRoute53ClientBuilder.withEndpointConfiguration(
                    new AwsClientBuilder.EndpointConfiguration(serviceEndpoint, signingRegion));
        } else if (!Strings.isNullOrEmpty(productionRegion)) {
            amazonRoute53ClientBuilder.withRegion(productionRegion);
        }

        amazonRoute53Opt = Optional.of(amazonRoute53ClientBuilder.build());
        return amazonRoute53Opt.get();
    }

    @Override
    protected void serviceStop() throws Exception {
        amazonRoute53Opt.ifPresent(AmazonRoute53::shutdown);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AmazonRoute53.class).toProvider(DefaultRoute53Provider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DefaultRoute53Provider.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
