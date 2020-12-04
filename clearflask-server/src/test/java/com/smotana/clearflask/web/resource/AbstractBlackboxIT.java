package com.smotana.clearflask.web.resource;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.model.ScanRequest;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ControllableSleepingStopwatch;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.ning.http.client.Response;
import com.smotana.clearflask.TestUtil;
import com.smotana.clearflask.api.model.AccountAdmin;
import com.smotana.clearflask.api.model.AccountBillingPayment;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdmin;
import com.smotana.clearflask.api.model.AccountUpdateAdminPaymentToken;
import com.smotana.clearflask.api.model.AccountUpdateSuperAdmin;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.IdeaCreate;
import com.smotana.clearflask.api.model.IdeaWithVote;
import com.smotana.clearflask.api.model.NewProjectResult;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.api.model.UserCreate;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.KillBillPlanStore;
import com.smotana.clearflask.billing.KillBillSync;
import com.smotana.clearflask.billing.KillBillUtil;
import com.smotana.clearflask.billing.KillBilling;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.billing.StripeClientSetup;
import com.smotana.clearflask.core.ClearFlaskCreditSync;
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
import com.smotana.clearflask.core.push.message.OnStatusOrResponseChange;
import com.smotana.clearflask.core.push.message.OnTrialEnded;
import com.smotana.clearflask.core.push.provider.MockBrowserPushService;
import com.smotana.clearflask.core.push.provider.MockEmailService;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.limiter.rate.LocalRateLimiter;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoElasticAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticCommentStore;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.store.impl.DynamoNotificationStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.store.impl.DynamoTokenVerifyStore;
import com.smotana.clearflask.store.impl.DynamoVoteStore;
import com.smotana.clearflask.store.impl.ResourceLegalStore;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.ModelUtil;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.util.StringableSecretKey;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.resource.PaymentTestPluginConfigure.PaymentTestPluginAction;
import com.smotana.clearflask.web.security.MockAuthCookie;
import com.smotana.clearflask.web.security.MockExtendedSecurityContext;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import com.smotana.clearflask.web.security.UserBindUtil;
import io.jsonwebtoken.security.Keys;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.junit.Before;
import org.killbill.billing.ObjectType;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.notification.plugin.api.ExtBusEventType;

import javax.ws.rs.core.MediaType;
import java.util.Optional;
import java.util.UUID;

import static io.jsonwebtoken.SignatureAlgorithm.HS512;
import static org.junit.Assert.*;

@Slf4j
public abstract class AbstractBlackboxIT extends AbstractIT {

    @Inject
    protected ProjectResource projectResource;
    @Inject
    protected AccountResource accountResource;
    @Inject
    protected UserResource userResource;
    @Inject
    protected IdeaResource ideaResource;
    @Inject
    protected CommentResource commentResource;
    @Inject
    protected VoteResource voteResource;
    @Inject
    protected KillBillResource killBillResource;
    @Inject
    protected MockExtendedSecurityContext mockExtendedSecurityContext;
    @Inject
    protected AmazonDynamoDB dynamo;
    @Inject
    protected DynamoMapper dynamoMapper;
    @Inject
    protected AccountStore accountStore;
    @Inject
    protected Billing billing;
    @Inject
    protected Gson gson;

