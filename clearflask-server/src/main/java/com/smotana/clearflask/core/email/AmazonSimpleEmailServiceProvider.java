// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.email;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.simpleemailv2.AmazonSimpleEmailServiceV2;
import com.amazonaws.services.simpleemailv2.AmazonSimpleEmailServiceV2ClientBuilder;
import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.ProvisionException;
import com.google.inject.Singleton;
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
public class AmazonSimpleEmailServiceProvider extends ManagedService implements Provider<AmazonSimpleEmailServiceV2> {

    public interface Config {
        @DefaultValue("us-east-1")
        String region();

        @DefaultValue("")
        String serviceEndpoint();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private AWSCredentialsProvider awsCredentialsProvider;

    private Optional<AmazonSimpleEmailServiceV2> sesOpt = Optional.empty();

    @Override
    public AmazonSimpleEmailServiceV2 get() {
        if (configApp.startupWaitUntilDeps() && !Strings.isNullOrEmpty(config.serviceEndpoint())) {
            log.info("Waiting for SES to be up {}", config.serviceEndpoint());
            try {
                NetworkUtil.waitUntilPortOpen(config.serviceEndpoint());
            } catch (IOException ex) {
                throw new ProvisionException("Failed to wait until SES port opened", ex);
            }
        }
        log.info("Opening SES client on {}", config.serviceEndpoint());
        AmazonSimpleEmailServiceV2ClientBuilder sesBuilder = AmazonSimpleEmailServiceV2ClientBuilder.standard()
                .withCredentials(awsCredentialsProvider);
        String region = config.region();
        String serviceEndpoint = config.serviceEndpoint();
        if (!Strings.isNullOrEmpty(serviceEndpoint) && !Strings.isNullOrEmpty(region)) {
            sesBuilder.withEndpointConfiguration(
                    new AwsClientBuilder.EndpointConfiguration(serviceEndpoint, region));
        } else if (!Strings.isNullOrEmpty(region)) {
            sesBuilder.withRegion(region);
        } else {
            throw new IllegalArgumentException("SES Config is misconfigured, no region or endpoint set");
        }
        sesOpt = Optional.of(sesBuilder.build());
        return sesOpt.get();
    }

    @Override
    protected void serviceStop() throws Exception {
        sesOpt.ifPresent(AmazonSimpleEmailServiceV2::shutdown);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AmazonSimpleEmailServiceV2.class).toProvider(AmazonSimpleEmailServiceProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(AmazonSimpleEmailServiceProvider.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
