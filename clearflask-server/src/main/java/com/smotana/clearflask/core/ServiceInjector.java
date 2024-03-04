// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Enums;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.convert.ConfigValueConverters;
import com.kik.config.ice.convert.FileDynamicConfigSourceManagedService;
import com.kik.config.ice.convert.MoreConfigValueConverters;
import com.kik.config.ice.interceptor.NoopConfigValueInterceptor;
import com.kik.config.ice.internal.ConfigDescriptorHolder;
import com.kik.config.ice.naming.SimpleConfigNamingStrategy;
import com.kik.config.ice.source.FileDynamicConfigSource;
import com.kik.config.ice.source.JmxDynamicConfigSource;
import com.smotana.clearflask.billing.*;
import com.smotana.clearflask.core.email.AmazonSimpleEmailServiceProvider;
import com.smotana.clearflask.core.image.ImageNormalizationImpl;
import com.smotana.clearflask.core.push.NotificationServiceImpl;
import com.smotana.clearflask.core.push.message.*;
import com.smotana.clearflask.core.push.provider.BrowserPushServiceImpl;
import com.smotana.clearflask.core.push.provider.EmailServiceImpl;
import com.smotana.clearflask.security.CertFetcherImpl;
import com.smotana.clearflask.security.CheckMailOrgEmailValidator;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.SimpleEmailValidator;
import com.smotana.clearflask.security.limiter.TieredWebLimiter;
import com.smotana.clearflask.security.limiter.challenge.CaptchaChallenger;
import com.smotana.clearflask.security.limiter.challenge.LocalChallengeLimiter;
import com.smotana.clearflask.security.limiter.rate.LocalRateLimiter;
import com.smotana.clearflask.store.ConfigAwsCredentialsProvider;
import com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.elastic.DefaultElasticSearchProvider;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.github.GitHubClientProviderImpl;
import com.smotana.clearflask.store.github.GitHubStoreImpl;
import com.smotana.clearflask.store.impl.*;
import com.smotana.clearflask.store.mysql.DefaultMysqlProvider;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.store.route53.DefaultRoute53Provider;
import com.smotana.clearflask.store.s3.DefaultS3ClientProvider;
import com.smotana.clearflask.util.*;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.filter.ApiExceptionMapperFilter;
import com.smotana.clearflask.web.resource.*;
import com.smotana.clearflask.web.security.*;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import javax.management.MBeanServer;
import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.util.Optional;

@Slf4j
@NoArgsConstructor
public enum ServiceInjector {
    INSTANCE;

    public enum Environment {
        TEST(false),
        DEVELOPMENT_LOCAL(false),
        PRODUCTION_AWS(true),
        PRODUCTION_SELF_HOST(true);

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
                    Environment env = detectEnvironment()
                            .orElseThrow(() -> new RuntimeException("Could not determine environment. Did you forget to set env var CLEARFLASK_ENVIRONMENT?"));
                    log.info("Detected environment {}", env.name());
                    log.info("Creating injector");
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
                install(ConfigAwsCredentialsProvider.module());
                install(DefaultDynamoDbProvider.module());
                install(DefaultS3ClientProvider.module());
                install(DefaultElasticSearchProvider.module());
                install(DefaultMysqlProvider.module());
                install(S3ContentStore.module());
                install(DynamoProjectStore.module());
                install(DynamoElasticAccountStore.module());
                install(DynamoElasticUserStore.module());
                install(DynamoTokenVerifyStore.module());
                install(DynamoElasticIdeaStore.module());
                install(DynamoDraftStore.module());
                install(DynamoNotificationStore.module());
                install(DynamoElasticCommentStore.module());
                install(DynamoVoteStore.module());
                install(DynamoCertStore.module());
                install(DynamoLicenseStore.module());
                if (env != Environment.PRODUCTION_SELF_HOST) {
                    install(DefaultRoute53Provider.module());
                }
                install(GitHubClientProviderImpl.module());
                install(GitHubStoreImpl.module());
                install(ResourceLegalStore.module());
                install(SingleTableProvider.module());
                install(MysqlUtil.module());
                install(ElasticUtil.module());
                install(DefaultServerSecret.module(Names.named("cursor")));
                install(WebhookServiceImpl.module());
                install(DynamoCouponStore.module());

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
                install(OnModInvite.module());
                install(OnTeammateInvite.module());
                install(OnEmailChanged.module());
                install(OnTrialEnded.module());
                install(OnPaymentFailed.module());
                install(OnInvoicePaymentSuccess.module());
                install(OnPostCreated.module());
                install(EmailVerify.module());
                install(EmailLogin.module());

