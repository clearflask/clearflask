// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ScanRequest;
import com.amazonaws.services.dynamodbv2.model.ScanResult;
import com.amazonaws.services.route53.AmazonRoute53;
import com.amazonaws.services.s3.AmazonS3;
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
import com.smotana.clearflask.TestUtil;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.*;
import com.smotana.clearflask.core.ClearFlaskCreditSync;
import com.smotana.clearflask.core.email.AmazonSimpleEmailServiceProvider;
import com.smotana.clearflask.core.image.ImageNormalizationImpl;
import com.smotana.clearflask.core.push.NotificationServiceImpl;
import com.smotana.clearflask.core.push.message.*;
import com.smotana.clearflask.core.push.provider.MockBrowserPushService;
import com.smotana.clearflask.core.push.provider.MockEmailService;
import com.smotana.clearflask.security.CertFetcherImpl;
import com.smotana.clearflask.security.ClearFlaskSso;
import com.smotana.clearflask.security.SimpleEmailValidator;
import com.smotana.clearflask.security.limiter.rate.LocalRateLimiter;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.github.GitHubClientProviderImpl;
import com.smotana.clearflask.store.github.GitHubStoreImpl;
import com.smotana.clearflask.store.impl.*;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.store.s3.DefaultS3ClientProvider;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.*;
import com.smotana.clearflask.web.resource.PaymentTestPluginConfigure.PaymentTestPluginAction;
import com.smotana.clearflask.web.security.*;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import io.dataspray.singletable.SingleTable;
import io.jsonwebtoken.security.Keys;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.grizzly.servlet.HttpServletRequestImpl;
import org.glassfish.grizzly.servlet.HttpServletResponseImpl;
import org.junit.Before;
import org.killbill.billing.ObjectType;
import org.killbill.billing.client.KillBillClientException;
import org.killbill.billing.client.api.gen.AccountApi;
import org.killbill.billing.client.model.Invoices;
import org.killbill.billing.client.model.gen.Invoice;
import org.killbill.billing.invoice.api.InvoiceStatus;
import org.killbill.billing.notification.plugin.api.ExtBusEventType;

