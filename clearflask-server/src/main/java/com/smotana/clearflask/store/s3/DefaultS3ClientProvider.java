// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.s3;

import com.amazonaws.ClientConfiguration;
import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
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
import java.net.InetAddress;
import java.net.URL;
import java.util.Optional;

@Slf4j
@Singleton
public class DefaultS3ClientProvider extends ManagedService implements Provider<AmazonS3> {

    public interface Config {
        @DefaultValue("")
        String productionRegion();

        @DefaultValue("")
        String serviceEndpoint();

        @DefaultValue("")
        String signingRegion();

        @DefaultValue("")
        String dnsResolverTo();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private AWSCredentialsProvider AwsCredentialsProvider;

    private Optional<AmazonS3> amazonS3ClientOpt = Optional.empty();

    @Override
    public AmazonS3 get() {
        if (configApp.startupWaitUntilDeps() && !Strings.isNullOrEmpty(config.serviceEndpoint())) {
            log.info("Waiting for S3 to be up {}", config.serviceEndpoint());
            try {
                URL url = new URL(config.serviceEndpoint());
                NetworkUtil.waitUntilPortOpen(
                        !Strings.isNullOrEmpty(config.dnsResolverTo())
                                ? config.dnsResolverTo()
                                : url.getHost(),
                        url.getPort() != -1
                                ? url.getPort()
                                : url.getDefaultPort());
            } catch (IOException ex) {
                throw new ProvisionException("Failed to wait until S3 port opened", ex);
            }
        }
        log.info("Opening S3 client on {}", config.serviceEndpoint());
        AmazonS3ClientBuilder amazonS3ClientBuilder = AmazonS3ClientBuilder
                .standard()
                .withCredentials(AwsCredentialsProvider);
        String serviceEndpoint = config.serviceEndpoint();
        String signingRegion = config.signingRegion();
        String productionRegion = config.productionRegion();
        if (!Strings.isNullOrEmpty(serviceEndpoint) && !Strings.isNullOrEmpty(signingRegion)) {
            amazonS3ClientBuilder.withEndpointConfiguration(
                    new AwsClientBuilder.EndpointConfiguration(serviceEndpoint, signingRegion));
        } else if (!Strings.isNullOrEmpty(productionRegion)) {
            amazonS3ClientBuilder.withRegion(productionRegion);
        }
        if (!Strings.isNullOrEmpty(config.dnsResolverTo())) {
            amazonS3ClientBuilder.withClientConfiguration(new ClientConfiguration()
                    .withDnsResolver(host -> {
                        log.info("Resolving {}", host);
                        return new InetAddress[]{InetAddress.getByName(config.dnsResolverTo())};
                    }));
        }

        amazonS3ClientOpt = Optional.of(amazonS3ClientBuilder.build());
        return amazonS3ClientOpt.get();
    }

    @Override
    protected void serviceStop() throws Exception {
        amazonS3ClientOpt.ifPresent(AmazonS3::shutdown);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AmazonS3.class).toProvider(DefaultS3ClientProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DefaultS3ClientProvider.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
