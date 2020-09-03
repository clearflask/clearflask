package com.smotana.clearflask.core.push;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ControllableSleepingStopwatch;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.inject.Inject;
import com.smotana.clearflask.api.model.TransactionType;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.core.push.message.*;
import com.smotana.clearflask.core.push.provider.BrowserPushService.BrowserPush;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.core.push.provider.MockBrowserPushService;
import com.smotana.clearflask.core.push.provider.MockEmailService;
import com.smotana.clearflask.core.push.provider.MockNotificationStore;
import com.smotana.clearflask.security.limiter.rate.LocalRateLimiter;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.MockModelUtil;
import com.smotana.clearflask.store.NotificationStore.NotificationModel;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.ExpressModel;
import com.smotana.clearflask.store.VoteStore.FundModel;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.store.VoteStore.VoteModel;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ModelUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Base64Encoder;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.spec.ECNamedCurveParameterSpec;
import org.junit.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.util.Optional;

import static com.smotana.clearflask.testutil.DraftjsUtil.textToMockDraftjs;
import static nl.martijndwars.webpush.Utils.ALGORITHM;
import static nl.martijndwars.webpush.Utils.CURVE;
import static org.bouncycastle.jce.provider.BouncyCastleProvider.PROVIDER_NAME;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@Slf4j
public class NotificationServiceTest extends AbstractTest {

    @Inject
    private NotificationService service;
    @Inject
    private MockEmailService mockEmailService;
    @Inject
    private MockBrowserPushService mockBrowserPushService;
    @Inject
    private VoteStore mockVoteStore;
    @Inject
    private UserStore mockUserStore;
    @Inject
    private MockNotificationStore mockNotificationStore;

    @Override
    protected void configure() {
        super.configure();

        bind(AWSCredentialsProvider.class).toInstance(new AWSStaticCredentialsProvider(new BasicAWSCredentials("", "")));

        bindMock(VoteStore.class);
        bindMock(UserStore.class);

        install(Application.module());
        install(NotificationServiceImpl.module());
        install(EmailTemplates.module());
        install(OnCommentReply.module());
        install(OnStatusOrResponseChange.module());
        install(OnCreditChange.module());
        install(OnForgotPassword.module());
        install(OnAdminInvite.module());
        install(OnEmailChanged.module());
        install(EmailVerify.module());

        install(MockBrowserPushService.module());
        install(MockEmailService.module());
        install(MockNotificationStore.module());
        install(LocalRateLimiter.module());
        ControllableSleepingStopwatch controllableSleepingStopwatch = new ControllableSleepingStopwatch();
        install(GuavaRateLimiters.testModule(controllableSleepingStopwatch));
        bind(ControllableSleepingStopwatch.class).toInstance(controllableSleepingStopwatch);
    }

    @Test(timeout = 10_000L)
    public void testOnStatusOrResponseChanged() throws Exception {
        String projectId = "myProject";
        VersionedConfigAdmin versionedConfigAdmin = ModelUtil.createEmptyConfig(projectId);
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .statusId(versionedConfigAdmin.getConfig().getContent().getCategories().get(0).getWorkflow().getStatuses().get(0).getStatusId())
                .response(textToMockDraftjs("My response"))
                .categoryId(versionedConfigAdmin.getConfig().getContent().getCategories().get(0).getCategoryId())
                .fundersCount(3L).funded(300L)
                .votersCount(4L).voteValue(2L)
                .expressions(ImmutableMap.of("😘", 4L)).expressionsValue(3.4d)
                .build();
        UserModel user = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .userId(IdUtil.randomId())
                .email("user@email.com")
                .emailNotify(true)
                .browserPushToken("browserPushToken")
                .build();
        when(this.mockVoteStore.expressListByTarget(any(), any(), any())).thenReturn(new VoteStore.ListResponse<>(ImmutableList.of(ExpressModel.builder()
                .userId(user.getUserId())
                .projectId(projectId)
                .targetId(idea.getIdeaId())
                .expressions(ImmutableSet.of())
                .build()), Optional.empty()));
        when(this.mockVoteStore.fundListByTarget(any(), any(), any())).thenReturn(new VoteStore.ListResponse<>(ImmutableList.of(FundModel.builder()
                .userId(user.getUserId())
                .projectId(projectId)
                .targetId(idea.getIdeaId())
                .fundAmount(400L)
                .build()), Optional.empty()));
        when(this.mockVoteStore.voteListByTarget(any(), any(), any())).thenReturn(new VoteStore.ListResponse<>(ImmutableList.of(VoteModel.builder()
                .userId(user.getUserId())
                .projectId(projectId)
                .targetId(idea.getIdeaId())
                .vote(1)
                .build()), Optional.empty()));
        when(this.mockUserStore.getUsers(any(), any())).thenReturn(ImmutableMap.of(user.getUserId(), user));
        when(this.mockUserStore.createToken(any(), any(), any())).thenReturn("myAuthToken");

        service.onStatusOrResponseChanged(
                versionedConfigAdmin.getConfig(),
                idea,
                true,
                true);

        Email email = mockEmailService.sent.take();
        BrowserPush push = mockBrowserPushService.sent.take();
        NotificationModel inApp = mockNotificationStore.sent.take();
        log.info("email {}", email);
        log.info("push {}", push);
        log.info("inApp {}", inApp);
        assertNotNull(email);
        assertFalse(email.getSubject().contains("__"));
        assertFalse(email.getContentHtml().contains("__"));
        assertFalse(email.getContentText().contains("__"));
        assertNotNull(push);
        assertFalse(push.getTitle().contains("__"));
        assertFalse(push.getBody().contains("__"));
        assertNotNull(inApp);
        assertFalse(inApp.getDescription().contains("__"));
    }

