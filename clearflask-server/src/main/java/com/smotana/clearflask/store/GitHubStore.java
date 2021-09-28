// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store;

import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.AvailableRepos;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.store.CommentStore.CommentAndIndexingFuture;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import org.kohsuke.github.GHEventPayload;
import org.kohsuke.github.GHIssue;
import org.kohsuke.github.GHIssueComment;

import java.io.IOException;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface GitHubStore {
    AvailableRepos getReposForUser(String accountId, String code);

    void setupConfigGitHubIntegration(String accountId, Optional<ConfigAdmin> configPrevious, ConfigAdmin configAdmin);

    void unlinkRepository(String projectId, long repositoryId, boolean updateConfig, boolean removeWebhook);

    Optional<IdeaAndIndexingFuture> ghIssueEvent(Project project, GHEventPayload.Issue ghIssue) throws IOException;

    Optional<CommentAndIndexingFuture<?>> ghIssueCommentEvent(Project project, GHEventPayload.IssueComment ghIssueComment, String payload) throws IOException;

    ListenableFuture<Optional<GHIssueComment>> cfCommentCreatedAsync(Project project, IdeaModel idea, CommentModel comment, UserModel user);

    ListenableFuture<Optional<StatusAndOrResponse>> cfStatusAndOrResponseChangedAsync(Project project, IdeaModel idea, boolean statusChanged, boolean responseChanged);

    @Value
    class StatusAndOrResponse {
        @NonNull
        private GHIssue issue;
        @NonNull
        private Optional<GHIssueComment> responseCommentOpt;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "accountId", rangePrefix = "githubAuth", rangeKeys = "repositoryId")
    class GitHubAuthorization {
        @NonNull
        String accountId;

        @NonNull
        long installationId;

        @NonNull
        long repositoryId;

        @NonNull
        long ttlInEpochSec;
    }
}
