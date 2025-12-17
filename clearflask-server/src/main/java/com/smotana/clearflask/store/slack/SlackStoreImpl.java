// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.slack;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
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
import com.slack.api.methods.MethodsClient;
import com.slack.api.methods.SlackApiException;
import com.slack.api.methods.response.chat.ChatPostMessageResponse;
import com.slack.api.methods.response.chat.ChatUpdateResponse;
import com.slack.api.methods.response.conversations.ConversationsListResponse;
import com.slack.api.methods.response.users.UsersInfoResponse;
import com.slack.api.model.Conversation;
import com.slack.api.model.ConversationType;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.SlackChannelLink;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.CommentStore.CommentAndIndexingFuture;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.SlackStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.MarkdownAndQuillUtil;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.IndexSchema;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.stream.StreamSupport;

@Slf4j
@Singleton
public class SlackStoreImpl extends ManagedService implements SlackStore {

    public static final String USER_GUID_SLACK_PREFIX = "slack-";
    public static final String POST_SOURCE_SLACK = "slack";

    public interface Config {
        @DefaultValue("true")
        boolean enabled();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private SlackClientProvider slackClientProvider;
    @Inject
    private MarkdownAndQuillUtil markdownAndQuillUtil;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private SingleTable singleTable;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private CommentStore commentStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private UserStore userStore;
    @Inject
    private Sanitizer sanitizer;
    @Inject
    private Billing billing;

    private TableSchema<SlackMessageMapping> messageMappingSchema;
    private IndexSchema<SlackMessageMapping> messageMappingByPostIdSchema;
    private TableSchema<SlackCommentMapping> commentMappingSchema;
    private IndexSchema<SlackCommentMapping> commentMappingByCommentIdSchema;
    private ListeningExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        messageMappingSchema = singleTable.parseTableSchema(SlackMessageMapping.class);
        messageMappingByPostIdSchema = singleTable.parseGlobalSecondaryIndexSchema(1, SlackMessageMapping.class);
        commentMappingSchema = singleTable.parseTableSchema(SlackCommentMapping.class);
        commentMappingByCommentIdSchema = singleTable.parseGlobalSecondaryIndexSchema(1, SlackCommentMapping.class);

        executor = MoreExecutors.listeningDecorator(new ThreadPoolExecutor(
                2, 100, 60L, TimeUnit.SECONDS, new SynchronousQueue<>(),
                new ThreadFactoryBuilder().setNameFormat("SlackStoreImpl-worker-%d").build(),
                new ThreadPoolExecutor.CallerRunsPolicy()));
    }

    @Override
    protected void serviceStop() throws Exception {
        if (executor != null) {
            executor.shutdown();
        }
    }

    // ===== Configuration =====

    @Override
    public SlackWorkspaceInfo getWorkspaceInfoForUser(String accountId, String code) {
        if (!config.enabled()) {
            log.debug("Slack integration not enabled, skipping");
            throw new com.smotana.clearflask.web.ApiException(javax.ws.rs.core.Response.Status.SERVICE_UNAVAILABLE, "Slack integration is disabled");
        }

        log.info("Attempting to exchange Slack OAuth code for account {}", accountId);

        try {
            // Exchange authorization code for access token
            String redirectUri = "https://" + configApp.domain() + "/dashboard/settings/project/slack";

            com.slack.api.methods.response.oauth.OAuthV2AccessResponse oauthResponse = slackClientProvider
                    .getOAuthClient()
                    .oauthV2Access(r -> r
                            .clientId(slackClientProvider.getClientId())
                            .clientSecret(slackClientProvider.getClientSecret())
                            .code(code)
                            .redirectUri(redirectUri));

            if (!oauthResponse.isOk()) {
                log.error("Slack OAuth token exchange failed for account {}: error={}, warning={}",
                        accountId, oauthResponse.getError(), oauthResponse.getWarning());
                throw new com.smotana.clearflask.web.ApiException(javax.ws.rs.core.Response.Status.BAD_REQUEST,
                        "Failed to authenticate with Slack: " + oauthResponse.getError());
            }

            String accessToken = oauthResponse.getAccessToken();
            String teamId = oauthResponse.getTeam().getId();
            String teamName = oauthResponse.getTeam().getName();
            String botUserId = oauthResponse.getBotUserId();

            // Extract incoming webhook info if present (from incoming-webhook scope)
            String selectedChannelId = null;
            String selectedChannelName = null;
            if (oauthResponse.getIncomingWebhook() != null) {
                selectedChannelId = oauthResponse.getIncomingWebhook().getChannelId();
                selectedChannelName = oauthResponse.getIncomingWebhook().getChannel();
                log.info("Slack OAuth included incoming webhook for channel: id={}, name={}",
                        selectedChannelId, selectedChannelName);
            }

            // Get available channels using the access token
            MethodsClient client = slackClientProvider.getClientWithToken(accessToken);
            List<SlackChannel> channels = fetchChannels(client);

            log.info("Successfully exchanged Slack OAuth code for account {}: teamId={}, teamName={}, channelCount={}, selectedChannel={}",
                    accountId, teamId, teamName, channels.size(), selectedChannelId);

            return SlackWorkspaceInfo.builder()
                    .teamId(teamId)
                    .teamName(teamName)
                    .accessToken(accessToken)
                    .botUserId(botUserId)
                    .channels(channels)
                    .selectedChannelId(selectedChannelId)
                    .selectedChannelName(selectedChannelName)
                    .build();

        } catch (IOException e) {
            log.error("IOException during Slack OAuth token exchange for account {}: {}", accountId, e.getMessage(), e);
            throw new com.smotana.clearflask.web.ApiException(javax.ws.rs.core.Response.Status.BAD_REQUEST,
                    "Failed to authenticate with Slack", e);
        } catch (SlackApiException e) {
            log.error("Slack API error during OAuth token exchange for account {}: error={}, responseBody={}",
                    accountId, e.getMessage(), e.getResponseBody(), e);
            throw new com.smotana.clearflask.web.ApiException(javax.ws.rs.core.Response.Status.BAD_REQUEST,
                    "Failed to authenticate with Slack: " + e.getMessage(), e);
        }
    }

