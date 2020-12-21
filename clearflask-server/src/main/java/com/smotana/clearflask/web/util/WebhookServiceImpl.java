package com.smotana.clearflask.web.util;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.ListeningExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.SubscriptionEventTypeComment;
import com.smotana.clearflask.api.model.SubscriptionEventTypeIdea;
import com.smotana.clearflask.api.model.SubscriptionEventTypeUser;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.WebhookListener;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

@Slf4j
@Singleton
public class WebhookServiceImpl extends ManagedService implements WebhookService {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();
    }

    @Inject
    private Config config;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private Gson gson;
    @Inject
    private Sanitizer sanitizer;

    private ListeningExecutorService executor;
    private CloseableHttpClient client;

    @Override
    protected void serviceStart() throws Exception {
        executor = MoreExecutors.listeningDecorator(new ThreadPoolExecutor(
                2, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS, new SynchronousQueue<>(),
                new ThreadFactoryBuilder().setNameFormat("WebhookServiceImp-worker-%d").build()));
        client = HttpClientBuilder.create().build();
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
        client.close();
    }

    @Override
    public ListenableFuture<Void> eventUserNew(UserStore.UserModel user) {
        return handleEvent(SubscriptionEventTypeUser.NEW.name(), user.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeUser.NEW.name())
                .put("user", userPayload(user))
                .build());
    }

    @Override
    public ListenableFuture<Void> eventCommentNew(IdeaStore.IdeaModel idea, CommentStore.CommentModel comment, UserStore.UserModel user) {
        return handleEvent(SubscriptionEventTypeComment.NEW.name(), idea.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeComment.NEW.name())
                .put("post", ideaPayload(idea))
                .put("comment", commentPayload(comment))
                .put("user", userPayload(user))
                .build());
    }

    @Override
    public ListenableFuture<Void> eventPostNew(IdeaStore.IdeaModel idea, UserStore.UserModel user) {
        return handleEvent(SubscriptionEventTypeIdea.NEW.name(), idea.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeIdea.NEW.name())
                .put("post", ideaPayload(idea))
                .put("user", userPayload(user))
                .build());
    }

    @Override
    public ListenableFuture<Void> eventPostVoteChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, VoteOption vote) {
        return handleEvent(SubscriptionEventTypeIdea.VOTE_CHANGED.name(), idea.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeIdea.VOTE_CHANGED.name())
                .put("post", ideaPayload(idea))
                .put("user", userPayload(userSupplier.get()))
                .put("vote", vote.name())
                .build());
    }

    @Override
    public ListenableFuture<Void> eventPostFundingChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, long fundDiff) {
        return handleEvent(SubscriptionEventTypeIdea.FUNDING_CHANGED.name(), idea.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeIdea.FUNDING_CHANGED.name())
                .put("post", ideaPayload(idea))
                .put("user", userPayload(userSupplier.get()))
                .put("fundDiff", fundDiff)
                .build());
    }

    @Override
    public ListenableFuture<Void> eventPostExpressionsChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, ImmutableSet<String> expressions) {
        return handleEvent(SubscriptionEventTypeIdea.EXPRESSIONS_CHANGED.name(), idea.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeIdea.EXPRESSIONS_CHANGED.name())
                .put("post", ideaPayload(idea))
                .put("user", userPayload(userSupplier.get()))
                .put("expressions", expressions)
                .build());
    }

    @Override
    public ListenableFuture<Void> eventPostResponseChanged(IdeaStore.IdeaModel idea) {
        return handleEvent(SubscriptionEventTypeIdea.RESPONSE_CHANGED.name(), idea.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeIdea.RESPONSE_CHANGED.name())
                .put("post", ideaPayload(idea))
                .build());
    }

    @Override
    public ListenableFuture<Void> eventPostStatusChanged(IdeaStore.IdeaModel idea) {
        return handleEvent(SubscriptionEventTypeIdea.STATUS_CHANGED.name(), idea.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeIdea.STATUS_CHANGED.name())
                .put("post", ideaPayload(idea))
                .build());
    }

    @Override
    public ListenableFuture<Void> eventPostTagsChanged(IdeaStore.IdeaModel idea) {
        return handleEvent(SubscriptionEventTypeIdea.TAG_CHANGED.name(), idea.getProjectId(), () -> ImmutableMap.<String, Object>builder()
                .put("event_type", SubscriptionEventTypeIdea.TAG_CHANGED.name())
                .put("post", ideaPayload(idea))
                .build());
    }

    private ImmutableMap<String, Object> ideaPayload(IdeaStore.IdeaModel idea) {
        return ImmutableMap.<String, Object>builder()
                .put("projectId", idea.getProjectId())
                .put("postId", idea.getIdeaId())
                .put("categoryId", idea.getCategoryId())
                .put("statusId", idea.getStatusId())
                .put("tagIds", idea.getTagIds())
                .put("authorUserId", idea.getAuthorUserId())
                .put("authorIsMod", idea.getAuthorIsMod())
                .put("created", idea.getCreated())
                .put("title", idea.getTitle())
                .put("descriptionText", idea.getDescriptionAsText(sanitizer))
                .put("descriptionHtml", idea.getDescriptionSanitized(sanitizer))
                .put("responseText", idea.getResponseAsText(sanitizer))
                .put("responseHtml", idea.getResponseSanitized(sanitizer))
                .put("responseAuthorUserId", idea.getResponseAuthorUserId())
                .put("getResponseAuthorName", idea.getResponseAuthorName())
                .build();
    }

    private ImmutableMap<String, Object> userPayload(UserStore.UserModel user) {
        return ImmutableMap.<String, Object>builder()
                .put("projectId", user.getProjectId())
                .put("userId", user.getUserId())
                .put("isMod", user.getIsMod())
                .put("name", user.getName())
                .put("email", user.getEmail())
                .put("created", user.getCreated())
                .build();
    }

    private ImmutableMap<String, Object> commentPayload(CommentStore.CommentModel comment) {
        return ImmutableMap.<String, Object>builder()
                .put("projectId", comment.getProjectId())
                .put("commentId", comment.getCommentId())
                .put("authorUserId", comment.getAuthorUserId())
                .put("authorIsMod", comment.getAuthorIsMod())
                .put("created", comment.getCreated())
                .put("contentText", comment.getContentAsText(sanitizer))
                .put("contentHtml", comment.getContentSanitized(sanitizer))
                .build();
    }

    private ListenableFuture<Void> handleEvent(String eventType, String projectId, Supplier<ImmutableMap<String, Object>> payloadSupplier) {
        ImmutableSet<WebhookListener> listeners = projectStore.getProject(projectId, true)
                .map(project -> project.getWebhookListenerUrls(eventType))
                .orElse(ImmutableSet.of());

        if (listeners.isEmpty()) {
            return Futures.immediateFuture(null);
        } else {
            return submit(() -> {
                String payload = gson.toJson(payloadSupplier.get());
                for (WebhookListener listener : listeners) {
                    log.trace("Sending webhook callback, url {} payload {}", listener.getUrl(), payload);
                    HttpPost req = new HttpPost(listener.getUrl());
                    req.setEntity(new StringEntity(payload, Charsets.UTF_8));
                    try (CloseableHttpResponse res = client.execute(req)) {
                        if (res.getStatusLine().getStatusCode() == 410) {
                            projectStore.removeWebhookListener(projectId, listener);
                        } else if (res.getStatusLine().getStatusCode() < 200
                                || res.getStatusLine().getStatusCode() > 299) {
                            if (LogUtil.rateLimitAllowLog("webhookService-send-status-non-200")) {
                                // TODO notify account owner
                                log.info("Send to webhook got status {}, url {} projectId {} event {}",
                                        res.getStatusLine().getStatusCode(), listener.getUrl(), projectId, eventType);
                            }
                        }
                    } catch (Exception ex) {
                        if (LogUtil.rateLimitAllowLog("webhookService-send-failed")) {
                            log.warn("Failed to send to webhook url {} for projectId {} event {}",
                                    listener.getUrl(), projectId, eventType);
                        }
                    }
                }
            });
        }
    }

    private ListenableFuture<Void> submit(Runnable task) {
        return executor.submit(() -> {
            try {
                task.run();
            } catch (Throwable th) {
                if (LogUtil.rateLimitAllowLog("webhookService-submit-failed")) {
                    log.warn("Failed to complete task", th);
                }
            }
            return null;
        });
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(WebhookService.class).to(WebhookServiceImpl.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(WebhookServiceImpl.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
