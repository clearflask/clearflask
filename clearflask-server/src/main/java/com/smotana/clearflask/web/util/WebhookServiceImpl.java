// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.util;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Maps;
import com.google.common.util.concurrent.*;
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
import com.smotana.clearflask.store.ProjectStore.WebhookListener.ResourceType;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import java.util.Map;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

@Slf4j
@Singleton
public class WebhookServiceImpl extends ManagedService implements WebhookService {

    public interface Config {
        @DefaultValue("false")
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
                new ThreadFactoryBuilder().setNameFormat("WebhookServiceImpl-worker-%d").build()));
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
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.USER, SubscriptionEventTypeUser.NEW.name(), user.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeUser.NEW.name());
            map.put("user", userPayload(user));
            return map;
        });
    }

    @Override
    public ListenableFuture<Void> eventCommentNew(IdeaStore.IdeaModel idea, CommentStore.CommentModel comment, UserStore.UserModel user) {
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.COMMENT, SubscriptionEventTypeComment.NEW.name(), idea.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeComment.NEW.name());
            map.put("post", ideaPayload(idea));
            map.put("comment", commentPayload(comment));
            map.put("user", userPayload(user));
            return map;
        });
    }

    @Override
    public ListenableFuture<Void> eventPostNew(IdeaStore.IdeaModel idea, UserStore.UserModel user) {
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.POST, SubscriptionEventTypeIdea.NEW.name(), idea.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeIdea.NEW.name());
            map.put("post", ideaPayload(idea));
            map.put("user", userPayload(user));
            return map;
        });
    }

    @Override
    public ListenableFuture<Void> eventPostVoteChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, VoteOption vote) {
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.POST, SubscriptionEventTypeIdea.VOTE_CHANGED.name(), idea.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeIdea.VOTE_CHANGED.name());
            map.put("post", ideaPayload(idea));
            map.put("user", userPayload(userSupplier.get()));
            map.put("vote", vote.name());
            return map;
        });
    }

    @Override
    public ListenableFuture<Void> eventPostFundingChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, long fundDiff) {
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.POST, SubscriptionEventTypeIdea.FUNDING_CHANGED.name(), idea.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeIdea.FUNDING_CHANGED.name());
            map.put("post", ideaPayload(idea));
            map.put("user", userPayload(userSupplier.get()));
            map.put("fundDiff", fundDiff);
            return map;
        });
    }

    @Override
    public ListenableFuture<Void> eventPostExpressionsChanged(IdeaStore.IdeaModel idea, Supplier<UserStore.UserModel> userSupplier, ImmutableSet<String> expressions) {
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.POST, SubscriptionEventTypeIdea.EXPRESSIONS_CHANGED.name(), idea.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeIdea.EXPRESSIONS_CHANGED.name());
            map.put("post", ideaPayload(idea));
            map.put("user", userPayload(userSupplier.get()));
            map.put("expressions", expressions);
            return map;
        });
    }

    @Override
    public ListenableFuture<Void> eventPostResponseChanged(IdeaStore.IdeaModel idea) {
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.POST, SubscriptionEventTypeIdea.RESPONSE_CHANGED.name(), idea.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeIdea.RESPONSE_CHANGED.name());
            map.put("post", ideaPayload(idea));
            return map;
        });
    }

    @Override
    public ListenableFuture<Void> eventPostStatusChanged(IdeaStore.IdeaModel idea) {
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.POST, SubscriptionEventTypeIdea.STATUS_CHANGED.name(), idea.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeIdea.STATUS_CHANGED.name());
            map.put("post", ideaPayload(idea));
            return map;
        });
    }

    @Override
    public ListenableFuture<Void> eventPostTagsChanged(IdeaStore.IdeaModel idea) {
        if (!config.enabled()) {
            return Futures.immediateFuture(null);
        }
        return handleEvent(ResourceType.POST, SubscriptionEventTypeIdea.TAG_CHANGED.name(), idea.getProjectId(), () -> {
            Map<String, Object> map = Maps.newHashMap();
            map.put("event_type", SubscriptionEventTypeIdea.TAG_CHANGED.name());
            map.put("post", ideaPayload(idea));
            return map;
        });
    }

    private Map<String, Object> ideaPayload(IdeaStore.IdeaModel idea) {
        Map<String, Object> map = Maps.newHashMap();
        map.put("projectId", idea.getProjectId());
        map.put("postId", idea.getIdeaId());
        map.put("categoryId", idea.getCategoryId());
        map.put("statusId", idea.getStatusId());
        map.put("tagIds", idea.getTagIds());
        map.put("authorUserId", idea.getAuthorUserId());
        map.put("authorIsMod", idea.getAuthorIsMod());
        map.put("created", idea.getCreated());
        map.put("title", idea.getTitle());
        map.put("descriptionText", idea.getDescriptionAsText(sanitizer));
        map.put("descriptionHtml", idea.getDescriptionSanitized(sanitizer));
        map.put("responseText", idea.getResponseAsText(sanitizer));
        map.put("responseHtml", idea.getResponseSanitized(sanitizer));
        map.put("responseAuthorUserId", idea.getResponseAuthorUserId());
        map.put("responseAuthorName", idea.getResponseAuthorName());
        return map;
    }

    private Map<String, Object> userPayload(UserStore.UserModel user) {
        Map<String, Object> map = Maps.newHashMap();
        map.put("projectId", user.getProjectId());
        map.put("userId", user.getUserId());
        map.put("isMod", user.getIsMod());
        map.put("name", user.getName());
        map.put("email", user.getEmail());
        map.put("created", user.getCreated());
        return map;
    }

    private Map<String, Object> commentPayload(CommentStore.CommentModel comment) {
        Map<String, Object> map = Maps.newHashMap();
        map.put("projectId", comment.getProjectId());
        map.put("commentId", comment.getCommentId());
        map.put("authorUserId", comment.getAuthorUserId());
        map.put("authorIsMod", comment.getAuthorIsMod());
        map.put("created", comment.getCreated());
        map.put("contentText", comment.getContentAsText(sanitizer));
        map.put("contentHtml", comment.getContentSanitized(sanitizer));
        return map;
    }

    private ListenableFuture<Void> handleEvent(ResourceType resourceType, String eventType, String projectId, Supplier<Map<String, Object>> payloadSupplier) {
        ImmutableSet<WebhookListener> listeners = projectStore.getProject(projectId, true)
                .map(project -> project.getWebhookListenerUrls(resourceType, eventType))
                .orElse(ImmutableSet.of());

        if (listeners.isEmpty()) {
            return Futures.immediateFuture(null);
        } else {
            return submit(() -> {
                String payload = gson.toJson(payloadSupplier.get());
                for (WebhookListener listener : listeners) {
                    log.info("Sending webhook event {} to url {} for projectId {}", eventType, listener.getUrl(), projectId);
                    HttpPost req = new HttpPost(listener.getUrl());
                    req.setEntity(new StringEntity(payload, Charsets.UTF_8));
                    try (CloseableHttpResponse res = client.execute(req)) {
                        int statusCode = res.getStatusLine().getStatusCode();
                        if (statusCode == 410) {
                            log.info("Webhook returned 410 Gone, removing listener. url {} projectId {} event {}",
                                    listener.getUrl(), projectId, eventType);
                            projectStore.removeWebhookListener(projectId, listener);
                        } else if (statusCode >= 200 && statusCode <= 299) {
                            log.info("Webhook sent successfully with status {}. url {} projectId {} event {}",
                                    statusCode, listener.getUrl(), projectId, eventType);
                        } else {
                            log.warn("Webhook returned non-success status {}. url {} projectId {} event {}",
                                    statusCode, listener.getUrl(), projectId, eventType);
                        }
                    } catch (Exception ex) {
                        log.warn("Failed to send webhook. url {} projectId {} event {}",
                                listener.getUrl(), projectId, eventType, ex);
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
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(WebhookServiceImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