    @Override
    public List<SlackChannel> getAvailableChannels(String projectId) {
        if (!config.enabled()) {
            return ImmutableList.of();
        }

        Optional<SlackClientProvider.SlackClientWithRateLimiter> clientOpt = slackClientProvider.getClient(projectId);
        if (clientOpt.isEmpty()) {
            return ImmutableList.of();
        }

        try {
            SlackClientProvider.SlackClientWithRateLimiter client = clientOpt.get();
            if (!client.getRateLimiter().tryAcquire()) {
                log.warn("Rate limited when fetching channels for project {}", projectId);
                return ImmutableList.of();
            }

            return fetchChannels(client.getClient());

        } catch (IOException | SlackApiException e) {
            log.warn("Error fetching Slack channels for project {}", projectId, e);
            return ImmutableList.of();
        }
    }

    /**
     * Fetch channels from Slack API.
     */
    private List<SlackChannel> fetchChannels(MethodsClient client) throws IOException, SlackApiException {
        ConversationsListResponse response = client.conversationsList(r -> r
                .types(List.of(ConversationType.PUBLIC_CHANNEL, ConversationType.PRIVATE_CHANNEL))
                .excludeArchived(true)
                .limit(200));

        if (!response.isOk()) {
            log.error("Failed to list Slack channels: error={}, warning={}, needed={}",
                    response.getError(), response.getWarning(), response.getNeeded());
            return ImmutableList.of();
        }

        List<SlackChannel> channels = new ArrayList<>();
        for (Conversation conv : response.getChannels()) {
            channels.add(new SlackChannel(
                    conv.getId(),
                    conv.getName(),
                    conv.isPrivate(),
                    conv.isMember()));
        }
        return channels;
    }

    @Override
    public void setupConfigSlackIntegration(String accountId, Optional<ConfigAdmin> configPrevious, ConfigAdmin configAdmin) {
        // If Slack config was removed, invalidate the client cache
        if (configPrevious.isPresent()
                && configPrevious.get().getSlack() != null
                && configAdmin.getSlack() == null) {
            if (slackClientProvider instanceof SlackClientProviderImpl) {
                ((SlackClientProviderImpl) slackClientProvider).invalidateClient(configAdmin.getProjectId());
            }
        }

        // If Slack config was added or changed, invalidate and reload
        if (configAdmin.getSlack() != null) {
            if (slackClientProvider instanceof SlackClientProviderImpl) {
                ((SlackClientProviderImpl) slackClientProvider).invalidateClient(configAdmin.getProjectId());
            }
        }
    }

    @Override
    public void removeIntegration(String projectId) {
        if (slackClientProvider instanceof SlackClientProviderImpl) {
            ((SlackClientProviderImpl) slackClientProvider).invalidateClient(projectId);
        }

        // TODO: Clean up message mappings for this project
    }

    // ===== Inbound: Slack → ClearFlask =====

    @Override
    public Optional<IdeaAndIndexingFuture> slackMessageCreated(Project project, SlackMessageEvent event) {
        log.info("slackMessageCreated: project={}, channel={}, msgTs={}",
            project.getProjectId(), event.getChannelId(), event.getMessageTs());

        if (!config.enabled()) {
            log.debug("Slack integration not enabled in config");
            return Optional.empty();
        }

        com.smotana.clearflask.api.model.Slack slackConfig = project.getVersionedConfigAdmin().getConfig().getSlack();
        if (slackConfig == null) {
            log.debug("No Slack config found for project {}", project.getProjectId());
            return Optional.empty();
        }

        // Ignore messages from our bot
        if (event.getUserId() != null && event.getUserId().equals(slackConfig.getBotUserId())) {
            log.debug("Ignoring message from our bot: {}", event.getUserId());
            return Optional.empty();
        }

        // Ignore thread replies (handled by slackReplyCreated)
        if (event.getThreadTs() != null && !event.getThreadTs().equals(event.getMessageTs())) {
            log.debug("Ignoring thread reply (handled separately)");
            return Optional.empty();
        }

        // Find channel link for this channel
        Optional<SlackChannelLink> channelLinkOpt = findChannelLink(slackConfig, event.getChannelId());
        if (channelLinkOpt.isEmpty()) {
            log.info("No channel link configured for Slack channel {}. Add channel link in settings.", event.getChannelId());
            return Optional.empty();
        }

        SlackChannelLink link = channelLinkOpt.get();

        // Check if syncSlackToPosts is enabled (default: false as per user request)
        if (link.getSyncSlackToPosts() != Boolean.TRUE) {
            log.info("Slack → Posts disabled for channel {}. Enable 'Slack → Posts' in channel link settings.", event.getChannelId());
            return Optional.empty();
        }

        log.info("Creating CF post from Slack message: channel={}, category={}", event.getChannelId(), link.getCategoryId());

        // Generate deterministic post ID
        String postId = genDeterministicPostIdForSlackMessage(event.getChannelId(), event.getMessageTs());

        // Get or create user from Slack user
        UserModel user = getCfUserFromSlackUser(project.getProjectId(), event.getUserId());

        // Parse message: first line is title, rest is description
        String[] parts = parseSlackMessage(event.getText());
        String title = parts[0];
        String description = parts[1];

        // Create the post
        IdeaAndIndexingFuture result = ideaStore.createIdeaAndUpvote(new IdeaModel(
                project.getProjectId(),
                postId,
                user.getUserId(),
                user.getName(),
                user.getIsMod(),
                user.getPic(),
                user.getPicUrl(),
                Instant.now(),
                title,
                markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "slack-new-post", postId, description),
                null,
                null,
                null,
                null,
                null,
                null,
                link.getCategoryId(),
                Optional.ofNullable(Strings.emptyToNull(link.getInitialStatusId()))
                        .or(() -> project.getCategory(link.getCategoryId())
                                .map(Category::getWorkflow)
                                .flatMap(workflow -> Optional.ofNullable(workflow.getEntryStatus())))
                        .orElse(null),
                link.getCreateWithTags() != null
                        ? ImmutableSet.copyOf(link.getCreateWithTags())
                        : ImmutableSet.of(),
                0L,
                0L,
                null,
                null,
                null,
                null,
                null,
                null,
                ImmutableMap.of(),
                null,
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                null,
                ImmutableSet.of(),
                null,
                null,  // linkedGitHubUrl
                null,  // coverImg
                null,  // visibility
                null   // adminNotes
        ));

