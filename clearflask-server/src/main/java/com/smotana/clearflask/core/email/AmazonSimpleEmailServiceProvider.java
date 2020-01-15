package com.smotana.clearflask.core.email;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.services.simpleemailv2.AmazonSimpleEmailServiceV2;
import com.amazonaws.services.simpleemailv2.AmazonSimpleEmailServiceV2ClientBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.core.ManagedService;

import java.util.Optional;


@Singleton
public class AmazonSimpleEmailServiceProvider extends ManagedService implements Provider<AmazonSimpleEmailServiceV2> {

    public interface Config {
        @NoDefaultValue
        String region();
    }

    @Inject
    private Config config;
    @Inject
    private AWSCredentialsProvider awsCredentialsProvider;

    private Optional<AmazonSimpleEmailServiceV2> sesOpt = Optional.empty();

    @Override
    public AmazonSimpleEmailServiceV2 get() {
        sesOpt = Optional.of(AmazonSimpleEmailServiceV2ClientBuilder.standard()
                .withCredentials(awsCredentialsProvider)
                .withRegion(config.region())
                .build());
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
