// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push;

import com.google.common.base.Predicates;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.ListeningExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.IdeaStatus;
import com.smotana.clearflask.api.model.NotifySubscribers;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.push.message.*;
import com.smotana.clearflask.core.push.message.OnCommentReply.AuthorType;
import com.smotana.clearflask.core.push.message.OnStatusOrResponseChange.SubscriptionAction;
import com.smotana.clearflask.core.push.provider.BrowserPushService;
import com.smotana.clearflask.core.push.provider.EmailService;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.NotificationStore;
import com.smotana.clearflask.store.NotificationStore.NotificationModel;
import com.smotana.clearflask.store.ProjectStore.InvitationModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.ListResponse;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;

import static com.google.common.base.Preconditions.checkArgument;
import static com.google.common.base.Preconditions.checkState;
import static com.smotana.clearflask.core.push.message.OnStatusOrResponseChange.SubscriptionAction.*;

@Slf4j
@Singleton
public class NotificationServiceImpl extends ManagedService implements NotificationService {
    /**
     * If changed, also change in App.tsx
     */
    public static final String AUTH_TOKEN_PARAM_NAME = "authToken";
    /**
     * If changed, also change in App.tsx
     */
    public static final String SSO_TOKEN_PARAM_NAME = "token";

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("P90D")
        Duration notificationExpiry();

        @DefaultValue("P7D")
        Duration autoLoginExpiry();

        @DefaultValue("false")
        boolean notifyPaymentFailedBecauseNoPaymentMethod();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailService emailService;
    @Inject
    private BrowserPushService browserPushService;
    @Inject
    private NotificationStore notificationStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private UserStore userStore;
    @Inject
    private OnCommentReply onCommentReply;
    @Inject
    private OnTrialEnding onTrialEnding;
    @Inject
    private OnTrialEnded onTrialEnded;
    @Inject
    private OnAccountSignup accountSignup;
    @Inject
    private OnInvoicePaymentSuccess onInvoicePaymentSuccess;
    @Inject
    private OnPaymentFailed onPaymentFailed;
    @Inject
    private OnCreditChange onCreditChange;
    @Inject
    private OnStatusOrResponseChange onStatusOrResponseChange;
    @Inject
    private OnForgotPassword onForgotPassword;
    @Inject
    private OnAdminForgotPassword onAdminForgotPassword;
    @Inject
    private OnModInvite onModInvite;
    @Inject
    private OnTeammateInvite onTeammateInvite;
    @Inject
    private OnEmailChanged onEmailChanged;
    @Inject
    private OnPostCreated onPostCreated;
    @Inject
    private OnPostCreatedOnBehalfOf onPostCreatedOnBehalfOf;
    @Inject
    private EmailVerify emailVerify;
    @Inject
    private EmailLogin emailLogin;
    @Inject
    private Sanitizer sanitizer;
    @Inject
    private OnDigest onDigest;
    @Inject
    private OnProjectDeletionImminent onProjectDeletionImminent;