                // Security
                install(AuthenticationFilter.module());
                install(SuperAdminPredicate.module());
                install(TieredWebLimiter.module());
                install(LocalRateLimiter.module());
                install(LocalChallengeLimiter.module());
                install(CaptchaChallenger.module());
                install(UserBindUtil.module());
                install(CertFetcherImpl.module());
                if (env == Environment.PRODUCTION_AWS) {
                    install(CheckMailOrgEmailValidator.module());
                } else {
                    install(SimpleEmailValidator.module());
                }

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
                install(FileDynamicConfigSourceManagedService.module());
                bind(Duration.class).annotatedWith(Names.named(FileDynamicConfigSource.POLL_INTERVAL_NAME)).toInstance(Duration.ofSeconds(10));

                // API endpoints
                install(Application.module());
                install(HealthResource.module());
                if (!env.isProduction()) {
                    bind(TestResource.class);
                }
                if (env != Environment.PRODUCTION_SELF_HOST) {
                    install(KillBillResource.module());
                }
                install(GitHubResource.module());
                install(UserResource.module());
                install(AccountResource.module());
                install(IdeaResource.module());
                install(VoteResource.module());
                install(ProjectResource.module());
                install(SupportResource.module());
                install(ConnectResource.module());
                install(ContentResource.module());
                install(CommentResource.module());
                install(CreditResource.module());
                install(NotificationResource.module());

                // Billing
                install(CommonPlanVerifyStore.module());
                if (env == Environment.PRODUCTION_SELF_HOST) {
                    install(SelfHostBilling.module());
                    install(SelfHostPlanStore.module());
                } else {
                    install(KillBillClientProvider.module());
                    install(KillBilling.module());
                    install(KillBillSync.module());
                    install(StripeClientSetup.module());
                    install(KillBillPlanStore.module());
                }

                // Other
                install(ApiExceptionMapperFilter.module());
                install(ClearFlaskSso.module());
                install(ClearFlaskCreditSync.module());
                install(AuthCookieImpl.module());
                install(Sanitizer.module());
                install(IntercomUtil.module());
                install(ChatwootUtil.module());
                install(ConfigUtil.module());
                install(ImageNormalizationImpl.module());
                bind(ConfigSchemaUpgrader.class);
                install(ProjectUpgraderImpl.module());
                install(MarkdownAndQuillUtil.module());

                String configFilePath;
                switch (env) {
                    case DEVELOPMENT_LOCAL:
                        configFilePath = "/opt/clearflask/config-local.cfg";
                        break;
                    case PRODUCTION_SELF_HOST:
                        configFilePath = "/opt/clearflask/config-selfhost.cfg";
                        break;
                    case PRODUCTION_AWS:
                        configFilePath = "/opt/clearflask/config-prod.cfg";
                        break;
                    case TEST:
                    default:
                        throw new RuntimeException("Unsupported environment: " + env);
                }
                AutoCreateKikConfigFile.run(configFilePath, env);
                bind(String.class).annotatedWith(Names.named(FileDynamicConfigSource.FILENAME_NAME)).toInstance(configFilePath);

                install(ExternController.module());
            }
        };
    }

    private static volatile Optional<Environment> envCache;

    @SuppressWarnings("OptionalAssignedToNull")
    public static Optional<Environment> detectEnvironment() {
        if (envCache == null) {
            synchronized (Environment.class) {
                if (envCache == null) {
                    envCache = Optional.ofNullable(System.getenv("CLEARFLASK_ENVIRONMENT"))
                            .flatMap(envStr -> Enums.getIfPresent(Environment.class, envStr).toJavaUtil());
                }
            }
        }
        return envCache;
    }
}