    @Test(timeout = 10_000L)
    public void testOnCommentReply() throws Exception {
        String projectId = "myProject";
        VersionedConfigAdmin versionedConfigAdmin = ModelUtil.createEmptyConfig(projectId);
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .statusId(versionedConfigAdmin.getConfig().getContent().getCategories().get(0).getWorkflow().getStatuses().get(0).getStatusId())
                .response(textToMockDraftjs("My response"))
                .categoryId(versionedConfigAdmin.getConfig().getContent().getCategories().get(0).getCategoryId())
                .fundersCount(3L).funded(300L)
                .votersCount(4L).voteValue(2L)
                .expressions(ImmutableMap.of("😘", 4L)).expressionsValue(3.4d)
                .build();
        UserModel user = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .userId(IdUtil.randomId())
                .email("user@email.com")
                .emailNotify(true)
                .browserPushToken("browserPushToken")
                .build();
        UserModel sender = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .userId(IdUtil.randomId())
                .email("sender@email.com")
                .emailNotify(true)
                .browserPushToken("browserPushToken")
                .build();
        CommentStore.CommentModel parentComment = MockModelUtil.getRandomComment().toBuilder()
                .projectId(projectId)
                .ideaId(idea.getIdeaId())
                .authorUserId(user.getUserId())
                .build();
        CommentStore.CommentModel comment = MockModelUtil.getRandomComment().toBuilder()
                .projectId(projectId)
                .ideaId(idea.getIdeaId())
                .authorUserId(sender.getUserId())
                .build();
        when(this.mockUserStore.getUser(any(), any())).thenReturn(Optional.of(user));
        when(this.mockUserStore.createToken(any(), any(), any())).thenReturn("myAuthToken");

        service.onCommentReply(
                versionedConfigAdmin.getConfig(),
                idea,
                Optional.of(parentComment),
                comment,
                sender);

        Email email = mockEmailService.sent.take();
        BrowserPush push = mockBrowserPushService.sent.take();
        NotificationModel inApp = mockNotificationStore.sent.take();
        log.info("email {}", email);
        log.info("push {}", push);
        log.info("inApp {}", inApp);
        assertNotNull(email);
        assertFalse(email.getSubject().contains("__"));
        assertFalse(email.getContentHtml().contains("__"));
        assertFalse(email.getContentText().contains("__"));
        assertNotNull(push);
        assertFalse(push.getTitle().contains("__"));
        assertFalse(push.getBody().contains("__"));
        assertNotNull(inApp);
        assertFalse(inApp.getDescription().contains("__"));
    }