    private ListeningExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        executor = MoreExecutors.listeningDecorator(new ThreadPoolExecutor(
                2, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS, new SynchronousQueue<>(),
                new ThreadFactoryBuilder().setNameFormat("NotificationServiceImpl-worker-%d").build()));
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
    }

    @Override
    public void onStatusOrResponseChanged(ConfigAdmin configAdmin, IdeaModel idea, boolean statusChanged, boolean responseChanged, Optional<UserModel> senderOpt) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            checkArgument(statusChanged || responseChanged);

            Optional<IdeaStatus> changedStatus;
            if (statusChanged) {
                IdeaStatus status = configAdmin.getContent()
                        .getCategories()
                        .stream()
                        .filter(c -> idea.getCategoryId().equals(c.getCategoryId()))
                        .findAny()
                        .orElseThrow(IllegalStateException::new)
                        .getWorkflow()
                        .getStatuses()
                        .stream()
                        .filter(s -> idea.getStatusId().equals(s.getStatusId()))
                        .findAny()
                        .orElseThrow(IllegalStateException::new);
                changedStatus = Optional.of(status);
            } else {
                changedStatus = Optional.empty();
            }

            Optional<String> changedResponse;
            if (responseChanged) {
                checkState(idea.hasResponse());
                changedResponse = Optional.of(idea.getResponseAsText(sanitizer));
            } else {
                changedResponse = Optional.empty();
            }

            String link = "https://" + Project.getHostname(configAdmin, configApp) + "/post/" + idea.getIdeaId();

            Set<String> userSeen = Sets.newHashSet();
            BiConsumer<SubscriptionAction, UserModel> sendToUser = (subscriptionAction, user) -> {
                if (!userSeen.add(user.getUserId())) {
                    return;
                }

                try {
                    notificationStore.notificationCreate(new NotificationModel(
                            idea.getProjectId(),
                            user.getUserId(),
                            notificationStore.genNotificationId(),
                            idea.getIdeaId(),
                            null,
                            Instant.now(),
                            Instant.now().plus(config.notificationExpiry()).getEpochSecond(),
                            onStatusOrResponseChange.inAppDescription(
                                    user, idea, configAdmin, subscriptionAction,
                                    link, changedStatus, changedResponse)));
                } catch (Exception ex) {
                    log.warn("Failed to send in-app notification", ex);
                }
                Optional<String> authTokenOpt = Optional.empty();
                try {
                    if (user.isEmailNotify() && !Strings.isNullOrEmpty(user.getEmail())) {
                        if (!authTokenOpt.isPresent()) {
                            authTokenOpt = Optional.of(userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry()));
                        }
                        emailService.send(onStatusOrResponseChange.email(
                                user, idea, configAdmin, subscriptionAction,
                                link, changedStatus, changedResponse, authTokenOpt.get()));
                    }
                } catch (Exception ex) {
                    log.warn("Failed to send email notification", ex);
                }
                try {
                    if (!Strings.isNullOrEmpty(user.getBrowserPushToken())) {
                        if (!authTokenOpt.isPresent()) {
                            authTokenOpt = Optional.of(userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry()));
                        }
                        browserPushService.send(onStatusOrResponseChange.browserPush(
                                user, idea, configAdmin, subscriptionAction,
                                link, changedStatus, changedResponse, authTokenOpt.get()));
                    }
                } catch (Exception ex) {
                    log.warn("Failed to send browser push notification", ex);
                }
            };
            Subscribers subscribers = getSubscribers(idea, senderOpt);
            subscribers.usersExpressed.forEach(user -> sendToUser.accept(EXPRESSED, user));
            subscribers.usersFunded.forEach(user -> sendToUser.accept(FUNDED, user));
            subscribers.usersVoted.forEach(user -> sendToUser.accept(VOTED, user));
        });
    }

    @Override
    public void onCreditChanged(ConfigAdmin configAdmin, UserModel user, TransactionModel transaction) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + Project.getHostname(configAdmin, configApp) + "/transaction";

            try {
                notificationStore.notificationCreate(new NotificationModel(
                        transaction.getProjectId(),
                        user.getUserId(),
                        notificationStore.genNotificationId(),
                        null,
                        null,
                        transaction.getCreated(),
                        Instant.now().plus(config.notificationExpiry()).getEpochSecond(),
                        onCreditChange.inAppDescription(configAdmin, user, transaction)));
            } catch (Exception ex) {
                log.warn("Failed to send in-app notification", ex);
            }
            Optional<String> authTokenOpt = Optional.empty();
            try {
                if (user.isEmailNotify() && !Strings.isNullOrEmpty(user.getEmail())) {
                    if (!authTokenOpt.isPresent()) {
                        authTokenOpt = Optional.of(userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry()));
                    }
                    emailService.send(onCreditChange.email(configAdmin, user, transaction, link, authTokenOpt.get()));
                }
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
            try {
                if (!Strings.isNullOrEmpty(user.getBrowserPushToken())) {
                    if (!authTokenOpt.isPresent()) {
                        authTokenOpt = Optional.of(userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry()));
                    }
                    browserPushService.send(onCreditChange.browserPush(configAdmin, user, transaction, link, authTokenOpt.get()));
                }
            } catch (Exception ex) {
                log.warn("Failed to send browser push notification", ex);
            }
        });
    }

    @Override
    public void onCommentReply(ConfigAdmin configAdmin, IdeaModel idea, Optional<CommentModel> parentCommentOpt, CommentModel comment, UserModel sender) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        String userId = parentCommentOpt.isPresent()
                ? parentCommentOpt.get().getAuthorUserId()
                : idea.getAuthorUserId();
        if (userId == null) {
            log.trace("Not sending notification, parent comment is deleted");
            return;
        }
        if (sender.getUserId().equals(userId)) {
            log.trace("Not sending notification, user is replying to self");
            return;
        }
        submit(() -> {
            String link = "https://" + Project.getHostname(configAdmin, configApp) + "/post/" + idea.getIdeaId() + "/comment/" + comment.getCommentId();

            Optional<UserModel> userOpt = userStore.getUser(idea.getProjectId(), userId);
            if (!userOpt.isPresent()) {
                log.debug("Cannot send comment notification, user disappeared {} commentId {}",
                        userId, comment.getCommentId());
                return;
            }
            UserModel user = userOpt.get();
            AuthorType userAuthorType = parentCommentOpt.isPresent()
                    ? AuthorType.COMMENT_REPLY
                    : AuthorType.IDEA_REPLY;

            try {
                notificationStore.notificationCreate(new NotificationModel(
                        idea.getProjectId(),
                        user.getUserId(),
                        notificationStore.genNotificationId(),
                        idea.getIdeaId(),
                        comment.getCommentId(),
                        Instant.now(),
                        Instant.now().plus(config.notificationExpiry()).getEpochSecond(),
                        onCommentReply.inAppDescription(user, userAuthorType, sender, idea, comment, link)));
            } catch (Exception ex) {
                log.warn("Failed to send in-app notification", ex);
            }
            Optional<String> authTokenOpt = Optional.empty();
            try {
                if (user.isEmailNotify() && !Strings.isNullOrEmpty(user.getEmail())) {
                    if (!authTokenOpt.isPresent()) {
                        authTokenOpt = Optional.of(userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry()));
                    }
                    emailService.send(onCommentReply.email(user, userAuthorType, sender, idea, comment, configAdmin, link, authTokenOpt.get()));
                }
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
            try {
                if (!Strings.isNullOrEmpty(user.getBrowserPushToken())) {
                    if (!authTokenOpt.isPresent()) {
                        authTokenOpt = Optional.of(userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry()));
                    }
                    browserPushService.send(onCommentReply.browserPush(user, userAuthorType, sender, idea, comment, link, authTokenOpt.get()));
                }
            } catch (Exception ex) {
                log.warn("Failed to send browser push notification", ex);
            }
        });
    }

    @Override
    public void onForgotPassword(ConfigAdmin configAdmin, UserModel user) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + Project.getHostname(configAdmin, configApp) + "/account";
            checkState(!Strings.isNullOrEmpty(user.getEmail()));

            String authToken = userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry());

            try {
                emailService.send(onForgotPassword.email(configAdmin, user, link, authToken));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    @Override
    public void onTrialEnding(Account account, Instant trialEnd) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + configApp.domain() + "/dashboard/billing";
            checkState(!Strings.isNullOrEmpty(account.getEmail()));

            try {
                emailService.send(onTrialEnding.email(account, link, trialEnd));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    @Override
    public void onTrialEnded(Account account, boolean hasPaymentMethod) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + configApp.domain() + "/dashboard";
            if (!hasPaymentMethod) {
                link += "/billing";
            }
            checkState(!Strings.isNullOrEmpty(account.getEmail()));

            try {
                emailService.send(onTrialEnded.email(account, link, hasPaymentMethod));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    @Override
    public void onInvoicePaymentSuccess(String accountId, String accountEmail, String invoiceIdStr, boolean isCardExpiringSoon) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + configApp.domain() + "/invoice/" + invoiceIdStr;
            checkState(!Strings.isNullOrEmpty(accountEmail));

            try {
                emailService.send(onInvoicePaymentSuccess.email(link, accountId, accountEmail, isCardExpiringSoon));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    @Override
    public void onPaymentFailed(String accountId, String accountEmail, long amount, boolean requiresAction, boolean hasPaymentMethod) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        if (!hasPaymentMethod && !config.notifyPaymentFailedBecauseNoPaymentMethod()) {
            // Only notify when has payment method, mainly to not duplicate emails right after trial ended
            return;
        }
        submit(() -> {
            String link = "https://" + configApp.domain() + "/dashboard/billing";
            checkState(!Strings.isNullOrEmpty(accountEmail));

            try {
                emailService.send(onPaymentFailed.email(link, accountId, accountEmail, amount, requiresAction, hasPaymentMethod));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    @Override
    public void onModInvite(ConfigAdmin configAdmin, UserModel user) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        if (Strings.isNullOrEmpty(user.getEmail())) {
            log.trace("On mod invite with user having no email {}", user);
            return;
        }
        submit(() -> {
            String link = "https://" + Project.getHostname(configAdmin, configApp) + "/account";
            checkState(!Strings.isNullOrEmpty(user.getEmail()));

            String authToken = userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry());

            try {
                emailService.send(onModInvite.email(configAdmin, user, link, authToken));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    @Override
    public void onTeammateInvite(InvitationModel invitation) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + configApp.domain() + "/invitation/" + invitation.getInvitationId();
            try {
                emailService.send(onTeammateInvite.email(invitation, link));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    @Override
    public void onEmailChanged(ConfigAdmin configAdmin, UserModel user, String oldEmail) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        if (Strings.isNullOrEmpty(oldEmail)) {
            log.warn("On email changed with user having no email {}", user);
            return;
        }
        submit(() -> {
            String link = "https://" + Project.getHostname(configAdmin, configApp) + "/account";
            checkState(!Strings.isNullOrEmpty(user.getEmail()));

            String authToken = userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry(), false);

            try {
                emailService.send(onEmailChanged.email(configAdmin, user, oldEmail, link, authToken));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    @Override
    public void onEmailVerify(ConfigAdmin configAdmin, String email, String token) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            try {
                emailService.send(emailVerify.email(configAdmin, email, token));
            } catch (Exception ex) {
                log.warn("Failed to send email verification", ex);
            }
        });
    }

    @Override
    public void onEmailLogin(ConfigAdmin configAdmin, UserModel user, String token) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + Project.getHostname(configAdmin, configApp);
            checkState(!Strings.isNullOrEmpty(user.getEmail()));

            String authToken = userStore.createToken(user.getProjectId(), user.getUserId(), config.autoLoginExpiry(), false);

            try {
                emailService.send(emailLogin.email(configAdmin, user.getEmail(), token, link, authToken));
            } catch (Exception ex) {
                log.warn("Failed to send email verification", ex);
            }
        });
    }

    @Override
    public void onPostCreated(Project project, IdeaModel idea, NotifySubscribers notifySubscribers, UserModel author) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        if (!project.getCategory(idea.getCategoryId())
                .flatMap(c -> Optional.ofNullable(c.getSubscription()))
                .isPresent()) {
            return;
        }
        submit(() -> {
            String projectId = project.getProjectId();
            ConfigAdmin configAdmin = project.getVersionedConfigAdmin().getConfig();
            String link = "https://"
                    + Project.getHostname(configAdmin, configApp)
                    + "/post/"
                    + idea.getIdeaId();

            Optional<String> cursor = Optional.empty();
            do {
                ListResponse<VoteStore.VoteModel> subscriptionsBatch = voteStore.voteListByTarget(projectId, idea.getCategoryId(), cursor);
                cursor = subscriptionsBatch.getCursorOpt();

                ImmutableMap<String, UserModel> subscribersBatch = userStore.getUsers(
                        projectId,
                        subscriptionsBatch.getItems().stream()
                                .map(VoteStore.VoteModel::getUserId)
                                .collect(ImmutableList.toImmutableList()));

                try {
                    notificationStore.notificationsCreate(subscribersBatch.values().stream()
                            .map(user -> new NotificationModel(
                                    projectId,
                                    user.getUserId(),
                                    notificationStore.genNotificationId(),
                                    idea.getIdeaId(),
                                    null,
                                    idea.getCreated(),
                                    Instant.now().plus(this.config.notificationExpiry()).getEpochSecond(),
                                    onPostCreated.inAppDescription(notifySubscribers, configAdmin, user)))
                            .collect(ImmutableList.toImmutableList()));
                } catch (Exception ex) {
                    log.warn("Failed to send in-app notification", ex);
                }

                subscribersBatch.values().forEach(user -> {
                    Optional<String> authTokenOpt = Optional.empty();
                    try {
                        if (user.isEmailNotify() && !Strings.isNullOrEmpty(user.getEmail())) {
                            if (!authTokenOpt.isPresent()) {
                                authTokenOpt = Optional.of(userStore.createToken(user.getProjectId(), user.getUserId(), this.config.autoLoginExpiry()));
                            }
                            emailService.send(onPostCreated.email(notifySubscribers, configAdmin, user, link, authTokenOpt.get()));
                        }
                    } catch (Exception ex) {
                        log.warn("Failed to send email notification", ex);
                    }
                    try {
                        if (!Strings.isNullOrEmpty(user.getBrowserPushToken())) {
                            if (!authTokenOpt.isPresent()) {
                                authTokenOpt = Optional.of(userStore.createToken(user.getProjectId(), user.getUserId(), this.config.autoLoginExpiry()));
                            }
                            browserPushService.send(onPostCreated.browserPush(notifySubscribers, configAdmin, user, link, authTokenOpt.get()));
                        }
                    } catch (Exception ex) {
                        log.warn("Failed to send browser push notification", ex);
                    }
                });

            } while (cursor.isPresent());
        });
    }

    @Override
    public void onPostCreatedOnBehalfOf(Project project, IdeaModel idea, UserModel author) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            ConfigAdmin configAdmin = project.getVersionedConfigAdmin().getConfig();
            String link = "https://"
                    + Project.getHostname(configAdmin, configApp)
                    + "/post/"
                    + idea.getIdeaId();

            try {
                notificationStore.notificationCreate(new NotificationModel(
                        idea.getProjectId(),
                        author.getUserId(),
                        notificationStore.genNotificationId(),
                        idea.getIdeaId(),
                        null,
                        idea.getCreated(),
                        Instant.now().plus(config.notificationExpiry()).getEpochSecond(),
                        onPostCreatedOnBehalfOf.inAppDescription(configAdmin, idea)));
            } catch (Exception ex) {
                log.warn("Failed to send in-app notification", ex);
            }

            Optional<String> authTokenOpt = Optional.empty();
            try {
                if (author.isEmailNotify() && !Strings.isNullOrEmpty(author.getEmail())) {
                    if (!authTokenOpt.isPresent()) {
                        authTokenOpt = Optional.of(userStore.createToken(author.getProjectId(), author.getUserId(), config.autoLoginExpiry()));
                    }
                    emailService.send(onPostCreatedOnBehalfOf.email(configAdmin, author, idea, link, authTokenOpt.get()));
                }
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
            try {
                if (!Strings.isNullOrEmpty(author.getBrowserPushToken())) {
                    if (!authTokenOpt.isPresent()) {
                        authTokenOpt = Optional.of(userStore.createToken(author.getProjectId(), author.getUserId(), config.autoLoginExpiry()));
                    }
                    browserPushService.send(onPostCreatedOnBehalfOf.browserPush(configAdmin, author, idea, link, authTokenOpt.get()));
                }
            } catch (Exception ex) {
                log.warn("Failed to send browser push notification", ex);
            }
        });
    }

    @Override
    public void onAccountSignup(Account account) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + configApp.domain() + "/dashboard";

            try {
                emailService.send(accountSignup.email(account, link));
            } catch (Exception ex) {
                log.warn("Failed to send email signup", ex);
            }
        });
    }

    @Override
    public void onAdminForgotPassword(Account account, String resetToken) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + configApp.domain() + "/reset-password";
            checkState(!Strings.isNullOrEmpty(account.getEmail()));

            try {
                emailService.send(onAdminForgotPassword.email(account, link, resetToken));
            } catch (Exception ex) {
                log.warn("Failed to send admin forgot password email", ex);
            }
        });
    }

    @Override
    public void onDigest(Account account, Digest projects) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            try {
                emailService.send(onDigest.email(account, projects));
            } catch (Exception ex) {
                log.warn("Failed to send email digest", ex);
            }
        });
    }

    @Override
    public void onProjectDeletionImminent(Account account) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }
        submit(() -> {
            String link = "https://" + configApp.domain() + "/dashboard/billing";
            checkState(!Strings.isNullOrEmpty(account.getEmail()));

            try {
                emailService.send(onProjectDeletionImminent.email(account, link));
            } catch (Exception ex) {
                log.warn("Failed to send email notification", ex);
            }
        });
    }

    private Subscribers getSubscribers(IdeaModel idea, Optional<UserModel> senderOpt) {
        String skipUserId = senderOpt.map(UserModel::getUserId).orElse("");
        ImmutableSet.Builder<String> userIdsFundBuilder = ImmutableSet.builder();
        if (idea.getFundersCount() != null && idea.getFundersCount() != 0) {
            ListResponse<VoteStore.FundModel> resultFund = null;
            do {
                resultFund = voteStore.fundListByTarget(idea.getProjectId(), idea.getIdeaId(), Optional.ofNullable(resultFund).flatMap(ListResponse::getCursorOpt));
                userIdsFundBuilder.addAll(resultFund.getItems().stream()
                        .map(VoteStore.FundModel::getUserId)
                        .filter(Predicates.not(skipUserId::equals))
                        .collect(Collectors.toSet()));
            } while (resultFund.getCursorOpt().isPresent());
        }
        ImmutableSet<String> userIdsFund = userIdsFundBuilder.build();

        ImmutableSet.Builder<String> userIdsVoteBuilder = ImmutableSet.builder();
        if (idea.getVotersCount() != null && idea.getVotersCount() != 0) {
            ListResponse<VoteStore.VoteModel> resultVote = null;
            do {
                resultVote = voteStore.voteListByTarget(idea.getProjectId(), idea.getIdeaId(), Optional.ofNullable(resultVote).flatMap(ListResponse::getCursorOpt));
                userIdsVoteBuilder.addAll(resultVote.getItems().stream()
                        .map(VoteStore.VoteModel::getUserId)
                        .filter(Predicates.not(skipUserId::equals))
                        .collect(Collectors.toSet()));
            } while (resultVote.getCursorOpt().isPresent());
        }
        ImmutableSet<String> userIdsVote = userIdsVoteBuilder.build();

        ImmutableSet.Builder<String> userIdsExpressBuilder = ImmutableSet.builder();
        if (!idea.getExpressions().isEmpty()) {
            ListResponse<VoteStore.ExpressModel> resultExpress = null;
            do {
                resultExpress = voteStore.expressListByTarget(idea.getProjectId(), idea.getIdeaId(), Optional.ofNullable(resultExpress).flatMap(ListResponse::getCursorOpt));
                userIdsExpressBuilder.addAll(resultExpress.getItems().stream()
                        .map(VoteStore.ExpressModel::getUserId)
                        .filter(Predicates.not(skipUserId::equals))
                        .collect(Collectors.toSet()));
            } while (resultExpress.getCursorOpt().isPresent());
        }
        ImmutableSet<String> userIdsExpress = userIdsExpressBuilder.build();

        ImmutableSet<String> userIds = ImmutableSet.<String>builder()
                .addAll(userIdsExpress)
                .addAll(userIdsFund)
                .addAll(userIdsVote)
                .build();
        if (userIds.isEmpty()) {
            return new Subscribers(ImmutableSet.of(), ImmutableSet.of(), ImmutableSet.of());
        }
        ImmutableMap<String, UserModel> usersById = userStore.getUsers(idea.getProjectId(), userIds);

        return new Subscribers(
                userIdsFund.stream()
                        .map(usersById::get).filter(Objects::nonNull).collect(ImmutableSet.toImmutableSet()),
                userIdsVote.stream()
                        .filter(object -> !userIdsFund.contains(object))
                        .map(usersById::get).filter(Objects::nonNull).collect(ImmutableSet.toImmutableSet()),
                userIdsExpress.stream()
                        .filter(object -> !userIdsFund.contains(object))
                        .filter(object -> !userIdsExpress.contains(object))
                        .map(usersById::get).filter(Objects::nonNull).collect(ImmutableSet.toImmutableSet()));
    }

    private void submit(Runnable task) {
        executor.submit(() -> {
            try {
                task.run();
            } catch (Throwable th) {
                log.warn("Failed to complete task", th);
            }
        });
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(NotificationService.class).to(NotificationServiceImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(NotificationServiceImpl.class).asEagerSingleton();
            }
        };
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    private static class Subscribers {
        @NonNull
        private final ImmutableSet<UserModel> usersExpressed;
        @NonNull
        private final ImmutableSet<UserModel> usersFunded;
        @NonNull
        private final ImmutableSet<UserModel> usersVoted;
    }
}
