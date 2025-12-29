// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.SlackChannelLink;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.CommentStore.CommentAndIndexingFuture;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.util.List;
import java.util.Optional;

import static io.dataspray.singletable.TableType.Gsi;
import static io.dataspray.singletable.TableType.Primary;

/**
 * Handles two-way synchronization between ClearFlask and Slack.
 * <p>
 * Outbound (ClearFlask → Slack):
 * - New posts → Slack channel messages
 * - New comments → Slack thread replies
 * - Post status changes → Slack message updates
 * - Admin responses → Slack thread replies
 * <p>
 * Inbound (Slack → ClearFlask):
 * - New channel messages → ClearFlask posts
 * - Thread replies → ClearFlask comments
 * - Message edits → Post/comment updates
 * - Message deletions → Post/comment deletions
 */
public interface SlackStore {

    // ===== Configuration =====

    /**
     * Exchange OAuth code for Slack workspace access.
     * Stores the authorization and returns available workspace info and channels.
     *
     * @param accountId The account ID connecting the workspace
     * @param code OAuth authorization code from Slack
     * @return Workspace information including teamId, teamName, and available channels
     */
    SlackWorkspaceInfo getWorkspaceInfoForUser(String accountId, String code);

    /**
     * Get available Slack channels that can be linked.
     */
    List<SlackChannel> getAvailableChannels(String projectId);

    /**
     * Get the project ID associated with a Slack team ID.
     * Used by webhooks to route events to the correct project.
     *
     * @param teamId Slack team/workspace ID
     * @return Optional projectId if mapping exists
     */
    Optional<String> getProjectIdByTeamId(String teamId);

    /**
     * Setup Slack integration when project config is updated.
     */
    void setupConfigSlackIntegration(String accountId, Optional<ConfigAdmin> configPrevious, ConfigAdmin configAdmin);

    /**
     * Remove Slack integration from a project.
     */
    void removeIntegration(String projectId);

    // ===== Inbound: Slack → ClearFlask (Webhook handlers) =====

    /**
     * Handle new message in a linked Slack channel.
     * Creates a new ClearFlask post if syncSlackToPosts is enabled.
     */
    Optional<IdeaAndIndexingFuture> slackMessageCreated(Project project, SlackMessageEvent event);

    /**
     * Handle thread reply in Slack.
     * Creates a ClearFlask comment if syncRepliesToComments is enabled.
     */
    Optional<CommentAndIndexingFuture<?>> slackReplyCreated(Project project, SlackMessageEvent event);

    /**
     * Handle message edited in Slack.
     * Updates the corresponding post or comment.
     */
    void slackMessageEdited(Project project, SlackMessageEvent event);

    /**
     * Handle message deleted in Slack.
     * Marks the corresponding post or comment as deleted.
     */
    void slackMessageDeleted(Project project, SlackMessageEvent event);

    // ===== Outbound: ClearFlask → Slack (Async) =====

    /**
     * Post created in ClearFlask → send message to Slack channel.
     * Only sends if syncPostsToSlack is enabled for the category's channel link.
     */
    ListenableFuture<Optional<SlackMessageResult>> cfPostCreatedAsync(Project project, IdeaModel idea, UserModel author);

    /**
     * Comment created in ClearFlask → send thread reply to Slack.
     * Only sends if syncCommentsToReplies is enabled for the category's channel link.
     */
    ListenableFuture<Optional<SlackMessageResult>> cfCommentCreatedAsync(Project project, IdeaModel idea, CommentModel comment, UserModel author);

    /**
     * Comment updated in ClearFlask → update Slack message or post new reply.
     * If we have the mapping, updates the Slack message. Otherwise posts a new reply saying the comment was updated.
     * Only updates if syncCommentsToReplies is enabled for the category's channel link.
     */
    ListenableFuture<Optional<SlackMessageResult>> cfCommentUpdatedAsync(Project project, IdeaModel idea, CommentModel comment, UserModel author);

    /**
     * Post status changed → update Slack message.
     * Only updates if syncStatusUpdates is enabled for the category's channel link.
     */
    ListenableFuture<Optional<SlackMessageResult>> cfPostStatusChangedAsync(Project project, IdeaModel idea);

    /**
     * Admin response added → post as thread reply in Slack.
     * Only sends if syncResponseUpdates is enabled for the category's channel link.
     */
    ListenableFuture<Optional<SlackMessageResult>> cfResponseChangedAsync(Project project, IdeaModel idea);

    // ===== Models =====

    @Value
    @Builder
    class SlackWorkspaceInfo {
        @NonNull
        String teamId;
        @NonNull
        String teamName;
        @NonNull
        String accessToken;
        @NonNull
        String botUserId;
        @NonNull
        List<SlackChannel> channels;
    }

    @Value
    class SlackChannel {
        String channelId;
        String channelName;
        boolean isPrivate;
        boolean isMember;
    }

    @Value
    class SlackMessageEvent {
        String teamId;
        String channelId;
        String userId;           // Slack user ID
        String messageTs;        // Message timestamp (unique ID)
        String threadTs;         // Thread timestamp (null for top-level messages)
        String text;             // Message text
        String eventType;        // message, message_changed, message_deleted
        String subtype;          // null for regular messages, bot_message, etc.
    }

    @Value
    class SlackMessageResult {
        String channelId;
        String messageTs;
        String threadTs;
    }

    /**
     * Mapping between Slack messages and ClearFlask posts.
     * Enables bidirectional sync by tracking which Slack message corresponds to which post.
     */
    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "projectId", rangePrefix = "slackMsg", rangeKeys = {"channelId", "messageTs"})
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "projectId", rangePrefix = "slackMsgByPost", rangeKeys = "postId")
    class SlackMessageMapping {
        @NonNull
        String projectId;

        @NonNull
        String channelId;

        @NonNull
        String messageTs;

        @NonNull
        String postId;

        @NonNull
        String teamId;

        @NonNull
        Long createdEpochMs;

        Long lastSyncedEpochMs;
    }

    /**
     * Mapping between Slack thread replies and ClearFlask comments.
     */
    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "projectId", rangePrefix = "slackReply", rangeKeys = {"channelId", "threadTs", "messageTs"})
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "projectId", rangePrefix = "slackReplyByComment", rangeKeys = "commentId")
    class SlackCommentMapping {
        @NonNull
        String projectId;

        @NonNull
        String channelId;

        @NonNull
        String threadTs;

        @NonNull
        String messageTs;

        @NonNull
        String postId;

        @NonNull
        String commentId;

        @NonNull
        String teamId;

        @NonNull
        Long createdEpochMs;
    }

    /**
     * Mapping between Slack team ID and ClearFlask project.
     * Used to quickly look up which project a webhook event belongs to without scanning all projects.
     */
    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "teamId", rangePrefix = "slackTeam")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "accountId", rangePrefix = "slackTeamByAccount", rangeKeys = "projectId")
    class SlackTeamMapping {
        @NonNull
        String teamId;

        @NonNull
        String accountId;

        @NonNull
        String projectId;

        @NonNull
        Long updatedEpochMs;
    }
}
