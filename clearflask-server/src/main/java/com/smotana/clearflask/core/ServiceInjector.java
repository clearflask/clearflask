package com.smotana.clearflask.core;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.AbstractModule;
import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.Module;
import com.google.inject.Stage;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.convert.ConfigValueConverters;
import com.kik.config.ice.convert.MoreConfigValueConverters;
import com.kik.config.ice.interceptor.NoopConfigValueInterceptor;
import com.kik.config.ice.internal.ConfigDescriptorHolder;
import com.kik.config.ice.naming.SimpleConfigNamingStrategy;
import com.kik.config.ice.source.FileDynamicConfigSource;
import com.kik.config.ice.source.JmxDynamicConfigSource;
import com.smotana.clearflask.billing.KillBillClientProvider;
import com.smotana.clearflask.billing.KillBillPlanStore;
import com.smotana.clearflask.billing.KillBillSync;
import com.smotana.clearflask.billing.KillBilling;
import com.smotana.clearflask.billing.StripeClientSetup;
import com.smotana.clearflask.core.email.AmazonSimpleEmailServiceProvider;
import com.smotana.clearflask.core.push.NotificationServiceImpl;
import com.smotana.clearflask.core.push.message.EmailTemplates;
import com.smotana.clearflask.core.push.message.EmailVerify;
import com.smotana.clearflask.core.push.message.OnAccountSignup;
import com.smotana.clearflask.core.push.message.OnAdminInvite;
import com.smotana.clearflask.core.push.message.OnCommentReply;
import com.smotana.clearflask.core.push.message.OnCreditChange;
import com.smotana.clearflask.core.push.message.OnEmailChanged;
import com.smotana.clearflask.core.push.message.OnForgotPassword;
import com.smotana.clearflask.core.push.message.OnPaymentFailed;
import com.smotana.clearflask.core.push.message.OnPostCreated;
import com.smotana.clearflask.core.push.message.OnStatusOrResponseChange;
import com.smotana.clearflask.core.push.message.OnTrialEnded;
import com.smotana.clearflask.core.push.provider.BrowserPushServiceImpl;
import com.smotana.clearflask.core.push.provider.EmailServiceImpl;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.limiter.TieredWebLimiter;
import com.smotana.clearflask.security.limiter.challenge.CaptchaChallenger;
import com.smotana.clearflask.security.limiter.challenge.LocalChallengeLimiter;
import com.smotana.clearflask.security.limiter.rate.LocalRateLimiter;
import com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.elastic.DefaultElasticSearchProvider;
import com.smotana.clearflask.store.impl.DynamoCertStore;
import com.smotana.clearflask.store.impl.DynamoElasticAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticCommentStore;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.store.impl.DynamoNotificationStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.store.impl.DynamoTokenVerifyStore;
import com.smotana.clearflask.store.impl.DynamoVoteStore;
import com.smotana.clearflask.store.impl.ResourceLegalStore;
import com.smotana.clearflask.store.route53.DefaultRoute53Provider;
import com.smotana.clearflask.util.BeanUtil;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.ExternController;
import com.smotana.clearflask.util.GsonProvider;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.filter.ApiExceptionMapperFilter;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.web.resource.ConnectResource;
import com.smotana.clearflask.web.resource.HealthResource;
import com.smotana.clearflask.web.resource.IdeaResource;
import com.smotana.clearflask.web.resource.KillBillResource;
import com.smotana.clearflask.web.resource.ProjectResource;
import com.smotana.clearflask.web.resource.SupportResource;
import com.smotana.clearflask.web.resource.UserResource;
import com.smotana.clearflask.web.resource.VoteResource;
import com.smotana.clearflask.web.security.AuthCookieImpl;
import com.smotana.clearflask.web.security.AuthenticationFilter;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import com.smotana.clearflask.web.security.UserBindUtil;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import javax.management.MBeanServer;
import java.lang.management.ManagementFactory;
import java.time.Duration;

@Slf4j
@NoArgsConstructor
public enum ServiceInjector {
    INSTANCE;

    public enum Environment {
        TEST(false),
        DEVELOPMENT_LOCAL(false),
        PRODUCTION_AWS(true);

        private boolean isProduction;

        Environment(boolean isProduction) {
            this.isProduction = isProduction;
        }

        public boolean isProduction() {
            return isProduction;
        }
    }

    private static volatile Injector injector = null;

    public Injector get() {
        if (injector == null) {
            synchronized (ServiceInjector.class) {
                if (injector == null) {
                    Environment env = detectEnvironment();
                    log.info("Detected environment {}", env.name());
                    Injector newInjector = create(env, Stage.DEVELOPMENT);
                    injector = newInjector;
                }
            }
        }
        return injector;
    }

    @VisibleForTesting
    protected Injector create(Environment env, Stage stage) {
        return Guice.createInjector(stage, module(env));
    }

    public void startServices() {
        log.info("Starting services");
        get().getInstance(ServiceManager.class).startAsync().awaitHealthy();
    }

