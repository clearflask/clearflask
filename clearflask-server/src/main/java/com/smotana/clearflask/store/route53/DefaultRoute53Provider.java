// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.route53;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.route53.AmazonRoute53;
import com.amazonaws.services.route53.AmazonRoute53ClientBuilder;
import com.google.common.base.Strings;
import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.util.NetworkUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
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
    private Application.Config configApp;
    @Inject
    private AWSCredentialsProvider AwsCredentialsProvider;

    private Optional<AmazonRoute53> amazonRoute53Opt = Optional.empty();

    @Override
    public AmazonRoute53 get() {
        if (configApp.startupWaitUntilDeps() && !Strings.isNullOrEmpty(config.serviceEndpoint())) {
            log.info("Waiting for Route53 to be up {}", config.serviceEndpoint());
            try {
                NetworkUtil.waitUntilPortOpen(config.serviceEndpoint());
            } catch (IOException ex) {
                throw new ProvisionException("Failed to wait until Route53 port opened", ex);
            }
        }
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
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DefaultRoute53Provider.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