    protected long userNumber = 0L;

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
                ClearFlaskCreditSync.module(),
                KillBillResource.module(),
                KillBillSync.module(),
                StripeClientSetup.module(),
                KillBilling.module(),
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                NotificationServiceImpl.module(),
                EmailTemplates.module(),
                OnCreditChange.module(),
                OnCommentReply.module(),
                OnStatusOrResponseChange.module(),
                OnTrialEnded.module(),
                OnPaymentFailed.module(),
                OnForgotPassword.module(),
                OnAccountSignup.module(),
                IntercomUtil.module(),
                OnAdminInvite.module(),
                OnEmailChanged.module(),
                EmailVerify.module(),
                MockBrowserPushService.module(),
                MockEmailService.module(),
                LocalRateLimiter.module(),
                ResourceLegalStore.module(),
                KillBillPlanStore.module(),
                SuperAdminPredicate.module(),
                DynamoElasticCommentStore.module(),
                DynamoElasticAccountStore.module(),
                DynamoNotificationStore.module(),
                DynamoElasticIdeaStore.module(),
                DynamoProjectStore.module(),
                DynamoElasticUserStore.module(),
                DynamoTokenVerifyStore.module(),
                DynamoVoteStore.module(),
                MockAuthCookie.module(),
                UserBindUtil.module(),
                ElasticUtil.module(),
                Sanitizer.module(),
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
                install(ConfigSystem.overrideModule(StripeClientSetup.Config.class, om -> {
                    om.override(om.id().stripeApiKey()).withValue("none");
                    om.override(om.id().overrideBaseUrl()).withValue("http://localhost");
                }));
                install(ConfigSystem.overrideModule(KillBillSync.Config.class, om -> {
                    om.override(om.id().createTenant()).withValue(true);
                    om.override(om.id().uploadAnalyticsReports()).withValue(true);
                    om.override(om.id().emailPluginHost()).withValue("host.docker.internal");
                    om.override(om.id().emailPluginPort()).withValue(9001);
                    om.override(om.id().emailPluginUsername()).withValue("a");
                    om.override(om.id().emailPluginPassword()).withValue("a");
                    om.override(om.id().emailPluginUseSsl()).withValue(false);
                }));
                install(ConfigSystem.overrideModule(KillBillResource.Config.class, om -> {
                    om.override(om.id().registerWebhookOnStartup()).withValue(false);
                }));
            }
        }));
    }

    @Before
    public void setupTest() throws Exception {
        accountResource.securityContext = mockExtendedSecurityContext;
        projectResource.securityContext = mockExtendedSecurityContext;
        userResource.securityContext = mockExtendedSecurityContext;
        ideaResource.securityContext = mockExtendedSecurityContext;
        commentResource.securityContext = mockExtendedSecurityContext;
        voteResource.securityContext = mockExtendedSecurityContext;

        kbClockReset();
        resetPaymentPlugin();
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    protected static class AccountAndProject {
        AccountAdmin account;
        NewProjectResult project;
    }

    protected AccountAndProject getTrialAccount() throws Exception {
        return getTrialAccount("growth-monthly");
    }

    protected AccountAndProject getTrialAccount(String planid) throws Exception {
        AccountAdmin accountAdmin = accountResource.accountSignupAdmin(new AccountSignupAdmin(
                "smotana",
                IdUtil.randomId(5) + "unittest@clearflask.com",
                "password",
                planid));
        String accountId = accountStore.getAccountByEmail(accountAdmin.getEmail()).get().getAccountId();
        NewProjectResult newProjectResult = projectResource.projectCreateAdmin(
                ModelUtil.createEmptyConfig("myproject").getConfig());
        return new AccountAndProject(accountAdmin, newProjectResult);
    }

    protected AccountAndProject changePlan(AccountAndProject accountAndProject, String planId) {
        AccountAdmin accountAdmin = accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .basePlanId(planId)
                .build());
        return accountAndProject.toBuilder().account(accountAdmin).build();
    }

    protected AccountAndProject changePlanToFlat(AccountAndProject accountAndProject, long yearlyPrice) {
        AccountAdmin accountAdmin = accountResource.accountUpdateSuperAdmin(AccountUpdateSuperAdmin.builder()
                .changeToFlatPlanWithYearlyPrice(yearlyPrice)
                .build());
        return accountAndProject.toBuilder().account(accountAdmin).build();
    }

    protected AccountAndProject getActiveAccount() throws Exception {
        return getActiveAccount("growth-monthly");
    }

    protected AccountAndProject getActiveAccount(String planid) throws Exception {
        AccountAndProject accountAndProject = getTrialAccount(planid);
        accountAndProject = addPaymentMethod(accountAndProject);
        accountAndProject = endTrial(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVE);
        return accountAndProject;
    }

    protected AccountAndProject addPaymentMethod(AccountAndProject accountAndProject) throws Exception {
        AccountAdmin accountAdmin = accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .paymentToken(AccountUpdateAdminPaymentToken.builder()
                        .type(Billing.Gateway.PAYMENT_TEST.getPluginName())
                        .token("token")
                        .build())
                .build());
        AccountBillingPayment paymentMethod = accountResource.accountBillingAdmin(false).getPayment();
        assertNotNull(paymentMethod);
        log.trace("Added payment method {}", paymentMethod);
        return accountAndProject
                .toBuilder()
                .account(accountAdmin)
                .build();
    }

    protected AccountAndProject endTrial(AccountAndProject accountAndProject) throws Exception {
        assertTrue(billing.endTrial(accountStore.getAccountByEmail(accountAndProject.getAccount().getEmail()).get().getAccountId()));
        return accountAndProject
                .toBuilder()
                .account(accountResource.accountBindAdmin().getAccount())
                .build();
    }

    protected AccountAndProject reachTrialLimit(AccountAndProject accountAndProject) throws Exception {
        for (int x = 0; x < PlanStore.STOP_TRIAL_AFTER_ACTIVE_USERS_REACHES; x++) {
            UserMeWithBalance userAdded = addActiveUser(
                    accountAndProject.getProject().getProjectId(),
                    accountAndProject.getProject().getConfig().getConfig());
            log.info("Added user {}", userAdded.getName());
        }
        TestUtil.retry(() -> {
            SubscriptionStatus subsStatus = accountResource.accountBindAdmin().getAccount().getSubscriptionStatus();
            assertTrue("Account expected to end trial, instead status is " + subsStatus,
                    ImmutableSet.of(SubscriptionStatus.ACTIVE, SubscriptionStatus.NOPAYMENTMETHOD)
                            .contains(subsStatus));
        });
        return accountAndProject
                .toBuilder()
                .account(accountResource.accountBindAdmin().getAccount())
                .build();
    }

    protected UserMeWithBalance addActiveUser(String projectId, ConfigAdmin configAdmin) throws Exception {
        long newUserNumber = userNumber++;
        UserMeWithBalance user = userResource.userCreate(projectId, UserCreate.builder()
                .name("john-" + newUserNumber)
                .email("john-" + newUserNumber + "@example.com")
                .build())
                .getUser();
        IdeaWithVote idea = ideaResource.ideaCreate(projectId, IdeaCreate.builder()
                .authorUserId(user.getUserId())
                .title("Add dark mode")
                .categoryId(configAdmin.getContent().getCategories().get(0).getCategoryId())
                .tagIds(ImmutableList.of())
                .build());
        return user;
    }

    protected void deleteAccount(AccountAndProject accountAndProject) {
        accountResource.accountDeleteAdmin();
        assertFalse(accountStore.getAccountByEmail(accountAndProject.getAccount().getEmail()).isPresent());
    }

    protected void kbClockReset() throws Exception {
        // https://github.com/killbill/killbill/blob/master/jaxrs/src/main/java/org/killbill/billing/jaxrs/resources/TestResource.java#L170
        Response response = kbClient.doPost("/1.0/kb/test/clock", "", KillBillUtil.roDefault());
        log.info("Reset clock to {}", response.getResponseBody());
    }

    protected void kbClockSleep(long sleepInDays) throws Exception {
        // https://github.com/killbill/killbill/blob/master/jaxrs/src/main/java/org/killbill/billing/jaxrs/resources/TestResource.java#L193
        Response response = kbClient.doPut("/1.0/kb/test/clock?days=" + sleepInDays, "", KillBillUtil.roDefault());
        log.info("Slept for {} days, current clock is {}", sleepInDays, response.getResponseBody());
        refreshStatus();
    }

    protected void resetPaymentPlugin() throws Exception {
        paymentTestPluginConfigure(PaymentTestPluginAction.ACTION_CLEAR, Optional.empty());
    }

    protected void failFuturePayments() throws Exception {
        paymentTestPluginConfigure(PaymentTestPluginAction.ACTION_RETURN_PLUGIN_STATUS_ERROR, Optional.empty());
    }

    protected void paymentTestPluginConfigure(PaymentTestPluginAction configureAction, Optional<Long> sleepTimeInMillisOpt) throws KillBillClientException {
        PaymentTestPluginConfigure props = new PaymentTestPluginConfigure(configureAction, sleepTimeInMillisOpt);
        kbClient.doPost("/plugins/killbill-payment-test/configure", gson.toJson(props), KillBillUtil.roBuilder()
                .withHeader("Content-Type", MediaType.APPLICATION_JSON)
                .build());
    }

    protected AccountAndProject cancelAccount(AccountAndProject accountAndProject) throws Exception {
        AccountAdmin accountAdmin = accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .cancelEndOfTerm(true)
                .build());
        return accountAndProject
                .toBuilder()
                .account(accountAdmin)
                .build();
    }

    protected AccountAndProject resumeAccount(AccountAndProject accountAndProject) throws Exception {
        AccountAdmin accountAdmin = accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .resume(true)
                .build());
        return accountAndProject
                .toBuilder()
                .account(accountAdmin)
                .build();
    }

    protected void refreshStatus() throws Exception {
        String accountId = accountStore.getAccountByEmail(accountResource.accountBindAdmin().getAccount().getEmail()).get().getAccountId();
        refreshStatus(accountId);
    }

    protected void refreshStatus(String accountId) throws Exception {
        UUID accountIdKb = billing.getAccount(accountId).getAccountId();
        killBillResource.webhook(gson.toJson(new KillBillResource.Event(
                ExtBusEventType.SUBSCRIPTION_CHANGE,
                ObjectType.ACCOUNT,
                accountIdKb,
                accountIdKb,
                null)));
        log.info("Account status {}", accountStore.getAccountByAccountId(accountId).get().getStatus());
    }

    protected void dumpDynamoTable() {
        log.info("DynamoScan starting");
        String tableName = dynamoMapper.parseTableSchema(ProjectStore.ProjectModel.class).tableName();
        dynamo.scan(new ScanRequest()
                .withTableName(tableName))
                .getItems()
                .forEach(item -> log.info("DynamoScan: {}", item));
        log.info("DynamoScan finished");
    }

    void assertSubscriptionStatus(SubscriptionStatus status) throws Exception {
        String accountId = accountStore.getAccountByEmail(accountResource.accountBindAdmin().getAccount().getEmail()).get().getAccountId();
        TestUtil.retry(() -> {
            refreshStatus(accountId);
            assertEquals(status, accountResource.accountBindAdmin().getAccount().getSubscriptionStatus());
        });
    }

    void assertPlanid(String planid) throws Exception {
        String accountId = accountStore.getAccountByEmail(accountResource.accountBindAdmin().getAccount().getEmail()).get().getAccountId();
        TestUtil.retry(() -> {
            assertEquals(planid, billing.getSubscription(accountId).getPlanName());
            assertEquals(planid, accountResource.accountBindAdmin().getAccount().getBasePlanId());
        });
    }
}