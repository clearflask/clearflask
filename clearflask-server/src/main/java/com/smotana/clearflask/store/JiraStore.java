// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.AvailableJiraProjects;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.store.CommentStore.CommentAndIndexingFuture;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraComment;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraIssue;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.util.Optional;

import static io.dataspray.singletable.TableType.Primary;

/**
 * Store interface for Jira integration, following the same patterns as GitHubStore.
 * Provides two-way sync between ClearFlask posts and Jira issues.
 */
public interface JiraStore {

    /**
     * Get available Jira projects for a user after OAuth authorization.
     *
     * @param accountId ClearFlask account ID
     * @param code      OAuth authorization code
     * @return List of available Jira projects the user can link
     */
    AvailableJiraProjects getProjectsForUser(String accountId, String code);

    /**
     * Set up or update the Jira integration configuration for a project.
     * This will register webhooks and store authorization.
     *
     * @param accountId      ClearFlask account ID
     * @param configPrevious Previous configuration (if updating)
     * @param configAdmin    New configuration
     */
    void setupConfigJiraIntegration(String accountId, Optional<ConfigAdmin> configPrevious, ConfigAdmin configAdmin);

    /**
     * Remove Jira integration configuration for a project.
     *
     * @param projectId ClearFlask project ID
     */
    void removeIntegrationConfig(String projectId);

    /**
     * Remove the webhook registered with Jira.
     *
     * @param projectId      ClearFlask project ID
     * @param cloudId        Jira Cloud instance ID
     * @param jiraProjectKey Jira project key
     */
    void removeIntegrationWebhook(String projectId, String cloudId, String jiraProjectKey);

    // ==================== Jira → ClearFlask (webhook handlers) ====================

    /**
     * Handle Jira issue webhook event (created, updated, deleted).
     *
     * @param project ClearFlask project
     * @param event   Jira issue event payload
     * @return Created/updated idea if applicable
     */
    Optional<IdeaAndIndexingFuture> jiraIssueEvent(Project project, JiraIssueEvent event);

    /**
     * Handle Jira comment webhook event (created, updated, deleted).
     *
     * @param project ClearFlask project
     * @param event   Jira comment event payload
     * @return Created/updated comment if applicable
     */
    Optional<CommentAndIndexingFuture<?>> jiraCommentEvent(Project project, JiraCommentEvent event);

    // ==================== ClearFlask → Jira ====================

    /**
     * Sync a newly created ClearFlask post to Jira (create issue).
     *
     * @param project ClearFlask project
     * @param idea    The created idea/post
     * @param user    User who created the post
     * @return Future containing the created Jira issue
     */
    ListenableFuture<Optional<JiraIssue>> cfPostCreatedAsync(Project project, IdeaModel idea, UserModel user);

    /**
     * Sync a ClearFlask comment to Jira.
     *
     * @param project ClearFlask project
     * @param idea    The parent idea/post
     * @param comment The created comment
     * @param user    User who created the comment
     * @return Future containing the created Jira comment
     */
    ListenableFuture<Optional<JiraComment>> cfCommentCreatedAsync(Project project, IdeaModel idea, CommentModel comment, UserModel user);

    /**
     * Sync status and/or response changes to Jira.
     *
     * @param project         ClearFlask project
     * @param idea            The idea with changes
     * @param statusChanged   Whether status was changed
     * @param responseChanged Whether response was changed
     * @return Future containing the sync result
     */
    ListenableFuture<Optional<JiraStatusAndOrResponse>> cfStatusAndOrResponseChangedAsync(Project project, IdeaModel idea, boolean statusChanged, boolean responseChanged);

    // ==================== Helper methods ====================

    /**
     * Generate a deterministic ClearFlask idea ID for a Jira issue.
     * Format: "jira-{issueKey}-{cloudId}"
     *
     * @param issueKey Jira issue key (e.g., "PROJ-123")
     * @param cloudId  Jira Cloud instance ID
     * @return Deterministic idea ID
     */
    default String genDeterministicIdeaIdForJiraIssue(String issueKey, String cloudId) {
        return "jira-" + issueKey + "-" + cloudId;
    }

    /**
     * Generate a deterministic ClearFlask comment ID for a Jira comment.
     * Format: "jira-{commentId}-{cloudId}"
     *
     * @param commentId Jira comment ID
     * @param cloudId   Jira Cloud instance ID
     * @return Deterministic comment ID
     */
    default String genDeterministicCommentIdForJiraComment(String commentId, String cloudId) {
        return "jira-" + commentId + "-" + cloudId;
    }

    // ==================== Event classes ====================

    @Value
    @Builder
    class JiraIssueEvent {
        @NonNull String webhookEvent;  // jira:issue_created, jira:issue_updated, jira:issue_deleted
        @NonNull String issueKey;
        @NonNull String issueId;
        String summary;
        String description;  // ADF format JSON
        String status;
        String issueType;
        String priority;
        String reporterAccountId;
        String reporterDisplayName;
        String reporterEmail;
        String issueUrl;
    }

    @Value
    @Builder
    class JiraCommentEvent {
        @NonNull String webhookEvent;  // comment_created, comment_updated, comment_deleted
        @NonNull String issueKey;
        @NonNull String commentId;
        String body;  // ADF format JSON
        String authorAccountId;
        String authorDisplayName;
        String authorEmail;
    }

    @Value
    class JiraStatusAndOrResponse {
        @NonNull JiraIssue issue;
        @NonNull Optional<JiraComment> responseCommentOpt;
    }

    // ==================== DynamoDB models ====================

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "accountId", rangePrefix = "jiraAuth", rangeKeys = "cloudId")
    class JiraAuthorization {
        @NonNull
        String accountId;

        @NonNull
        String cloudId;

        @NonNull
        String accessToken;

        @NonNull
        String refreshToken;

        @NonNull
        long ttlInEpochSec;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "projectId", rangePrefix = "jiraWebhook", rangeKeys = "cloudId")
    class JiraWebhook {
        @NonNull
        String projectId;

        @NonNull
        String cloudId;

        @NonNull
        String webhookId;

        @NonNull
        String jiraProjectKey;
    }
}
