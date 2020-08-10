package com.smotana.clearflask.web.resource;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.model.ScanRequest;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.ControllableSleepingStopwatch;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.*;
import com.smotana.clearflask.core.push.NotificationServiceImpl;
import com.smotana.clearflask.core.push.message.*;
import com.smotana.clearflask.core.push.provider.MockBrowserPushService;
import com.smotana.clearflask.core.push.provider.MockEmailService;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.limiter.rate.LocalRateLimiter;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.*;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.*;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.MockAuthCookie;
import com.smotana.clearflask.web.security.MockExtendedSecurityContext;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.junit.Before;
import org.junit.Test;
import org.killbill.billing.ObjectType;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.notification.plugin.api.ExtBusEventType;

import java.util.UUID;

import static com.smotana.clearflask.testutil.DraftjsUtil.textToMockDraftjs;
import static io.jsonwebtoken.SignatureAlgorithm.HS512;

@Slf4j
public class BlackboxIT extends AbstractIT {

    @Inject
    private ProjectResource projectResource;
    @Inject
    private AccountResource accountResource;
    @Inject
    private UserResource userResource;
    @Inject
    private IdeaResource ideaResource;
    @Inject
    private CommentResource commentResource;
    @Inject
    private VoteResource voteResource;
    @Inject
    private KillBillResource killBillResource;
    @Inject
    private MockExtendedSecurityContext mockExtendedSecurityContext;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    private AccountStore accountStore;
    @Inject
    private Billing billing;
    @Inject
    private Gson gson;