    @Test(timeout = 10_000L)
    public void testOnCreditChange() throws Exception {
        String projectId = "myProject";
        VersionedConfigAdmin versionedConfigAdmin = ModelUtil.createEmptyConfig(projectId);
        UserModel user = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .userId(IdUtil.randomId())
                .email("user@email.com")
                .emailNotify(true)
                .browserPushToken("browserPushToken")
                .build();
        TransactionModel transaction = MockModelUtil.getRandomTransaction().toBuilder()
                .transactionType(TransactionType.INCOME.name())
                .userId(user.getUserId())
                .targetId(null)
                .build();
        when(this.mockUserStore.createToken(any(), any(), any())).thenReturn("myAuthToken");

        service.onCreditChanged(
                versionedConfigAdmin.getConfig(),
                user,
                transaction);

        Email email = mockEmailService.sent.take();
        BrowserPush push = mockBrowserPushService.sent.take();
        NotificationModel inApp = mockNotificationStore.sent.take();
        log.info("email {}", email);
        log.info("push {}", push);
        log.info("inApp {}", inApp);
        assertNotNull(email);
        assertFalse(email.getSubject().contains("__"));
        assertFalse(email.getContentHtml().contains("__"));
        assertFalse(email.getContentText().contains("__"));
        assertNotNull(push);
        assertFalse(push.getTitle().contains("__"));
        assertFalse(push.getBody().contains("__"));
        assertNotNull(inApp);
        assertFalse(inApp.getDescription().contains("__"));
    }

    @Test(timeout = 10_000L)
    public void testOnForgotPassword() throws Exception {
        String projectId = "myProject";
        VersionedConfigAdmin versionedConfigAdmin = ModelUtil.createEmptyConfig(projectId);
        UserModel user = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .userId(IdUtil.randomId())
                .email("user@email.com")
                .emailNotify(true)
                .browserPushToken("browserPushToken")
                .build();
        when(this.mockUserStore.getUser(any(), any())).thenReturn(Optional.of(user));
        when(this.mockUserStore.createToken(any(), any(), any())).thenReturn("myAuthToken");

        service.onForgotPassword(
                versionedConfigAdmin.getConfig(),
                user);

        Email email = mockEmailService.sent.take();
        log.info("email {}", email);
        assertNotNull(email);
        assertFalse(email.getSubject().contains("__"));
        assertFalse(email.getContentHtml().contains("__"));
        assertFalse(email.getContentText().contains("__"));
    }

    @Test(timeout = 10_000L)
    public void testOnAdminInvite() throws Exception {
        String projectId = "myProject";
        VersionedConfigAdmin versionedConfigAdmin = ModelUtil.createEmptyConfig(projectId);
        UserModel user = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .isMod(true)
                .userId(IdUtil.randomId())
                .email("user@email.com")
                .emailNotify(true)
                .build();
        when(this.mockUserStore.getUser(any(), any())).thenReturn(Optional.of(user));
        when(this.mockUserStore.createToken(any(), any(), any())).thenReturn("myAuthToken");

        service.onAdminInvite(
                versionedConfigAdmin.getConfig(),
                user);

        Email email = mockEmailService.sent.take();
        log.info("email {}", email);
        assertNotNull(email);
        assertFalse(email.getSubject().contains("__"));
        assertFalse(email.getContentHtml().contains("__"));
        assertFalse(email.getContentText().contains("__"));
    }

    @Test(timeout = 10_000L)
    public void testOnEmailChanged() throws Exception {
        String projectId = "myProject";
        VersionedConfigAdmin versionedConfigAdmin = ModelUtil.createEmptyConfig(projectId);
        UserModel user = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .isMod(true)
                .userId(IdUtil.randomId())
                .email("user@email.com")
                .emailNotify(true)
                .build();
        when(this.mockUserStore.getUser(any(), any())).thenReturn(Optional.of(user));
        when(this.mockUserStore.createToken(any(), any(), any())).thenReturn("myAuthToken");

        service.onEmailChanged(
                versionedConfigAdmin.getConfig(),
                user,
                "oldEmail@email.com");

        Email email = mockEmailService.sent.take();
        log.info("email {}", email);
        assertNotNull(email);
        assertFalse(email.getSubject().contains("__"));
        assertFalse(email.getContentHtml().contains("__"));
        assertFalse(email.getContentText().contains("__"));
    }

    private KeyPair generateKeyPair() {
        try {
            Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());

            ECNamedCurveParameterSpec parameterSpec = ECNamedCurveTable.getParameterSpec(CURVE);

            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance(ALGORITHM, PROVIDER_NAME);
            keyPairGenerator.initialize(parameterSpec);

            return keyPairGenerator.generateKeyPair();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    private String encodePublicKey(KeyPair keyPair) {
        return Base64Encoder.encodeUrl(Utils.encode((ECPublicKey) keyPair.getPublic()));
    }

    private String encodePrivateKey(KeyPair keyPair) {
        return Base64Encoder.encodeUrl(Utils.encode((ECPrivateKey) keyPair.getPrivate()));
    }
}