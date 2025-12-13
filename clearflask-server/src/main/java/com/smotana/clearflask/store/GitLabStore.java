// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.GitLabAvailableProjects;
import com.smotana.clearflask.store.CommentStore.CommentAndIndexingFuture;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import org.gitlab4j.api.models.Issue;
import org.gitlab4j.api.webhook.IssueEvent;
import org.gitlab4j.api.webhook.NoteEvent;
import org.gitlab4j.api.webhook.ReleaseEvent;

import java.util.Optional;

import static io.dataspray.singletable.TableType.Primary;

public interface GitLabStore {

    /**
     * Get available GitLab projects for the user after OAuth authorization.
     *
     * @param accountId The account ID
     * @param code OAuth authorization code
     * @param gitlabInstanceUrl GitLab instance URL (e.g., https://gitlab.com or self-hosted)
     * @return Available projects
     */
    GitLabAvailableProjects getProjectsForUser(String accountId, String code, String gitlabInstanceUrl);

    /**
     * Setup GitLab integration configuration for a project.
     */
    void setupConfigGitLabIntegration(String accountId, Optional<ConfigAdmin> configPrevious, ConfigAdmin configAdmin);

    /**
     * Remove GitLab integration configuration from a project.
     */
    void removeIntegrationConfig(String projectId);

    /**
     * Remove GitLab webhook from a project.
     */
    void removeIntegrationWebhook(String projectId, String gitlabInstanceUrl, long gitlabProjectId);

    /**
     * Handle GitLab issue event from webhook.
     */
    Optional<IdeaAndIndexingFuture> glIssueEvent(Project project, IssueEvent issueEvent);

    /**
     * Handle GitLab note (comment) event from webhook.
     */
    Optional<CommentAndIndexingFuture<?>> glNoteEvent(Project project, NoteEvent noteEvent);

    /**
     * Handle GitLab release event from webhook.
     */
    Optional<IdeaAndIndexingFuture> glReleaseEvent(Project project, ReleaseEvent releaseEvent);

    /**
     * Async handler for ClearFlask comment created - posts to GitLab.
     */
    ListenableFuture<Optional<org.gitlab4j.api.models.Note>> cfCommentCreatedAsync(Project project, IdeaModel idea, CommentModel comment, UserModel user);

    /**
     * Async handler for ClearFlask status/response changed - updates GitLab issue.
     */
    ListenableFuture<Optional<StatusAndOrResponse>> cfStatusAndOrResponseChangedAsync(Project project, IdeaModel idea, boolean statusChanged, boolean responseChanged);

    @Value
    class StatusAndOrResponse {
        @NonNull
        Issue issue;
        @NonNull
        Optional<org.gitlab4j.api.models.Note> responseNoteOpt;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "accountId", rangePrefix = "gitlabAuth", rangeKeys = {"gitlabInstanceUrl", "projectId"})
    class GitLabAuthorization {
        @NonNull
        String accountId;

        @NonNull
        String gitlabInstanceUrl;

        @NonNull
        long projectId;

        @NonNull
        String accessToken;

        @NonNull
        String refreshToken;

        @NonNull
        long expiresAt;

        @NonNull
        long ttlInEpochSec;
    }
}