    @Override
    protected void configure() {
        super.configure();

        ControllableSleepingStopwatch controllableSleepingStopwatch = new ControllableSleepingStopwatch();
        install(GuavaRateLimiters.testModule(controllableSleepingStopwatch));
        bind(ControllableSleepingStopwatch.class).toInstance(controllableSleepingStopwatch);

        install(Modules.override(
                Application.module(),
                MockExtendedSecurityContext.module(),
                ClearFlaskSso.module(),
                AccountResource.module(),
                ProjectResource.module(),
                UserResource.module(),
                KillBillResource.module(),
                KillBillSync.module(),
                KillBilling.module(),
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                NotificationServiceImpl.module(),
                EmailTemplates.module(),
                OnCommentReply.module(),
                OnStatusOrResponseChange.module(),
                OnForgotPassword.module(),
                OnAdminInvite.module(),
                OnEmailChanged.module(),
                MockBrowserPushService.module(),
                MockEmailService.module(),
                LocalRateLimiter.module(),
                ResourceLegalStore.module(),
                KillBillPlanStore.module(),
                DynamoElasticCommentStore.module(),
                DynamoAccountStore.module(),
                DynamoNotificationStore.module(),
                DynamoElasticIdeaStore.module(),
                DynamoProjectStore.module(),
                DynamoElasticUserStore.module(),
                DynamoVoteStore.module(),
                MockAuthCookie.module(),
                ElasticUtil.module(),
                DefaultServerSecret.module(Names.named("cursor"))
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(Application.Config.class, om -> {
                    om.override(om.id().domain()).withValue("localhost:8080");
                }));
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoElasticIdeaStore.Config.class, om -> {
                    om.override(om.id().elasticForceRefresh()).withValue(true);
                }));
                install(ConfigSystem.overrideModule(ClearFlaskSso.Config.class, om -> {
                    om.override(om.id().secretKey()).withValue("7c383beb-b3c2-4893-86ab-917d44202b8d");
                }));
                StringableSecretKey privKey = new StringableSecretKey(Keys.secretKeyFor(HS512));
                log.trace("Using generated priv key: {}", privKey);
                install(ConfigSystem.overrideModule(DynamoElasticUserStore.Config.class, om -> {
                    om.override(om.id().tokenSignerPrivKey()).withValue(privKey);
                    om.override(om.id().elasticForceRefresh()).withValue(true);
                }));
                install(ConfigSystem.overrideModule(KillBillSync.Config.class, om -> {
                    om.override(om.id().createTenant()).withValue(true);
                    om.override(om.id().uploadAnalyticsReports()).withValue(true);
                }));
                install(ConfigSystem.overrideModule(KillBillResource.Config.class, om -> {
                    om.override(om.id().registerWebhookOnStartup()).withValue(false);
                }));
            }
        }));
    }

    @Before
    public void setupTest() {
        accountResource.securityContext = mockExtendedSecurityContext;
        projectResource.securityContext = mockExtendedSecurityContext;
        userResource.securityContext = mockExtendedSecurityContext;
        ideaResource.securityContext = mockExtendedSecurityContext;
        commentResource.securityContext = mockExtendedSecurityContext;
        voteResource.securityContext = mockExtendedSecurityContext;
    }

    @Test(timeout = 300_000L)
    public void test() throws Exception {
        AccountAdmin accountAdmin = accountResource.accountSignupAdmin(new AccountSignupAdmin(
                "smotana",
                "unittest@clearflask.com",
                "password",
                "basic-monthly"));
        String accountId = accountStore.getAccountByEmail(accountAdmin.getEmail()).get().getAccountId();
        String projectId = "sermyproject";
        NewProjectResult newProjectResult = projectResource.projectCreateAdmin(
                projectId,
                ModelUtil.createEmptyConfig(projectId).getConfig());
        UserMeWithBalance user1 = userResource.userCreate(projectId, UserCreate.builder()
                .name("john")
                .email("john@example.com")
                .build())
                .getUser();
        IdeaWithVote idea1 = ideaResource.ideaCreate(projectId, IdeaCreate.builder()
                .authorUserId(user1.getUserId())
                .title("Add dark mode")
                .categoryId(newProjectResult.getConfig().getConfig().getContent().getCategories().get(0).getCategoryId())
                .tagIds(ImmutableList.of())
                .build());
        IdeaVoteUpdateResponse idea1vote1 = voteResource.ideaVoteUpdate(projectId, idea1.getIdeaId(), IdeaVoteUpdate.builder()
                .vote(VoteOption.UPVOTE)
                .build());
        CommentWithVote idea1comment1 = commentResource.commentCreate(projectId, idea1.getIdeaId(), CommentCreate.builder()
                .content(textToMockDraftjs("I like this"))
                .build());
        CommentVoteUpdateResponse comment1vote1 = voteResource.commentVoteUpdate(projectId, idea1.getIdeaId(), idea1comment1.getCommentId(), CommentVoteUpdate.builder()
                .vote(VoteOption.DOWNVOTE)
                .build());
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .paymentToken(AccountUpdateAdminPaymentToken.builder()
                        .type(Billing.Gateway.TEST.getPluginName())
                        .token("token")
                        .build())
                .build());
        sleepAndRefreshStatus(accountId, 16L);
        log.info("account status {} billing {}", accountStore.getAccountByAccountId(accountId).get().getStatus(), accountResource.accountBillingAdmin());
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .cancelEndOfTerm(true)
                .build());
        sleepAndRefreshStatus(accountId, 2L);
        log.info("account status {} billing {}", accountStore.getAccountByAccountId(accountId).get().getStatus(), accountResource.accountBillingAdmin());
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .cancelEndOfTerm(false)
                .build());
        sleepAndRefreshStatus(accountId, 36L);
        log.info("account status {} billing {}", accountStore.getAccountByAccountId(accountId).get().getStatus(), accountResource.accountBillingAdmin());
        accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .planid("standard-monthly")
                .build());
        dumpDynamoTable();
        accountResource.accountDeleteAdmin();
        dumpDynamoTable();
    }

    private void sleepAndRefreshStatus(String accountId, long sleepInDays) throws KillBillClientException {
        kbClient.doPut("/1.0/kb/test/clock?days=" + sleepInDays, "", KillBillUtil.roDefault());
        UUID accountIdKb = billing.getAccount(accountId).getAccountId();
        killBillResource.webhook(gson.toJson(new KillBillResource.Event(
                ExtBusEventType.SUBSCRIPTION_CHANGE,
                ObjectType.ACCOUNT,
                accountIdKb,
                accountIdKb,
                null)));
        log.info("Slept for {} days, account state {}", sleepInDays, accountStore.getAccountByAccountId(accountId).get().getStatus());
    }

    void dumpDynamoTable() {
        log.info("DynamoScan starting");
        String tableName = dynamoMapper.parseTableSchema(ProjectStore.ProjectModel.class).tableName();
        dynamo.scan(new ScanRequest()
                .withTableName(tableName))
                .getItems()
                .forEach(item -> log.info("DynamoScan: {}", item));
        log.info("DynamoScan finished");
    }
}