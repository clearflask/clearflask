// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Enums;
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
import com.kik.config.ice.convert.FileDynamicConfigSourceManagedService;
import com.kik.config.ice.convert.MoreConfigValueConverters;
import com.kik.config.ice.interceptor.NoopConfigValueInterceptor;
import com.kik.config.ice.internal.ConfigDescriptorHolder;
import com.kik.config.ice.naming.SimpleConfigNamingStrategy;
import com.kik.config.ice.source.FileDynamicConfigSource;
import com.kik.config.ice.source.JmxDynamicConfigSource;
import com.smotana.clearflask.antispam.CastleAntiSpam;
import com.smotana.clearflask.billing.CommonPlanVerifyStore;
import com.smotana.clearflask.billing.DynamoCouponStore;
import com.smotana.clearflask.billing.KillBillClientProvider;
import com.smotana.clearflask.billing.KillBillPlanStore;
import com.smotana.clearflask.billing.KillBillSync;
import com.smotana.clearflask.billing.KillBilling;
import com.smotana.clearflask.billing.SelfHostBilling;
import com.smotana.clearflask.billing.SelfHostPlanStore;
import com.smotana.clearflask.billing.StripeClientSetup;
import com.smotana.clearflask.core.email.AmazonSimpleEmailServiceProvider;
import com.smotana.clearflask.core.email.ProjectDeletionService;
import com.smotana.clearflask.core.email.TrialEndingReminderService;
import com.smotana.clearflask.core.email.WeeklyDigestService;
import com.smotana.clearflask.core.image.ImageNormalizationImpl;
import com.smotana.clearflask.core.push.NotificationServiceImpl;
import com.smotana.clearflask.core.push.message.EmailLogin;
import com.smotana.clearflask.core.push.message.EmailTemplates;
import com.smotana.clearflask.core.push.message.EmailVerify;
import com.smotana.clearflask.core.push.message.OnAccountSignup;
import com.smotana.clearflask.core.push.message.OnCommentReply;
import com.smotana.clearflask.core.push.message.OnCreditChange;
import com.smotana.clearflask.core.push.message.OnDigest;
import com.smotana.clearflask.core.push.message.OnEmailChanged;
import com.smotana.clearflask.core.push.message.OnAdminForgotPassword;
import com.smotana.clearflask.core.push.message.OnForgotPassword;
import com.smotana.clearflask.core.push.message.OnInvoicePaymentSuccess;
import com.smotana.clearflask.core.push.message.OnModInvite;
import com.smotana.clearflask.core.push.message.OnPaymentFailed;
import com.smotana.clearflask.core.push.message.OnPostCreated;
import com.smotana.clearflask.core.push.message.OnPostCreatedOnBehalfOf;
import com.smotana.clearflask.core.push.message.OnProjectDeletionImminent;
import com.smotana.clearflask.core.push.message.OnStatusOrResponseChange;
import com.smotana.clearflask.core.push.message.OnTeammateInvite;
import com.smotana.clearflask.core.push.message.OnTrialEnded;
import com.smotana.clearflask.core.push.message.OnTrialEnding;
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
import com.smotana.clearflask.store.CloudLocalLicenseStore;
import com.smotana.clearflask.store.ConfigAwsCredentialsProvider;
import com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.elastic.DefaultElasticSearchProvider;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.github.GitHubClientProviderImpl;
import com.smotana.clearflask.store.github.GitHubStoreImpl;
import com.smotana.clearflask.store.jira.AdfQuillConverter;
import com.smotana.clearflask.store.jira.JiraClientProviderImpl;
import com.smotana.clearflask.store.jira.JiraStoreImpl;
import com.smotana.clearflask.store.slack.SlackClientProviderImpl;
import com.smotana.clearflask.store.slack.SlackStoreImpl;
import com.smotana.clearflask.store.gitlab.GitLabClientProviderImpl;
import com.smotana.clearflask.store.gitlab.GitLabStoreImpl;
import com.smotana.clearflask.store.impl.ConfigurableLlmPromptStore;
import com.smotana.clearflask.store.impl.DynamoCertStore;
import com.smotana.clearflask.store.impl.DynamoDraftStore;
import com.smotana.clearflask.store.impl.DynamoElasticAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticCommentStore;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.store.impl.DynamoLlmHistoryStore;
import com.smotana.clearflask.store.impl.DynamoLlmMemoryStore;
import com.smotana.clearflask.store.impl.DynamoNotificationStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.store.impl.DynamoRemoteLicenseStore;
import com.smotana.clearflask.store.impl.DynamoTokenVerifyStore;
import com.smotana.clearflask.store.impl.DynamoVoteStore;
import com.smotana.clearflask.store.impl.LangChainLlmAgentStore;
import com.smotana.clearflask.store.impl.LangChainLlmToolingStore;
import com.smotana.clearflask.store.impl.ResourceLegalStore;
import com.smotana.clearflask.store.impl.S3ContentStore;
import com.smotana.clearflask.store.mysql.DefaultMysqlProvider;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.store.route53.DefaultRoute53Provider;
import com.smotana.clearflask.store.s3.DefaultS3ClientProvider;
import com.smotana.clearflask.util.AutoCreateKikConfigFile;
import com.smotana.clearflask.util.BeanUtil;
import com.smotana.clearflask.util.ChatwootUtil;
import com.smotana.clearflask.util.ConfigSchemaUpgrader;
import com.smotana.clearflask.util.ConfigUtil;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ExternController;
import com.smotana.clearflask.util.GsonProvider;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.MarkdownAndQuillUtil;
import com.smotana.clearflask.util.MustacheProvider;
import com.smotana.clearflask.util.ProjectUpgraderImpl;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.filter.ApiExceptionMapperFilter;
import com.smotana.clearflask.web.filter.UmbrellaFilterProvider;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.web.resource.CommentResource;
import com.smotana.clearflask.web.resource.ConnectResource;
import com.smotana.clearflask.web.resource.ContentResource;
import com.smotana.clearflask.web.resource.CreditResource;
import com.smotana.clearflask.web.resource.GitHubResource;
import com.smotana.clearflask.web.resource.SlackResource;
import com.smotana.clearflask.web.resource.GitLabResource;
import com.smotana.clearflask.web.resource.HealthResource;
import com.smotana.clearflask.web.resource.JiraResource;
import com.smotana.clearflask.web.resource.IdeaResource;
import com.smotana.clearflask.web.resource.KillBillResource;
import com.smotana.clearflask.web.resource.LlmResource;
import com.smotana.clearflask.web.resource.NotificationResource;
import com.smotana.clearflask.web.resource.ProjectResource;
import com.smotana.clearflask.web.resource.SupportResource;
import com.smotana.clearflask.web.resource.TestResource;
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
                install(MustacheProvider.module());

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
                install(DynamoRemoteLicenseStore.module());
                install(CloudLocalLicenseStore.module());
                if (env != Environment.PRODUCTION_SELF_HOST) {
                    install(DefaultRoute53Provider.module());
                }
                install(GitHubClientProviderImpl.module());
                install(GitHubStoreImpl.module());
                install(JiraClientProviderImpl.module());
                install(JiraStoreImpl.module());
                install(AdfQuillConverter.module());
                install(SlackClientProviderImpl.module());
                install(SlackStoreImpl.module());
                install(GitLabClientProviderImpl.module());
                install(GitLabStoreImpl.module());
                install(ResourceLegalStore.module());
                install(SingleTableProvider.module());
                install(MysqlUtil.module());
                install(ElasticUtil.module());
                install(DefaultServerSecret.module(Names.named("cursor")));
                install(WebhookServiceImpl.module());
                install(DynamoCouponStore.module());

                // LLM
                install(DynamoLlmHistoryStore.module());
                install(DynamoLlmMemoryStore.module());
                install(LangChainLlmAgentStore.module());
                install(LangChainLlmToolingStore.module());
                install(ConfigurableLlmPromptStore.module());

                // Notification
                install(NotificationServiceImpl.module());
                install(AmazonSimpleEmailServiceProvider.module());
                install(EmailTemplates.module());
                install(EmailServiceImpl.module());
                install(WeeklyDigestService.module());
                install(TrialEndingReminderService.module());
                install(ProjectDeletionService.module());
                install(BrowserPushServiceImpl.module());
                install(OnCommentReply.module());
                install(OnCreditChange.module());
                install(OnStatusOrResponseChange.module());
                install(OnForgotPassword.module());
                install(OnAdminForgotPassword.module());
                install(OnAccountSignup.module());
                install(OnModInvite.module());
                install(OnTeammateInvite.module());
                install(OnEmailChanged.module());
                install(OnDigest.module());
                install(OnTrialEnding.module());
                install(OnProjectDeletionImminent.module());
                install(OnTrialEnded.module());
                install(OnPaymentFailed.module());
                install(OnInvoicePaymentSuccess.module());
                install(OnPostCreated.module());
                install(OnPostCreatedOnBehalfOf.module());
                install(EmailVerify.module());
                install(EmailLogin.module());

                // Security
                install(AuthenticationFilter.module());
                install(UmbrellaFilterProvider.module());
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
                install(JiraResource.module());
                install(SlackResource.module());
                install(GitLabResource.module());
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
                install(LlmResource.module());

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
                install(CastleAntiSpam.module());

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