import javax.ws.rs.core.MediaType;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

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
    protected ConnectResource connectResource;
    @Inject
    protected IdeaResource ideaResource;
    @Inject
    protected CommentResource commentResource;
    @Inject
    protected VoteResource voteResource;
    @Inject
    protected ContentResource contentResource;
    @Inject
    protected KillBillResource killBillResource;
    @Inject
    protected GitHubResource gitHubResource;
    @Inject
    protected MockExtendedSecurityContext mockExtendedSecurityContext;
    @Inject
    protected AmazonDynamoDB dynamo;
    @Inject
    protected SingleTable singleTable;
    @Inject
    protected AccountStore accountStore;
    @Inject
    protected UserStore userStore;
    @Inject
    protected ProjectStore projectStore;
    @Inject
    protected IdeaStore ideaStore;
    @Inject
    protected AccountApi kbAccount;
    @Inject
    protected Billing billing;
    @Inject
    private AmazonS3 s3;
    @Inject
    protected Gson gson;

    protected long userNumber = 0L;
    protected final String contentUploadBucketName = "mock-" + IdUtil.randomId();

    @Override
    protected void configure() {
        super.configure();

        ControllableSleepingStopwatch controllableSleepingStopwatch = new ControllableSleepingStopwatch();
        install(GuavaRateLimiters.testModule(controllableSleepingStopwatch));
        bind(ControllableSleepingStopwatch.class).toInstance(controllableSleepingStopwatch);
        bindMock(AmazonRoute53.class);

        install(Modules.override(
                MockExtendedSecurityContext.module(),
                ClearFlaskSso.module(),
                HealthResource.module(),
                TestResource.module(),
                UserResource.module(),
                AccountResource.module(),
                IdeaResource.module(),
                VoteResource.module(),
                ProjectResource.module(),
                SupportResource.module(),
                ConnectResource.module(),
                ContentResource.module(),
                CommentResource.module(),
                CreditResource.module(),
                CertFetcherImpl.module(),
                NotificationResource.module(),
                LlmResource.module(),
                KillBillResource.module(),
                GitHubResource.module(),
                GitHubStoreImpl.module(),
                MarkdownAndQuillUtil.module(),
                GitHubClientProviderImpl.module(),
                AmazonSimpleEmailServiceProvider.module(),
                ClearFlaskCreditSync.module(),
                KillBillSync.module(),
                StripeClientSetup.module(),
                KillBilling.module(),
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                NotificationServiceImpl.module(),
                EmailTemplates.module(),
                OnCreditChange.module(),
                WebhookServiceImpl.module(),
                OnCommentReply.module(),
                OnStatusOrResponseChange.module(),
                OnTrialEnded.module(),
                OnPaymentFailed.module(),
                OnInvoicePaymentSuccess.module(),
                OnForgotPassword.module(),
                OnAccountSignup.module(),
                OnTeammateInvite.module(),
                IntercomUtil.module(),
                ChatwootUtil.module(),
                OnModInvite.module(),
                OnEmailChanged.module(),
                OnDigest.module(),
                EmailVerify.module(),
                EmailLogin.module(),
                MockBrowserPushService.module(),
                MockEmailService.module(),
                LocalRateLimiter.module(),
                ResourceLegalStore.module(),
                CommonPlanVerifyStore.module(),
                KillBillPlanStore.module(),
                SuperAdminPredicate.module(),
                DynamoElasticCommentStore.module(),
                DynamoElasticAccountStore.module(),
                DynamoNotificationStore.module(),
                DynamoDraftStore.module(),
                DynamoElasticIdeaStore.module(),
                DynamoProjectStore.module(),
                DynamoCouponStore.module(),
                ProjectUpgraderImpl.module(),
                DynamoElasticUserStore.module(),
                DynamoTokenVerifyStore.module(),
                DynamoVoteStore.module(),
                DynamoCertStore.module(),
                DynamoRemoteLicenseStore.module(),
                CloudLocalLicenseStore.module(),
                S3ContentStore.module(),
                DefaultS3ClientProvider.module(),
                ImageNormalizationImpl.module(),
                MockAuthCookie.module(),
                UserBindUtil.module(),
                MysqlUtil.module(),
                ElasticUtil.module(),
                Sanitizer.module(),
                SimpleEmailValidator.module(),
                DefaultServerSecret.module(Names.named("cursor"))
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(KillBilling.Config.class, om -> {
                    om.override(om.id().reuseDraftInvoices()).withValue(false);
                }));
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(AccountResource.Config.class, om -> {
                    om.override(om.id().enableNonPublicPlans()).withValue(Boolean.TRUE);
                }));
                install(ConfigSystem.overrideModule(CertFetcherImpl.Config.class, om -> {
                    om.override(om.id().enabled()).withValue(Boolean.FALSE);
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
                    // These slow down the system
                    om.override(om.id().uploadAnalyticsReports()).withValue(false);
                }));
                install(ConfigSystem.overrideModule(KillBillResource.Config.class, om -> {
                    om.override(om.id().registerWebhookOnStartup()).withValue(false);
                }));
                install(ConfigSystem.overrideModule(S3ContentStore.Config.class, om -> {
                    om.override(om.id().hostname()).withValue(contentUploadBucketName + ".s3.localhost.localstack.cloud:4566");
                    om.override(om.id().bucketName()).withValue(contentUploadBucketName);
                }));
                install(ConfigSystem.overrideModule(AmazonSimpleEmailServiceProvider.Config.class, om -> {
                    om.override(om.id().serviceEndpoint()).withValue("http://localhost:4566");
                }));
                install(ConfigSystem.overrideModule(DefaultS3ClientProvider.Config.class, om -> {
                    om.override(om.id().serviceEndpoint()).withValue("http://s3.localhost.localstack.cloud:4566");
                    om.override(om.id().signingRegion()).withValue("us-east-1");
                    om.override(om.id().dnsResolverTo()).withValue("localhost");
                }));
            }
        }));
    }

    @Before
    public void setup() throws Exception {
        super.setup();
        HttpServletRequestImpl request = HttpServletRequestImpl.create();
        HttpServletResponseImpl response = HttpServletResponseImpl.create();
        ImmutableSet.of(
                accountResource,
                projectResource,
                userResource,
                ideaResource,
                commentResource,
                voteResource,
                contentResource
        ).forEach(resource -> {
            resource.securityContext = mockExtendedSecurityContext;
            resource.request = request;
            resource.response = response;
        });

        kbClockReset();
        resetPaymentPlugin();

        s3.createBucket(contentUploadBucketName);
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    protected static class AccountAndProject {
        AccountAdmin account;
        NewProjectResult project;
    }

    protected AccountAndProject getTrialAccount() throws Exception {
        return getTrialAccount("flat-yearly");
    }

    protected AccountAndProject getTrialAccount(String planid) throws Exception {
        AccountAdmin accountAdmin = accountResource.accountSignupAdmin(new AccountSignupAdmin(
                "smotana",
                IdUtil.randomId(5) + "unittest@clearflask.com",
                "password",
                planid,
                null,
                null,
                null));
        NewProjectResult newProjectResult = projectResource.projectCreateAdmin(
                ModelUtil.createEmptyConfig("myproject").getConfig());
        AccountAndProject accountAndProject = new AccountAndProject(accountAdmin, newProjectResult);
        finalizeInvoices(accountAndProject);
        assertSubscriptionStatus(SubscriptionStatus.ACTIVETRIAL);
        return accountAndProject;
    }

    protected AccountAndProject changePlan(AccountAndProject accountAndProject, String planId) throws Exception {
        AccountAdmin accountAdmin = accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .basePlanId(planId)
                .build());
        finalizeInvoices(accountAndProject);
        return accountAndProject.toBuilder().account(accountAdmin).build();
    }

    protected AccountAndProject changePlanToFlat(AccountAndProject accountAndProject, long yearlyPrice) throws Exception {
        AccountAdmin accountAdmin = accountResource.accountUpdateSuperAdmin(AccountUpdateSuperAdmin.builder()
                .changeToFlatPlanWithYearlyPrice(yearlyPrice)
                .build());
        finalizeInvoices(accountAndProject);
        return accountAndProject.toBuilder().account(accountAdmin).build();
    }

    protected AccountAndProject getActiveAccount() throws Exception {
        return getActiveAccount("flat-yearly");
    }

    protected AccountAndProject getActiveAccount(String planid) throws Exception {
        AccountAndProject accountAndProject = getTrialAccount(planid);
        accountAndProject = addPaymentMethod(accountAndProject);
        kbClockSleepAndRefresh(30, accountAndProject);
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

    protected void addTrackedUsers(AccountAndProject accountAndProject, long amount) throws Exception {
        userStore.updateUserCountForProject(accountAndProject.getProject().getProjectId(), amount);
    }

    protected void addTeammates(AccountAndProject accountAndProject, long amount) throws Exception {
        for (int i = 0; i < amount; i++) {
            projectStore.addAdmin(accountAndProject.getProject().getProjectId(), IdUtil.randomId());
        }
    }

    protected void deleteAccount(AccountAndProject accountAndProject) {
        accountResource.accountDeleteAdmin();
        assertFalse(accountStore.getAccountByEmail(accountAndProject.getAccount().getEmail()).isPresent());
    }

    protected void kbClockReset() throws Exception {
        // https://github.com/killbill/killbill/blob/master/jaxrs/src/main/java/org/killbill/billing/jaxrs/resources/TestResource.java#L170
        var response = kbClient.doPost("/1.0/kb/test/clock", "", KillBillUtil.roDefault());
        log.info("Reset clock to {}", response.getResponseBody());
    }

    protected void kbClockSleepAndRefresh(long sleepInDays, AccountAndProject accountAndProject) throws Exception {
        kbClockSleep(sleepInDays);
        refreshStatus(accountAndProject.getAccount().getAccountId());
        finalizeInvoices(accountAndProject);
    }

    protected void kbClockSleep(long sleepInDays) throws Exception {
        // https://github.com/killbill/killbill/blob/master/jaxrs/src/main/java/org/killbill/billing/jaxrs/resources/TestResource.java#L193
        var response = kbClient.doPut("/1.0/kb/test/clock?days=" + sleepInDays, "", KillBillUtil.roDefault());
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
        finalizeInvoices(accountAndProject);
        return accountAndProject
                .toBuilder()
                .account(accountAdmin)
                .build();
    }

    protected AccountAndProject resumeAccount(AccountAndProject accountAndProject) throws Exception {
        AccountAdmin accountAdmin = accountResource.accountUpdateAdmin(AccountUpdateAdmin.builder()
                .resume(true)
                .build());
        finalizeInvoices(accountAndProject);
        return accountAndProject
                .toBuilder()
                .account(accountAdmin)
                .build();
    }

    protected void refreshStatus() throws Exception {
        String accountId = accountStore.getAccountByEmail(accountResource.accountBindAdmin(new AccountBindAdmin(null)).getAccount().getEmail()).get().getAccountId();
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
        log.info("Account status {}", accountStore.getAccount(accountId, false).get().getStatus());
    }

    protected void waitForInvoice(AccountAndProject accountAndProject) throws Exception {
        waitForInvoices(accountAndProject, 1L);
    }

    protected void waitForInvoices(AccountAndProject accountAndProject, long expectedAmount) throws Exception {
        AtomicLong actualAmount = new AtomicLong();
        TestUtil.retry(() -> {
            assertEquals(expectedAmount, actualAmount.addAndGet(finalizeInvoices(accountAndProject)));
        });
    }

    private long finalizeInvoices(AccountAndProject accountAndProject) throws Exception {
        UUID accountIdKb = billing.getAccount(accountAndProject.getAccount().getAccountId()).getAccountId();
        Invoices invoices = kbAccount.getInvoicesForAccount(
                accountIdKb,
                null,
                null,
                false,
                false,
                false,
                null,
                null,
                KillBillUtil.roDefault());
        long invoicesCommitted = 0L;
        for (Invoice invoice : invoices) {
            if (InvoiceStatus.DRAFT.equals(invoice.getStatus())) {
                killBillResource.webhook(gson.toJson(new KillBillResource.Event(
                        ExtBusEventType.INVOICE_CREATION,
                        ObjectType.INVOICE,
                        invoice.getInvoiceId(),
                        invoice.getAccountId(),
                        null)));
                invoicesCommitted++;
            }
        }
        return invoicesCommitted;
    }

    protected void dumpDynamoTable() {
        log.info("DynamoScan starting");
        String tableName = singleTable.parseTableSchema(ProjectStore.ProjectModel.class).tableName();
        Map<String, AttributeValue> exclusiveStartKey = null;
        do {
            ScanResult result = dynamo.scan(new ScanRequest()
                    .withTableName(tableName)
                    .withExclusiveStartKey(exclusiveStartKey));
            exclusiveStartKey = result.getLastEvaluatedKey();
            result.getItems().forEach(item -> log.info("DynamoScan: {}", item));
        } while (exclusiveStartKey != null && !exclusiveStartKey.isEmpty());
        log.info("DynamoScan finished");
    }

    void assertInvoices(AccountAndProject accountAndProject, ImmutableList<Double> invoiceAmountsExpected) throws Exception {
        Invoices invoicesKb = kbAccount.getInvoicesForAccount(
                billing.getAccount(accountAndProject.getAccount().getAccountId()).getAccountId(),
                null,
                null,
                false,
                false,
                true,
                null,
                null,
                KillBillUtil.roDefault());
        log.info("KB invoices:\n{}", invoicesKb);

        assertEquals("Uncommitted invoices", 0L, invoicesKb.stream()
                .filter(i -> InvoiceStatus.DRAFT.equals(i.getStatus()))
                .count());

        ImmutableList<Double> invoiceAmountsActual = invoicesKb.stream()
                .sorted(Comparator.comparingLong(i -> i.getTargetDate().toDate().toInstant().getEpochSecond()))
                .map(i -> i.getAmount().doubleValue())
                .collect(ImmutableList.toImmutableList());
        assertEquals(invoiceAmountsExpected, invoiceAmountsActual);
    }

    void assertSubscriptionStatus(SubscriptionStatus status) throws Exception {
        String accountId = accountStore.getAccountByEmail(accountResource.accountBindAdmin(new AccountBindAdmin(null)).getAccount().getEmail()).get().getAccountId();
        TestUtil.retry(() -> {
            refreshStatus(accountId);
            assertEquals(status, accountResource.accountBindAdmin(new AccountBindAdmin(null)).getAccount().getSubscriptionStatus());
        });
    }

    void assertPlanid(String planid) throws Exception {
        String accountId = accountStore.getAccountByEmail(accountResource.accountBindAdmin(new AccountBindAdmin(null)).getAccount().getEmail()).get().getAccountId();
        TestUtil.retry(() -> {
            assertEquals(planid, billing.getSubscription(accountId).getPlanName());
            assertEquals(planid, accountResource.accountBindAdmin(new AccountBindAdmin(null)).getAccount().getBasePlanId());
        });
    }
}