        // Store the mapping
        storeMessageMapping(project.getProjectId(), event, postId);

        return Optional.of(result);
    }

    @Override
    public Optional<CommentAndIndexingFuture<?>> slackReplyCreated(Project project, SlackMessageEvent event) {
        if (!config.enabled()) {
            return Optional.empty();
        }

        com.smotana.clearflask.api.model.Slack slackConfig = project.getVersionedConfigAdmin().getConfig().getSlack();
        if (slackConfig == null) {
            return Optional.empty();
        }

        // Ignore messages from our bot
        if (event.getUserId() != null && event.getUserId().equals(slackConfig.getBotUserId())) {
            return Optional.empty();
        }

        // This must be a thread reply
        if (event.getThreadTs() == null || event.getThreadTs().equals(event.getMessageTs())) {
            return Optional.empty();
        }

        // Find channel link
        Optional<SlackChannelLink> channelLinkOpt = findChannelLink(slackConfig, event.getChannelId());
        if (channelLinkOpt.isEmpty()) {
            return Optional.empty();
        }

        SlackChannelLink link = channelLinkOpt.get();

        // Check if syncRepliesToComments is enabled
        if (link.getSyncRepliesToComments() != Boolean.TRUE) {
            return Optional.empty();
        }

        // Find the post that corresponds to the thread
        Optional<SlackMessageMapping> mappingOpt = getMessageMapping(project.getProjectId(), event.getChannelId(), event.getThreadTs());
        if (mappingOpt.isEmpty()) {
            return Optional.empty();
        }

        String postId = mappingOpt.get().getPostId();
        String commentId = genDeterministicCommentIdForSlackReply(event.getChannelId(), event.getThreadTs(), event.getMessageTs());

        // Get user
        UserModel user = getCfUserFromSlackUser(project.getProjectId(), event.getUserId());

        // Create comment
        CommentAndIndexingFuture<?> result = commentStore.createCommentAndUpvote(new CommentModel(
                project.getProjectId(),
                postId,
                commentId,
                ImmutableList.of(),
                0,
                0L,
                user.getUserId(),
                user.getName(),
                user.getIsMod(),
                user.getPic(),
                user.getPicUrl(),
                Instant.now(),
                null,
                markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "slack-new-comment", commentId, slackMrkdwnToMarkdown(event.getText())),
                0,
                0));

        // Store comment mapping
        storeCommentMapping(project.getProjectId(), event, postId, commentId);

        return Optional.of(result);
    }

    @Override
    public void slackMessageEdited(Project project, SlackMessageEvent event) {
        if (!config.enabled()) {
            return;
        }

        // Find existing mapping
        Optional<SlackMessageMapping> msgMappingOpt = getMessageMapping(
                project.getProjectId(), event.getChannelId(), event.getMessageTs());

        if (msgMappingOpt.isPresent()) {
            // It's a post edit
            String[] parts = parseSlackMessage(event.getText());
            try {
                ideaStore.updateIdea(project.getProjectId(), msgMappingOpt.get().getPostId(),
                        com.smotana.clearflask.api.model.IdeaUpdateAdmin.builder()
                                .title(parts[0])
                                .description(markdownAndQuillUtil.markdownToQuill(
                                        project.getProjectId(), "slack-edit-post",
                                        msgMappingOpt.get().getPostId(), parts[1]))
                                .build(),
                        Optional.empty());
            } catch (Exception e) {
                log.warn("Failed to update post from Slack edit", e);
            }
            return;
        }

        // Check if it's a comment edit
        if (event.getThreadTs() != null) {
            Optional<SlackCommentMapping> commentMappingOpt = getCommentMapping(
                    project.getProjectId(), event.getChannelId(), event.getThreadTs(), event.getMessageTs());

            if (commentMappingOpt.isPresent()) {
                try {
                    commentStore.updateComment(project.getProjectId(),
                            commentMappingOpt.get().getPostId(),
                            commentMappingOpt.get().getCommentId(),
                            Instant.now(),
                            com.smotana.clearflask.api.model.CommentUpdate.builder()
                                    .content(markdownAndQuillUtil.markdownToQuill(
                                            project.getProjectId(), "slack-edit-comment",
                                            commentMappingOpt.get().getCommentId(),
                                            slackMrkdwnToMarkdown(event.getText())))
                                    .build());
                } catch (Exception e) {
                    log.warn("Failed to update comment from Slack edit", e);
                }
            }
        }
    }

    @Override
    public void slackMessageDeleted(Project project, SlackMessageEvent event) {
        if (!config.enabled()) {
            return;
        }

        // Check if it's a post
        Optional<SlackMessageMapping> msgMappingOpt = getMessageMapping(
                project.getProjectId(), event.getChannelId(), event.getMessageTs());

        if (msgMappingOpt.isPresent()) {
            try {
                ideaStore.deleteIdea(project.getProjectId(), msgMappingOpt.get().getPostId(), true);
                billing.recordUsage(Billing.UsageType.POST_DELETED,
                        projectStore.getProject(project.getProjectId(), false).map(p -> p.getAccountId()).orElse("unknown"),
                        project.getProjectId());
            } catch (ConditionalCheckFailedException e) {
                // Post already deleted
            }
            return;
        }

        // Check if it's a comment
        if (event.getThreadTs() != null) {
            Optional<SlackCommentMapping> commentMappingOpt = getCommentMapping(
                    project.getProjectId(), event.getChannelId(), event.getThreadTs(), event.getMessageTs());

            if (commentMappingOpt.isPresent()) {
                try {
                    commentStore.markAsDeletedComment(project.getProjectId(),
                            commentMappingOpt.get().getPostId(),
                            commentMappingOpt.get().getCommentId());
                } catch (ConditionalCheckFailedException e) {
                    // Comment already deleted
                }
            }
        }
    }

    // ===== Outbound: ClearFlask → Slack =====

    @Override
    public ListenableFuture<Optional<SlackMessageResult>> cfPostCreatedAsync(Project project, IdeaModel idea, UserModel author) {
        log.info("cfPostCreatedAsync: project={}, idea={}, category={}",
            project.getProjectId(), idea.getIdeaId(), idea.getCategoryId());

        if (!config.enabled()) {
            log.debug("Slack integration not enabled in config");
            return Futures.immediateFuture(Optional.empty());
        }

        com.smotana.clearflask.api.model.Slack slackConfig = project.getVersionedConfigAdmin().getConfig().getSlack();
        if (slackConfig == null) {
            log.debug("No Slack config found for project {}", project.getProjectId());
            return Futures.immediateFuture(Optional.empty());
        }

        if (slackConfig.getChannelLinks() == null || slackConfig.getChannelLinks().isEmpty()) {
            log.info("No Slack channel links configured. Add channel links in settings to enable CF→Slack sync.");
            return Futures.immediateFuture(Optional.empty());
        }

        // Find channel link for this category
        Optional<SlackChannelLink> channelLinkOpt = slackConfig.getChannelLinks().stream()
                .filter(link -> idea.getCategoryId().equals(link.getCategoryId()))
                .findFirst();

        if (channelLinkOpt.isEmpty()) {
            log.debug("No Slack channel link found for category {}. Configure channel link for this category to enable sync.", idea.getCategoryId());
            return Futures.immediateFuture(Optional.empty());
        }

        SlackChannelLink link = channelLinkOpt.get();

        // Check if syncPostsToSlack is enabled (default: true)
        if (link.getSyncPostsToSlack() == Boolean.FALSE) {
            log.info("Posts → Slack disabled for category {}. Enable in channel link settings.", idea.getCategoryId());
            return Futures.immediateFuture(Optional.empty());
        }

        // Don't sync if post originated from Slack (prevent loop)
        Optional<SlackMessageMapping> existingMapping = getMessageMappingByPostId(project.getProjectId(), idea.getIdeaId());
        if (existingMapping.isPresent()) {
            log.debug("Post {} originated from Slack, skipping sync to prevent loop", idea.getIdeaId());
            return Futures.immediateFuture(Optional.empty());
        }

        log.info("Posting CF idea {} to Slack channel {}", idea.getIdeaId(), link.getChannelId());

        return submit(() -> {
            Optional<SlackClientProvider.SlackClientWithRateLimiter> clientOpt = slackClientProvider.getClient(project.getProjectId());
            if (clientOpt.isEmpty()) {
                return Optional.empty();
            }

            SlackClientProvider.SlackClientWithRateLimiter client = clientOpt.get();
            if (!client.getRateLimiter().tryAcquire()) {
                return Optional.empty();
            }

            // Build message
            String message = formatPostForSlack(project, idea, author);

            try {
                ChatPostMessageResponse response = client.getClient().chatPostMessage(r -> r
                        .channel(link.getChannelId())
                        .text(message)
                        .unfurlLinks(false)
                        .unfurlMedia(false));

                if (!response.isOk()) {
                    log.warn("Failed to post message to Slack for project {} post {}: {}",
                            project.getProjectId(), idea.getIdeaId(), response.getError());
                    return Optional.empty();
                }

                // Store mapping
                SlackMessageMapping mapping = SlackMessageMapping.builder()
                        .projectId(project.getProjectId())
                        .channelId(link.getChannelId())
                        .messageTs(response.getTs())
                        .postId(idea.getIdeaId())
                        .teamId(client.getTeamId())
                        .createdEpochMs(Instant.now().toEpochMilli())
                        .build();
                messageMappingSchema.table().putItem(messageMappingSchema.toItem(mapping));

                return Optional.of(new SlackMessageResult(
                        link.getChannelId(),
                        response.getTs(),
                        null));

            } catch (IOException | SlackApiException e) {
                log.warn("Error posting to Slack for project {} post {}",
                        project.getProjectId(), idea.getIdeaId(), e);
                return Optional.empty();
            }
        });
    }

    @Override
    public ListenableFuture<Optional<SlackMessageResult>> cfCommentCreatedAsync(Project project, IdeaModel idea, CommentModel comment, UserModel author) {
        if (!config.enabled()) {
            return Futures.immediateFuture(Optional.empty());
        }

        com.smotana.clearflask.api.model.Slack slackConfig = project.getVersionedConfigAdmin().getConfig().getSlack();
        if (slackConfig == null || slackConfig.getChannelLinks() == null) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Find channel link
        Optional<SlackChannelLink> channelLinkOpt = slackConfig.getChannelLinks().stream()
                .filter(link -> idea.getCategoryId().equals(link.getCategoryId()))
                .findFirst();

        if (channelLinkOpt.isEmpty()) {
            return Futures.immediateFuture(Optional.empty());
        }

        SlackChannelLink link = channelLinkOpt.get();

        // Check if syncCommentsToReplies is enabled
        if (link.getSyncCommentsToReplies() == Boolean.FALSE) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Find the Slack message for this post
        Optional<SlackMessageMapping> mappingOpt = getMessageMappingByPostId(project.getProjectId(), idea.getIdeaId());
        if (mappingOpt.isEmpty()) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Don't sync if comment originated from Slack
        Optional<SlackCommentMapping> existingCommentMapping = getCommentMappingByCommentId(
                project.getProjectId(), comment.getCommentId());
        if (existingCommentMapping.isPresent()) {
            return Futures.immediateFuture(Optional.empty());
        }

        SlackMessageMapping postMapping = mappingOpt.get();

        return submit(() -> {
            Optional<SlackClientProvider.SlackClientWithRateLimiter> clientOpt = slackClientProvider.getClient(project.getProjectId());
            if (clientOpt.isEmpty()) {
                return Optional.empty();
            }

            SlackClientProvider.SlackClientWithRateLimiter client = clientOpt.get();
            if (!client.getRateLimiter().tryAcquire()) {
                return Optional.empty();
            }

            String message = formatCommentForSlack(comment, author);

            try {
                ChatPostMessageResponse response = client.getClient().chatPostMessage(r -> r
                        .channel(postMapping.getChannelId())
                        .threadTs(postMapping.getMessageTs())
                        .text(message)
                        .unfurlLinks(false)
                        .unfurlMedia(false));

                if (!response.isOk()) {
                    log.warn("Failed to post reply to Slack for project {} comment {}: {}",
                            project.getProjectId(), comment.getCommentId(), response.getError());
                    return Optional.empty();
                }

                // Store comment mapping
                SlackCommentMapping commentMapping = SlackCommentMapping.builder()
                        .projectId(project.getProjectId())
                        .channelId(postMapping.getChannelId())
                        .threadTs(postMapping.getMessageTs())
                        .messageTs(response.getTs())
                        .postId(idea.getIdeaId())
                        .commentId(comment.getCommentId())
                        .teamId(client.getTeamId())
                        .createdEpochMs(Instant.now().toEpochMilli())
                        .build();
                commentMappingSchema.table().putItem(commentMappingSchema.toItem(commentMapping));

                return Optional.of(new SlackMessageResult(
                        postMapping.getChannelId(),
                        response.getTs(),
                        postMapping.getMessageTs()));

            } catch (IOException | SlackApiException e) {
                log.warn("Error posting reply to Slack for project {} comment {}",
                        project.getProjectId(), comment.getCommentId(), e);
                return Optional.empty();
            }
        });
    }

    @Override
    public ListenableFuture<Optional<SlackMessageResult>> cfPostStatusChangedAsync(Project project, IdeaModel idea) {
        if (!config.enabled()) {
            return Futures.immediateFuture(Optional.empty());
        }

        com.smotana.clearflask.api.model.Slack slackConfig = project.getVersionedConfigAdmin().getConfig().getSlack();
        if (slackConfig == null || slackConfig.getChannelLinks() == null) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Find channel link
        Optional<SlackChannelLink> channelLinkOpt = slackConfig.getChannelLinks().stream()
                .filter(link -> idea.getCategoryId().equals(link.getCategoryId()))
                .findFirst();

        if (channelLinkOpt.isEmpty()) {
            return Futures.immediateFuture(Optional.empty());
        }

        SlackChannelLink link = channelLinkOpt.get();

        // Check if syncStatusUpdates is enabled
        if (link.getSyncStatusUpdates() == Boolean.FALSE) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Find existing Slack message
        Optional<SlackMessageMapping> mappingOpt = getMessageMappingByPostId(project.getProjectId(), idea.getIdeaId());
        if (mappingOpt.isEmpty()) {
            return Futures.immediateFuture(Optional.empty());
        }

        SlackMessageMapping mapping = mappingOpt.get();

        return submit(() -> {
            Optional<SlackClientProvider.SlackClientWithRateLimiter> clientOpt = slackClientProvider.getClient(project.getProjectId());
            if (clientOpt.isEmpty()) {
                return Optional.empty();
            }

            SlackClientProvider.SlackClientWithRateLimiter client = clientOpt.get();
            if (!client.getRateLimiter().tryAcquire()) {
                return Optional.empty();
            }

            // Get author info for the update message
            Optional<UserModel> authorOpt = userStore.getUser(project.getProjectId(), idea.getAuthorUserId());
            String message = formatPostForSlack(project, idea, authorOpt.orElse(null));

            try {
                ChatUpdateResponse response = client.getClient().chatUpdate(r -> r
                        .channel(mapping.getChannelId())
                        .ts(mapping.getMessageTs())
                        .text(message));

                if (!response.isOk()) {
                    log.warn("Failed to update Slack message for project {} post {}: {}",
                            project.getProjectId(), idea.getIdeaId(), response.getError());
                    return Optional.empty();
                }

                // Update last synced time
                SlackMessageMapping updatedMapping = mapping.toBuilder()
                        .lastSyncedEpochMs(Instant.now().toEpochMilli())
                        .build();
                messageMappingSchema.table().putItem(messageMappingSchema.toItem(updatedMapping));

                return Optional.of(new SlackMessageResult(
                        mapping.getChannelId(),
                        mapping.getMessageTs(),
                        null));

            } catch (IOException | SlackApiException e) {
                log.warn("Error updating Slack message for project {} post {}",
                        project.getProjectId(), idea.getIdeaId(), e);
                return Optional.empty();
            }
        });
    }

    @Override
    public ListenableFuture<Optional<SlackMessageResult>> cfResponseChangedAsync(Project project, IdeaModel idea) {
        if (!config.enabled()) {
            return Futures.immediateFuture(Optional.empty());
        }

        if (Strings.isNullOrEmpty(idea.getResponseAsUnsafeHtml())) {
            return Futures.immediateFuture(Optional.empty());
        }

        com.smotana.clearflask.api.model.Slack slackConfig = project.getVersionedConfigAdmin().getConfig().getSlack();
        if (slackConfig == null || slackConfig.getChannelLinks() == null) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Find channel link
        Optional<SlackChannelLink> channelLinkOpt = slackConfig.getChannelLinks().stream()
                .filter(link -> idea.getCategoryId().equals(link.getCategoryId()))
                .findFirst();

        if (channelLinkOpt.isEmpty()) {
            return Futures.immediateFuture(Optional.empty());
        }

        SlackChannelLink link = channelLinkOpt.get();

        // Check if syncResponseUpdates is enabled
        if (link.getSyncResponseUpdates() == Boolean.FALSE) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Find existing Slack message
        Optional<SlackMessageMapping> mappingOpt = getMessageMappingByPostId(project.getProjectId(), idea.getIdeaId());
        if (mappingOpt.isEmpty()) {
            return Futures.immediateFuture(Optional.empty());
        }

        SlackMessageMapping mapping = mappingOpt.get();

        return submit(() -> {
            Optional<SlackClientProvider.SlackClientWithRateLimiter> clientOpt = slackClientProvider.getClient(project.getProjectId());
            if (clientOpt.isEmpty()) {
                return Optional.empty();
            }

            SlackClientProvider.SlackClientWithRateLimiter client = clientOpt.get();
            if (!client.getRateLimiter().tryAcquire()) {
                return Optional.empty();
            }

            String responseMessage = formatResponseForSlack(idea);

            try {
                ChatPostMessageResponse response = client.getClient().chatPostMessage(r -> r
                        .channel(mapping.getChannelId())
                        .threadTs(mapping.getMessageTs())
                        .text(responseMessage)
                        .unfurlLinks(false)
                        .unfurlMedia(false));

                if (!response.isOk()) {
                    log.warn("Failed to post response to Slack for project {} post {}: {}",
                            project.getProjectId(), idea.getIdeaId(), response.getError());
                    return Optional.empty();
                }

                return Optional.of(new SlackMessageResult(
                        mapping.getChannelId(),
                        response.getTs(),
                        mapping.getMessageTs()));

            } catch (IOException | SlackApiException e) {
                log.warn("Error posting response to Slack for project {} post {}",
                        project.getProjectId(), idea.getIdeaId(), e);
                return Optional.empty();
            }
        });
    }

    // ===== Helper Methods =====

    private Optional<SlackChannelLink> findChannelLink(com.smotana.clearflask.api.model.Slack slackConfig, String channelId) {
        if (slackConfig.getChannelLinks() == null) {
            return Optional.empty();
        }
        return slackConfig.getChannelLinks().stream()
                .filter(link -> channelId.equals(link.getChannelId()))
                .findFirst();
    }

    private String genDeterministicPostIdForSlackMessage(String channelId, String messageTs) {
        return POST_SOURCE_SLACK + "-" + channelId + "-" + messageTs.replace(".", "-");
    }

    private String genDeterministicCommentIdForSlackReply(String channelId, String threadTs, String messageTs) {
        return POST_SOURCE_SLACK + "-" + messageTs.replace(".", "-");
    }

    private UserModel getCfUserFromSlackUser(String projectId, String slackUserId) {
        String cfUserId = USER_GUID_SLACK_PREFIX + slackUserId;

        // Check if user already exists
        Optional<UserModel> existingUser = userStore.getUser(projectId, cfUserId);
        if (existingUser.isPresent()) {
            return existingUser.get();
        }

        // Try to get user info from Slack
        String userName = "Slack User";
        String email = null;

        Optional<SlackClientProvider.SlackClientWithRateLimiter> clientOpt = slackClientProvider.getClient(projectId);
        if (clientOpt.isPresent() && clientOpt.get().getRateLimiter().tryAcquire()) {
            try {
                UsersInfoResponse userInfo = clientOpt.get().getClient().usersInfo(r -> r.user(slackUserId));
                if (userInfo.isOk() && userInfo.getUser() != null) {
                    if (userInfo.getUser().getRealName() != null) {
                        userName = userInfo.getUser().getRealName();
                    } else if (userInfo.getUser().getName() != null) {
                        userName = userInfo.getUser().getName();
                    }
                    if (userInfo.getUser().getProfile() != null) {
                        email = userInfo.getUser().getProfile().getEmail();
                    }
                }
            } catch (IOException | SlackApiException e) {
                log.debug("Could not fetch Slack user info for {}", slackUserId, e);
            }
        }

        // Create the user
        return userStore.createUser(new UserModel(
                projectId,
                cfUserId,
                null, // ssoGuid
                false, // isMod
                userName,
                email,
                null, // emailVerified
                null, // emailLastUpdated
                null, // password
                null, // authTokenValidityStart
                false, // emailNotify
                0L, // balance
                null, // iosPushToken
                null, // androidPushToken
                null, // browserPushToken
                Instant.now(), // created
                null, // pic
                null, // picUrl
                null, // expressBloom
                null, // fundBloom
                null, // voteBloom
                null, // commentVoteBloom
                null, // isTracked
                ImmutableSet.of() // subscribedCategoryIds
        )).getUser();
    }

    /**
     * Parse a Slack message into title and description.
     * First line (or first sentence) becomes title, rest becomes description.
     */
    private String[] parseSlackMessage(String text) {
        if (Strings.isNullOrEmpty(text)) {
            return new String[]{"Untitled", ""};
        }

        // Convert Slack mrkdwn to markdown first
        String markdown = slackMrkdwnToMarkdown(text);

        // Split by newline
        int newlineIndex = markdown.indexOf('\n');
        if (newlineIndex > 0 && newlineIndex < 200) {
            String title = markdown.substring(0, newlineIndex).trim();
            String description = markdown.substring(newlineIndex + 1).trim();
            return new String[]{title, description};
        }

        // If no newline, use first sentence or first 100 chars
        int periodIndex = markdown.indexOf(". ");
        if (periodIndex > 0 && periodIndex < 200) {
            String title = markdown.substring(0, periodIndex + 1).trim();
            String description = markdown.substring(periodIndex + 2).trim();
            return new String[]{title, description};
        }

        // Use entire text as title if short enough
        if (markdown.length() <= 200) {
            return new String[]{markdown, ""};
        }

        // Truncate for title
        return new String[]{markdown.substring(0, 200) + "...", markdown};
    }

    /**
     * Convert Slack mrkdwn format to standard Markdown.
     */
    private String slackMrkdwnToMarkdown(String mrkdwn) {
        if (Strings.isNullOrEmpty(mrkdwn)) {
            return "";
        }

        String result = mrkdwn;

        // Convert bold: *text* → **text**
        result = result.replaceAll("\\*([^*]+)\\*", "**$1**");

        // Convert italic: _text_ → *text*
        result = result.replaceAll("_([^_]+)_", "*$1*");

        // Convert strikethrough: ~text~ → ~~text~~
        result = result.replaceAll("~([^~]+)~", "~~$1~~");

        // Convert links: <url|text> → [text](url)
        result = result.replaceAll("<(https?://[^|>]+)\\|([^>]+)>", "[$2]($1)");

        // Convert bare links: <url> → url
        result = result.replaceAll("<(https?://[^>]+)>", "$1");

        // Convert user mentions: <@U123> → @user
        result = result.replaceAll("<@([A-Z0-9]+)>", "@$1");

        // Convert channel mentions: <#C123|channel> → #channel
        result = result.replaceAll("<#[A-Z0-9]+\\|([^>]+)>", "#$1");

        return result;
    }

    private String formatPostForSlack(Project project, IdeaModel idea, UserModel author) {
        StringBuilder sb = new StringBuilder();

        // Title
        sb.append("*").append(escapeSlackMrkdwn(idea.getTitle())).append("*\n\n");

        // Description (convert from Quill to text)
        if (!Strings.isNullOrEmpty(idea.getDescriptionAsUnsafeHtml())) {
            String markdown = markdownAndQuillUtil.quillToMarkdown(idea.getDescriptionSanitized(sanitizer));
            sb.append(markdownToSlackMrkdwn(markdown)).append("\n\n");
        }

        // Category and status
        Optional<Category> categoryOpt = project.getCategory(idea.getCategoryId());
        sb.append("📁 ");
        sb.append(categoryOpt.map(Category::getName).orElse("Unknown"));

        if (!Strings.isNullOrEmpty(idea.getStatusId())) {
            categoryOpt.flatMap(cat -> cat.getWorkflow().getStatuses().stream()
                            .filter(s -> idea.getStatusId().equals(s.getStatusId()))
                            .findFirst())
                    .ifPresent(status -> sb.append(" • ").append(status.getName()));
        }

        // Author
        if (author != null) {
            sb.append(" • 👤 ").append(escapeSlackMrkdwn(author.getName()));
        }

        // Link to post
        String postUrl = "https://" + project.getHostname() + "/post/" + idea.getIdeaId();
        sb.append("\n<").append(postUrl).append("|View in ClearFlask>");

        return sb.toString();
    }

    private String formatCommentForSlack(CommentModel comment, UserModel author) {
        StringBuilder sb = new StringBuilder();

        if (author != null) {
            sb.append("💬 *").append(escapeSlackMrkdwn(author.getName())).append("* commented:\n");
        }

        String markdown = markdownAndQuillUtil.quillToMarkdown(comment.getContentSanitized(sanitizer));
        sb.append(markdownToSlackMrkdwn(markdown));

        return sb.toString();
    }

    private String formatResponseForSlack(IdeaModel idea) {
        StringBuilder sb = new StringBuilder();

        sb.append("📢 *Official Response");
        if (!Strings.isNullOrEmpty(idea.getResponseAuthorName())) {
            sb.append(" from ").append(escapeSlackMrkdwn(idea.getResponseAuthorName()));
        }
        sb.append("*:\n");

        String markdown = markdownAndQuillUtil.quillToMarkdown(idea.getResponseSanitized(sanitizer));
        sb.append(markdownToSlackMrkdwn(markdown));

        return sb.toString();
    }

    private String markdownToSlackMrkdwn(String markdown) {
        if (Strings.isNullOrEmpty(markdown)) {
            return "";
        }

        String result = markdown;

        // Convert bold: **text** → *text*
        result = result.replaceAll("\\*\\*([^*]+)\\*\\*", "*$1*");

        // Convert italic: *text* → _text_
        result = result.replaceAll("(?<!\\*)\\*([^*]+)\\*(?!\\*)", "_$1_");

        // Convert strikethrough: ~~text~~ → ~text~
        result = result.replaceAll("~~([^~]+)~~", "~$1~");

        // Convert links: [text](url) → <url|text>
        result = result.replaceAll("\\[([^]]+)]\\(([^)]+)\\)", "<$2|$1>");

        return result;
    }

    private String escapeSlackMrkdwn(String text) {
        if (Strings.isNullOrEmpty(text)) {
            return "";
        }
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    // ===== DynamoDB Operations =====

    private void storeMessageMapping(String projectId, SlackMessageEvent event, String postId) {
        SlackMessageMapping mapping = SlackMessageMapping.builder()
                .projectId(projectId)
                .channelId(event.getChannelId())
                .messageTs(event.getMessageTs())
                .postId(postId)
                .teamId(event.getTeamId())
                .createdEpochMs(Instant.now().toEpochMilli())
                .build();
        messageMappingSchema.table().putItem(messageMappingSchema.toItem(mapping));
    }

    private void storeCommentMapping(String projectId, SlackMessageEvent event, String postId, String commentId) {
        SlackCommentMapping mapping = SlackCommentMapping.builder()
                .projectId(projectId)
                .channelId(event.getChannelId())
                .threadTs(event.getThreadTs())
                .messageTs(event.getMessageTs())
                .postId(postId)
                .commentId(commentId)
                .teamId(event.getTeamId())
                .createdEpochMs(Instant.now().toEpochMilli())
                .build();
        commentMappingSchema.table().putItem(commentMappingSchema.toItem(mapping));
    }

    private Optional<SlackMessageMapping> getMessageMapping(String projectId, String channelId, String messageTs) {
        return Optional.ofNullable(messageMappingSchema.fromItem(
                messageMappingSchema.table().getItem(new GetItemSpec()
                        .withPrimaryKey(messageMappingSchema.primaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "channelId", channelId,
                                "messageTs", messageTs))))));
    }

    private Optional<SlackMessageMapping> getMessageMappingByPostId(String projectId, String postId) {
        return StreamSupport.stream(messageMappingByPostIdSchema.index().query(new QuerySpec()
                                .withHashKey(messageMappingByPostIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(messageMappingByPostIdSchema.rangeKeyName())
                                        .eq(messageMappingByPostIdSchema.rangeValuePartial(Map.of(
                                                "postId", postId)))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(messageMappingByPostIdSchema::fromItem)
                .findFirst();
    }

    private Optional<SlackCommentMapping> getCommentMapping(String projectId, String channelId, String threadTs, String messageTs) {
        return Optional.ofNullable(commentMappingSchema.fromItem(
                commentMappingSchema.table().getItem(new GetItemSpec()
                        .withPrimaryKey(commentMappingSchema.primaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "channelId", channelId,
                                "threadTs", threadTs,
                                "messageTs", messageTs))))));
    }

    private Optional<SlackCommentMapping> getCommentMappingByCommentId(String projectId, String commentId) {
        return StreamSupport.stream(commentMappingByCommentIdSchema.index().query(new QuerySpec()
                                .withHashKey(commentMappingByCommentIdSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(commentMappingByCommentIdSchema.rangeKeyName())
                                        .eq(commentMappingByCommentIdSchema.rangeValuePartial(Map.of(
                                                "commentId", commentId)))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(commentMappingByCommentIdSchema::fromItem)
                .findFirst();
    }

    private <T> ListenableFuture<T> submit(Callable<T> callable) {
        return executor.submit(callable);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(SlackStore.class).to(SlackStoreImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(SlackStoreImpl.class).asEagerSingleton();
            }
        };
    }
}
