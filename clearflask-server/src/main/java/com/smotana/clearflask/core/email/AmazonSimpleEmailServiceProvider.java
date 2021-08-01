// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
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
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;

import java.util.Optional;


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
    private AWSCredentialsProvider awsCredentialsProvider;

    private Optional<AmazonSimpleEmailServiceV2> sesOpt = Optional.empty();

    @Override
    public AmazonSimpleEmailServiceV2 get() {
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
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(AmazonSimpleEmailServiceProvider.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
