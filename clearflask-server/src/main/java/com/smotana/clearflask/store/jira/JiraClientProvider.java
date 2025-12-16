// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.jira;

import com.google.common.collect.ImmutableList;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Provider for Jira REST API client operations.
 * Handles authentication, token refresh, and API calls.
 */
public interface JiraClientProvider {

    /**
     * Exchange OAuth authorization code for access and refresh tokens.
     *
     * @param code        Authorization code from OAuth callback
     * @param redirectUri The redirect URI used in the OAuth flow
     * @return OAuth tokens
     */
    OAuthTokens exchangeAuthorizationCode(String code, String redirectUri) throws IOException;

    /**
     * Refresh an expired access token using the refresh token.
     *
     * @param refreshToken The refresh token
     * @return New OAuth tokens
     */
    OAuthTokens refreshAccessToken(String refreshToken) throws IOException;

    /**
     * Get accessible Jira resources (sites/instances) for the authenticated user.
     *
     * @param accessToken OAuth access token
     * @return List of accessible Jira cloud instances
     */
    ImmutableList<JiraCloudInstance> getAccessibleResources(String accessToken) throws IOException;

    /**
     * Get a Jira client for a specific cloud instance.
     *
     * @param cloudId     Jira Cloud instance ID
     * @param accessToken OAuth access token
     * @return Jira client instance with rate limiter
     */
    JiraClient getClient(String cloudId, String accessToken);

    // ==================== Data classes ====================

    @Value
    @Builder
    class OAuthTokens {
        @NonNull String accessToken;
        @NonNull String refreshToken;
        long expiresIn;  // seconds until expiration
        String scope;
    }

    @Value
    @Builder
    class JiraCloudInstance {
        @NonNull String id;  // Cloud ID (UUID)
        @NonNull String url;  // e.g., https://your-domain.atlassian.net
        @NonNull String name;  // Display name
        ImmutableList<String> scopes;
    }

    @Value
    class JiraClient {
        @NonNull JiraApiClient apiClient;
        @NonNull ActionRateLimiter rateLimiter;
    }

    interface ActionRateLimiter {
        boolean tryAcquire();
    }

    /**
     * Jira REST API client for a specific cloud instance.
     */
    interface JiraApiClient {
        String getCloudId();

        String getBaseUrl();

        // Project operations
        ImmutableList<JiraProject> getProjects() throws IOException;

        JiraProject getProject(String projectKey) throws IOException;

        // Issue operations
        JiraIssue getIssue(String issueKey) throws IOException;

        JiraIssue createIssue(CreateIssueRequest request) throws IOException;

        JiraIssue updateIssue(String issueKey, UpdateIssueRequest request) throws IOException;

        void deleteIssue(String issueKey) throws IOException;

        void transitionIssue(String issueKey, String transitionId) throws IOException;

        ImmutableList<JiraTransition> getTransitions(String issueKey) throws IOException;

        // Comment operations
        ImmutableList<JiraComment> getComments(String issueKey) throws IOException;

        JiraComment addComment(String issueKey, String body) throws IOException;

        JiraComment updateComment(String issueKey, String commentId, String body) throws IOException;

        void deleteComment(String issueKey, String commentId) throws IOException;

        // Webhook operations
        JiraWebhookRegistration registerWebhook(RegisterWebhookRequest request) throws IOException;

        void deleteWebhook(String webhookId) throws IOException;

        ImmutableList<JiraWebhookRegistration> getWebhooks() throws IOException;

        // Issue types
        ImmutableList<JiraIssueType> getIssueTypes(String projectKey) throws IOException;

        // Statuses
        ImmutableList<JiraStatus> getStatuses(String projectKey) throws IOException;
    }

    // ==================== Request/Response models ====================

    @Value
    @Builder
    class JiraProject {
        @NonNull String id;
        @NonNull String key;
        @NonNull String name;
        String description;
        String projectTypeKey;
        String avatarUrl;
    }

    @Value
    @Builder
    class JiraIssue {
        @NonNull String id;
        @NonNull String key;
        @NonNull String self;  // API URL
        String summary;
        String description;  // ADF format JSON string
        JiraStatus status;
        JiraIssueType issueType;
        JiraPriority priority;
        JiraUser reporter;
        JiraUser assignee;
        String created;
        String updated;
    }

    @Value
    @Builder
    class JiraComment {
        @NonNull String id;
        @NonNull String self;
        String body;  // ADF format JSON string
        JiraUser author;
        String created;
        String updated;
    }

    @Value
    @Builder
    class JiraUser {
        @NonNull String accountId;
        String displayName;
        String emailAddress;
        String avatarUrl;
    }

    @Value
    @Builder
    class JiraStatus {
        @NonNull String id;
        @NonNull String name;
        String description;
        String statusCategory;  // "new", "indeterminate", "done"
    }

    @Value
    @Builder
    class JiraIssueType {
        @NonNull String id;
        @NonNull String name;
        String description;
        boolean subtask;
        String iconUrl;
    }

    @Value
    @Builder
    class JiraPriority {
        @NonNull String id;
        @NonNull String name;
        String iconUrl;
    }

    @Value
    @Builder
    class JiraTransition {
        @NonNull String id;
        @NonNull String name;
        JiraStatus to;
    }

    @Value
    @Builder
    class CreateIssueRequest {
        @NonNull String projectKey;
        @NonNull String issueTypeId;
        @NonNull String summary;
        String description;  // ADF format JSON
        String priorityId;
        Map<String, Object> customFields;
    }

    @Value
    @Builder
    class UpdateIssueRequest {
        String summary;
        String description;  // ADF format JSON
        String priorityId;
        Map<String, Object> customFields;
    }

    @Value
    @Builder
    class RegisterWebhookRequest {
        @NonNull String url;
        @NonNull List<String> events;  // e.g., ["jira:issue_created", "comment_created"]
        List<String> filters;  // JQL filters
        String name;
    }

    @Value
    @Builder
    class JiraWebhookRegistration {
        @NonNull String id;
        @NonNull String url;
        ImmutableList<String> events;
        String name;
        boolean enabled;
    }
}