    public void shutdownServices() {
        log.info("Stopping services");
        get().getInstance(ServiceManager.class).stopAsync().awaitStopped();
    }

    private static Module module(Environment env) {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Environment.class).toInstance(env);

                install(ServiceManagerProvider.module());
                install(GsonProvider.module());
                install(GuavaRateLimiters.module());

                // Stores
                install(DefaultDynamoDbProvider.module());
                install(DefaultElasticSearchProvider.module());
                install(DynamoProjectStore.module());
                install(DynamoElasticAccountStore.module());
                install(DynamoElasticUserStore.module());
                install(DynamoTokenVerifyStore.module());
                install(DynamoElasticIdeaStore.module());
                install(DynamoNotificationStore.module());
                install(DynamoElasticCommentStore.module());
                install(DynamoVoteStore.module());
                install(DynamoCertStore.module());
                install(DefaultRoute53Provider.module());
                install(ResourceLegalStore.module());
                install(DynamoMapperImpl.module());
                install(ElasticUtil.module());
                install(DefaultServerSecret.module(Names.named("cursor")));
                install(WebhookServiceImpl.module());

                // Notification
                install(NotificationServiceImpl.module());
                install(AmazonSimpleEmailServiceProvider.module());
                install(EmailTemplates.module());
                install(EmailServiceImpl.module());
                install(BrowserPushServiceImpl.module());
                install(OnCommentReply.module());
                install(OnCreditChange.module());
                install(OnStatusOrResponseChange.module());
                install(OnForgotPassword.module());
                install(OnAccountSignup.module());
                install(OnAdminInvite.module());
                install(OnEmailChanged.module());
                install(OnTrialEnded.module());
                install(OnPaymentFailed.module());
                install(OnPostCreated.module());
                install(EmailVerify.module());

                // Security
                install(AuthenticationFilter.module());
                install(SuperAdminPredicate.module());
                install(TieredWebLimiter.module());
                install(LocalRateLimiter.module());
                install(LocalChallengeLimiter.module());
                install(CaptchaChallenger.module());
                install(UserBindUtil.module());

                // Configuration
                install(ConfigSystem.module());
                install(SimpleConfigNamingStrategy.module());
                install(ConfigValueConverters.module());
                install(MoreConfigValueConverters.module());
                install(NoopConfigValueInterceptor.module());
                bind(ConfigDescriptorHolder.class);
                // Need to handle re-registering beans if tomcat doesn't restart between loading app again
                MBeanServer mBeanServer = BeanUtil.wrapOverwriteRegister(ManagementFactory.getPlatformMBeanServer());
                bind(MBeanServer.class).toInstance(mBeanServer);
                install(JmxDynamicConfigSource.module());
                install(FileDynamicConfigSource.module());
                bind(Duration.class).annotatedWith(Names.named(FileDynamicConfigSource.POLL_INTERVAL_NAME)).toInstance(Duration.ofSeconds(10));

                // API endpoints
                install(Application.module());
                bind(HealthResource.class);
                install(UserResource.module());
                install(KillBillResource.module());
                install(AccountResource.module());
                install(IdeaResource.module());
                install(VoteResource.module());
                install(ProjectResource.module());
                install(SupportResource.module());
                install(ConnectResource.module());

                // Billing
                install(KillBillClientProvider.module());
                install(KillBilling.module());
                install(KillBillSync.module());
                install(StripeClientSetup.module());
                install(KillBillPlanStore.module());

                // Other
                install(ApiExceptionMapperFilter.module());
                install(ClearFlaskSso.module());
                install(ClearFlaskCreditSync.module());
                install(AuthCookieImpl.module());
                install(Sanitizer.module());
                install(IntercomUtil.module());

                switch (env) {
                    case DEVELOPMENT_LOCAL:
                        bind(AWSCredentialsProvider.class).toInstance(new AWSStaticCredentialsProvider(new BasicAWSCredentials("test", "test")));
                        bind(String.class).annotatedWith(Names.named(FileDynamicConfigSource.FILENAME_NAME)).toInstance(
                                getClass().getClassLoader().getResource("config-local.cfg").getPath());
                        break;
                    case PRODUCTION_AWS:
                        bind(AWSCredentialsProvider.class).to(DefaultAWSCredentialsProviderChain.class);
                        bind(String.class).annotatedWith(Names.named(FileDynamicConfigSource.FILENAME_NAME)).toInstance(
                                "/opt/clearflask/config-prod.cfg");
                        break;
                    case TEST:
                    default:
                        throw new RuntimeException("Unsupported environment: " + env);
                }

                install(ExternController.module());
            }
        };
    }

    private static Environment detectEnvironment() {
        String envEnvironment = System.getenv("CLEARFLASK_ENVIRONMENT");
        if (envEnvironment != null) {
            return Environment.valueOf(envEnvironment);
        }
        throw new RuntimeException("Could not determine environment. Did you forget to set env var CLEARFLASK_ENVIRONMENT?");
    }
}
