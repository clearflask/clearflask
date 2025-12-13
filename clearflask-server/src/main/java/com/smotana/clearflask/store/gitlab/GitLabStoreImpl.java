// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.gitlab;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.util.concurrent.*;
import com.google.gson.Gson;
import com.google.gson.JsonIOException;
import com.google.gson.JsonSyntaxException;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.CommentStore.CommentAndIndexingFuture;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.util.ColorUtil;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.MarkdownAndQuillUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.resource.GitLabResource;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.message.BasicNameValuePair;
import org.gitlab4j.api.GitLabApi;
import org.gitlab4j.api.GitLabApiException;
import org.gitlab4j.api.models.Issue;
import org.gitlab4j.api.models.Label;
import org.gitlab4j.api.models.Note;
import org.gitlab4j.api.models.User;
import org.gitlab4j.api.webhook.IssueEvent;
import org.gitlab4j.api.webhook.NoteEvent;
import org.gitlab4j.api.webhook.ReleaseEvent;

import javax.ws.rs.core.Response;
import java.awt.*;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

@Slf4j
@Singleton
public class GitLabStoreImpl extends ManagedService implements GitLabStore {

    public static final String USER_GUID_GITLAB_PREFIX = "gl-";
    public static final String DEFAULT_GITLAB_URL = "https://gitlab.com";

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        /**
         * Default OAuth client ID for gitlab.com.
         * Users can configure their own for self-hosted instances.
         */
        @DefaultValue("")
        String clientId();

        @DefaultValue("")
        String clientSecret();

        @DefaultValue("P1D")
        Duration authExpiry();
    }

    @Inject
    private Config config;
    @Inject
    private GitLabResource.Config configGitLabResource;
    @Inject
    private Application.Config configApp;
    @Inject
    private Gson gson;
    @Inject
    private GitLabClientProvider gitLabClientProvider;
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
    private ColorUtil colorUtil;
    @Inject
    private Billing billing;
    @Inject
    private NotificationService notificationService;

    private TableSchema<GitLabAuthorization> gitLabAuthorizationSchema;
    private ListeningExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        gitLabAuthorizationSchema = singleTable.parseTableSchema(GitLabAuthorization.class);

        executor = MoreExecutors.listeningDecorator(new ThreadPoolExecutor(
                2, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS, new SynchronousQueue<>(),
                new ThreadFactoryBuilder().setNameFormat("GitLabStoreImpl-worker-%d").build()));
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
    }

    @Extern
    @Override
    public GitLabAvailableProjects getProjectsForUser(String accountId, String code, String gitlabInstanceUrl) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            throw new ApiException(Response.Status.SERVICE_UNAVAILABLE, "GitLab integration is disabled");
        }

        String instanceUrl = Strings.isNullOrEmpty(gitlabInstanceUrl) ? DEFAULT_GITLAB_URL : gitlabInstanceUrl;

        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
            HttpPost reqAuthorize = new HttpPost(instanceUrl + "/oauth/token");
            reqAuthorize.setHeader("Accept", "application/json");
            reqAuthorize.setEntity(new UrlEncodedFormEntity(ImmutableList.of(
                    new BasicNameValuePair("grant_type", "authorization_code"),
                    new BasicNameValuePair("client_id", config.clientId()),
                    new BasicNameValuePair("client_secret", config.clientSecret()),
                    new BasicNameValuePair("redirect_uri", "https://" + configApp.domain() + "/dashboard/settings/project/gitlab"),
                    new BasicNameValuePair("code", code)),
                    Charsets.UTF_8));

            DynamoElasticUserStore.OAuthAuthorizationResponse oAuthResponse;
            try (CloseableHttpResponse res = client.execute(reqAuthorize)) {
                if (res.getStatusLine().getStatusCode() < 200
                        || res.getStatusLine().getStatusCode() > 299) {
                    log.info("GitLab provider failed authorization for projects, url {} response status {}",
                            reqAuthorize.getURI(), res.getStatusLine().getStatusCode());
                    throw new ApiException(Response.Status.FORBIDDEN, "Failed to authorize with GitLab");
                }
                try {
                    oAuthResponse = gson.fromJson(
                            new InputStreamReader(res.getEntity().getContent(), StandardCharsets.UTF_8),
                            DynamoElasticUserStore.OAuthAuthorizationResponse.class);
                } catch (JsonSyntaxException | JsonIOException ex) {
                    log.warn("GitLab provider authorization response cannot parse, url {} response status {}",
                            reqAuthorize.getURI(), res.getStatusLine().getStatusCode(), ex);
                    throw new ApiException(Response.Status.SERVICE_UNAVAILABLE, "Failed to parse GitLab response", ex);
                }
            }

            GitLabApi gitLabApi = new GitLabApi(instanceUrl, oAuthResponse.getAccessToken());
            ImmutableList.Builder<GitLabAvailableProject> projectsBuilder = ImmutableList.builder();
            ImmutableMap.Builder<Long, String> projectIdsBuilder = ImmutableMap.builder();

            // Get projects the user has access to (maintainer or higher for webhook creation)
            for (org.gitlab4j.api.models.Project project : gitLabApi.getProjectApi().getMemberProjects()) {
                projectsBuilder.add(new GitLabAvailableProject(
                        project.getId(),
                        project.getPathWithNamespace(),
                        project.getName()));
                projectIdsBuilder.put(project.getId(), instanceUrl);
            }

            // Store authorization for the fetched projects
            authorizeAccountForProjects(accountId, instanceUrl, projectIdsBuilder.build(),
                    oAuthResponse.getAccessToken(),
                    oAuthResponse.getRefreshToken(),
                    oAuthResponse.getExpiresIn());

            return new GitLabAvailableProjects(projectsBuilder.build());
        } catch (IOException | GitLabApiException ex) {
            throw new ApiException(Response.Status.FORBIDDEN, "Failed to authorize with GitLab", ex);
        }
    }

    private void authorizeAccountForProjects(String accountId, String instanceUrl,
                                              ImmutableMap<Long, String> projectIds,
                                              String accessToken, String refreshToken, Long expiresIn) {
        if (projectIds.isEmpty()) {
            return;
        }
        long expiresAt = expiresIn != null
                ? Instant.now().plusSeconds(expiresIn).getEpochSecond()
                : Instant.now().plus(Duration.ofHours(2)).getEpochSecond();

        Iterables.partition(projectIds.entrySet(), DYNAMO_WRITE_BATCH_MAX_SIZE).forEach(batch -> {
            singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(gitLabAuthorizationSchema.tableName())
                    .withItemsToPut(batch.stream()
                            .map(entry -> new GitLabAuthorization(
                                    accountId,
                                    instanceUrl,
                                    entry.getKey(),
                                    accessToken,
                                    refreshToken != null ? refreshToken : "",
                                    expiresAt,
                                    Instant.now().plus(config.authExpiry()).getEpochSecond()))
                            .map(gitLabAuthorizationSchema::toItem)
                            .collect(ImmutableList.toImmutableList()))));
        });
    }

    @Override
    public void setupConfigGitLabIntegration(String accountId, Optional<ConfigAdmin> configPrevious, ConfigAdmin configAdmin) {
        Optional<GitLab> integrationOpt = Optional.ofNullable(configAdmin.getGitlab());
        Optional<GitLab> integrationPreviousOpt = configPrevious.flatMap(c -> Optional.ofNullable(c.getGitlab()));

        if (integrationOpt.map(GitLab::getProjectId).equals(integrationPreviousOpt.map(GitLab::getProjectId))
                && integrationOpt.map(GitLab::getGitlabInstanceUrl).equals(integrationPreviousOpt.map(GitLab::getGitlabInstanceUrl))
                && (integrationPreviousOpt.flatMap(i -> Optional.ofNullable(Strings.emptyToNull(i.getCreateReleaseWithCategoryId()))).isPresent()
                || integrationOpt.flatMap(i -> Optional.ofNullable(Strings.emptyToNull(i.getCreateReleaseWithCategoryId()))).isEmpty())) {
            return;
        }

        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            throw new ApiException(Response.Status.SERVICE_UNAVAILABLE, "GitLab integration is disabled");
        }

        // Authorize new
        Optional<GitLabAuthorization> authorizationOpt = Optional.empty();
        if (integrationOpt.isPresent()) {
            String instanceUrl = Strings.isNullOrEmpty(integrationOpt.get().getGitlabInstanceUrl())
                    ? DEFAULT_GITLAB_URL : integrationOpt.get().getGitlabInstanceUrl();
            authorizationOpt = Optional.of(getAccountAuthorizationForProject(accountId,
                    instanceUrl,
                    integrationOpt.get().getProjectId())
                    .orElseThrow(() -> new ApiException(Response.Status.UNAUTHORIZED, "Your access to this project is expired, please refresh.")));
        }

        // Uninstall old
        if (integrationPreviousOpt.isPresent()) {
            String instanceUrl = Strings.isNullOrEmpty(integrationPreviousOpt.get().getGitlabInstanceUrl())
                    ? DEFAULT_GITLAB_URL : integrationPreviousOpt.get().getGitlabInstanceUrl();
            removeIntegrationWebhook(
                    configAdmin.getProjectId(),
                    instanceUrl,
                    integrationPreviousOpt.get().getProjectId());
        }

        // Install new
        if (authorizationOpt.isPresent()) {
            String instanceUrl = Strings.isNullOrEmpty(integrationOpt.get().getGitlabInstanceUrl())
                    ? DEFAULT_GITLAB_URL : integrationOpt.get().getGitlabInstanceUrl();
            // Remove first in case it was created previously
            removeIntegrationWebhook(
                    configAdmin.getProjectId(),
                    instanceUrl,
                    integrationOpt.get().getProjectId());
            linkProject(configAdmin.getProjectId(), authorizationOpt.get());
        }
    }

    @Override
    public void removeIntegrationConfig(String projectId) {
        projectStore.getProject(projectId, false)
                .map(Project::getVersionedConfigAdmin)
                .map(versionedConfigAdmin -> versionedConfigAdmin.toBuilder()
                        .config(versionedConfigAdmin.getConfig().toBuilder()
                                .gitlab(null)
                                .build())
                        .build())
                .ifPresent(config -> projectStore.updateConfig(
                        projectId,
                        Optional.empty(),
                        config,
                        true));
    }

    @Override
    public void removeIntegrationWebhook(String projectId, String gitlabInstanceUrl, long gitlabProjectId) {
        try {
            Optional<GitLabAuthorization> authOpt = getAccountAuthorizationForProjectByProjectId(projectId, gitlabInstanceUrl, gitlabProjectId);
            if (authOpt.isEmpty()) {
                log.debug("No authorization found for webhook removal, projectId {} gitlabProjectId {}", projectId, gitlabProjectId);
                return;
            }

            GitLabApi api = new GitLabApi(gitlabInstanceUrl, authOpt.get().getAccessToken());
            URL webhookUrl = getWebhookUrl(projectId, gitlabProjectId);

            for (org.gitlab4j.api.models.ProjectHook hook : api.getProjectApi().getHooks(gitlabProjectId)) {
                if (webhookUrl.toExternalForm().equals(hook.getUrl())) {
                    log.info("Removing GitLab webhook with url {}", webhookUrl);
                    api.getProjectApi().deleteHook(gitlabProjectId, hook.getId());
                }
            }
        } catch (GitLabApiException ex) {
            if (ex.getHttpStatus() == 403) {
                log.info("Failed to remove GitLab webhook, no permission for project {} gitlabProjectId {}",
                        projectId, gitlabProjectId);
                return;
            }
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to remove GitLab webhook", ex);
        } catch (MalformedURLException ex) {
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to construct webhook URL", ex);
        }
    }

    private void linkProject(String projectId, GitLabAuthorization authorization) {
        GitLabApi api = new GitLabApi(authorization.getGitlabInstanceUrl(), authorization.getAccessToken());
        try {
            URL webhookUrl = getWebhookUrl(projectId, authorization.getProjectId());

            org.gitlab4j.api.models.ProjectHook hook = new org.gitlab4j.api.models.ProjectHook();
            hook.setUrl(webhookUrl.toExternalForm());
            hook.setToken(configGitLabResource.webhookSecret());
            hook.setIssuesEvents(true);
            hook.setNoteEvents(true);
            hook.setReleasesEvents(true);
            hook.setEnableSslVerification(true);

            api.getProjectApi().addHook(authorization.getProjectId(), hook);
        } catch (GitLabApiException ex) {
            log.warn("Linking GitLab project failed, could not create webhook. projectId {}, authorization {}",
                    projectId, authorization, ex);
            throw new ApiException(Response.Status.BAD_REQUEST, "Could not create GitLab project webhook", ex);
        } catch (MalformedURLException ex) {
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to construct webhook URL", ex);
        }
    }

    private URL getWebhookUrl(String projectId, long gitlabProjectId) throws MalformedURLException {
        return new URL("https://" + configApp.domain() + "/api" + Application.RESOURCE_VERSION + GitLabResource.WEBHOOK_PATH
                .replace("{projectId}", projectId)
                .replace("{gitlabProjectId}", String.valueOf(gitlabProjectId)));
    }

    private Optional<GitLabAuthorization> getAccountAuthorizationForProject(String accountId, String instanceUrl, long projectId) {
        return Optional.ofNullable(gitLabAuthorizationSchema.fromItem(gitLabAuthorizationSchema.table().getItem(new GetItemSpec()
                        .withPrimaryKey(gitLabAuthorizationSchema.primaryKey(Map.of(
                                "accountId", accountId,
                                "gitlabInstanceUrl", instanceUrl,
                                "projectId", projectId))))))
                .filter(auth -> {
                    if (auth.getTtlInEpochSec() < Instant.now().getEpochSecond()) {
                        log.debug("DynamoDB has an expired auth session with expiry {}", auth.getTtlInEpochSec());
                        return false;
                    }
                    return true;
                });
    }

    private Optional<GitLabAuthorization> getAccountAuthorizationForProjectByProjectId(String cfProjectId, String instanceUrl, long gitlabProjectId) {
        return projectStore.getProject(cfProjectId, false)
                .map(Project::getAccountId)
                .flatMap(accountId -> getAccountAuthorizationForProject(accountId, instanceUrl, gitlabProjectId));
    }

    @Override
    public Optional<IdeaAndIndexingFuture> glIssueEvent(Project project, IssueEvent issueEvent) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Optional.empty();
        }

        GitLab integration = project.getGitLabIntegration().get();
        String ideaId = ideaStore.genDeterministicIdeaIdForGitlabIssue(
                issueEvent.getObjectAttributes().getIid(),
                issueEvent.getObjectAttributes().getId(),
                issueEvent.getProject().getId());

        String action = issueEvent.getObjectAttributes().getAction();
        switch (action != null ? action : "") {
            case "open":
                UserModel user = getCfUserFromGlUser(project.getProjectId(), issueEvent.getUser());
                return Optional.of(ideaStore.createIdeaAndUpvote(new IdeaModel(
                        project.getProjectId(),
                        ideaId,
                        user.getUserId(),
                        user.getName(),
                        user.getIsMod(),
                        Instant.now(),
                        issueEvent.getObjectAttributes().getTitle(),
                        markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gl-new-post", ideaId, issueEvent.getObjectAttributes().getDescription()),
                        null,
                        null,
                        null,
                        null,
                        integration.getCreateWithCategoryId(),
                        Optional.ofNullable(Strings.emptyToNull(integration.getInitialStatusId()))
                                .or(() -> project.getCategory(integration.getCreateWithCategoryId())
                                        .map(Category::getWorkflow)
                                        .flatMap(workflow -> Optional.ofNullable(workflow.getEntryStatus())))
                                .orElse(null),
                        integration.getCreateWithTags() != null
                                ? ImmutableSet.copyOf(integration.getCreateWithTags())
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
                        null, // GitHub URL is null
                        issueEvent.getObjectAttributes().getUrl()))); // GitLab URL
            case "reopen":
            case "close":
                Optional<String> switchToStatusOpt = Optional.ofNullable(integration.getStatusSync())
                        .map("reopen".equals(action)
                                ? GitLabStatusSync::getOpenStatus
                                : GitLabStatusSync::getClosedStatus);
                if (switchToStatusOpt.isPresent()) {
                    Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), ideaId);
                    if (ideaOpt.isPresent() && !switchToStatusOpt.get().equals(ideaOpt.get().getStatusId())) {
                        return Optional.of(ideaStore.updateIdea(project.getProjectId(), ideaId, IdeaUpdateAdmin.builder()
                                .statusId(switchToStatusOpt.get())
                                .build(), Optional.empty()));
                    }
                }
                break;
            case "update":
                boolean updated = false;
                IdeaUpdateAdmin.IdeaUpdateAdminBuilder updateBuilder = IdeaUpdateAdmin.builder();
                // Check if title or description changed
                if (issueEvent.getChanges() != null) {
                    if (issueEvent.getChanges().getTitle() != null) {
                        updateBuilder.title(issueEvent.getObjectAttributes().getTitle());
                        updated = true;
                    }
                    if (issueEvent.getChanges().getDescription() != null) {
                        updateBuilder.description(markdownAndQuillUtil.markdownToQuill(
                                project.getProjectId(), "gl-post", ideaId,
                                issueEvent.getObjectAttributes().getDescription()));
                        updated = true;
                    }
                }
                if (updated) {
                    return Optional.of(ideaStore.updateIdea(project.getProjectId(), ideaId, updateBuilder.build(), Optional.empty()));
                }
                break;
        }

        return Optional.empty();
    }

    @Override
    public Optional<CommentAndIndexingFuture<?>> glNoteEvent(Project project, NoteEvent noteEvent) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Optional.empty();
        }

        GitLab integration = project.getGitLabIntegration().get();
        if (integration.getCommentSync() != Boolean.TRUE) {
            return Optional.empty();
        }

        // Only handle notes on issues
        if (noteEvent.getIssue() == null) {
            return Optional.empty();
        }

        String postId = ideaStore.genDeterministicIdeaIdForGitlabIssue(
                noteEvent.getIssue().getIid(),
                noteEvent.getIssue().getId(),
                noteEvent.getProject().getId());
        String commentId = commentStore.genDeterministicCommentIdForGitlabNote(noteEvent.getObjectAttributes().getId());

        Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), postId);
        if (ideaOpt.isPresent()) {
            UserModel user = getCfUserFromGlUser(project.getProjectId(), noteEvent.getUser());
            return Optional.of(commentStore.createCommentAndUpvote(new CommentModel(
                    project.getProjectId(),
                    postId,
                    commentId,
                    ImmutableList.of(),
                    0,
                    0L,
                    user.getUserId(),
                    user.getName(),
                    user.getIsMod(),
                    Instant.now(),
                    null,
                    markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gl-new-comment", commentId, noteEvent.getObjectAttributes().getNote()),
                    0,
                    0)));
        }

        return Optional.empty();
    }

    @Override
    public Optional<IdeaAndIndexingFuture> glReleaseEvent(Project project, ReleaseEvent releaseEvent) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Optional.empty();
        }

        GitLab integration = project.getGitLabIntegration().get();
        if (Strings.isNullOrEmpty(integration.getCreateReleaseWithCategoryId())) {
            return Optional.empty();
        }

        String ideaId = ideaStore.genDeterministicIdeaIdForGitlabRelease(
                releaseEvent.getId(),
                releaseEvent.getProject().getId());

        String action = releaseEvent.getAction();
        if ("create".equals(action)) {
            Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), ideaId);
            if (ideaOpt.isEmpty()) {
                UserModel user = userStore.createOrGet(
                        project.getProjectId(),
                        USER_GUID_GITLAB_PREFIX + "release",
                        Optional::empty,
                        () -> Optional.of("Release"),
                        false);

                IdeaAndIndexingFuture ideaAndIndexingFuture = ideaStore.createIdeaAndUpvote(new IdeaModel(
                        project.getProjectId(),
                        ideaId,
                        user.getUserId(),
                        user.getName(),
                        user.getIsMod(),
                        Instant.now(),
                        releaseEvent.getName(),
                        markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gl-new-release", ideaId, releaseEvent.getDescription()),
                        null,
                        null,
                        null,
                        null,
                        integration.getCreateReleaseWithCategoryId(),
                        null,
                        ImmutableSet.of(),
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
                        null,
                        releaseEvent.getUrl()));

                if (Boolean.TRUE.equals(integration.getReleaseNotifyAll())) {
                    notificationService.onPostCreated(
                            project,
                            ideaAndIndexingFuture.getIdea(),
                            new NotifySubscribers(
                                    ideaAndIndexingFuture.getIdea().getTitle(),
                                    ideaAndIndexingFuture.getIdea().getDescriptionAsText(sanitizer)),
                            user);
                }
                return Optional.of(ideaAndIndexingFuture);
            }
        }

        return Optional.empty();
    }

    @Override
    public ListenableFuture<Optional<Note>> cfCommentCreatedAsync(Project project, IdeaModel idea, CommentModel comment, UserModel user) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Futures.immediateFuture(Optional.empty());
        }

        Optional<GitLab> integration = project.getGitLabIntegration();
        if (integration.isEmpty() || integration.get().getCommentSync() != Boolean.TRUE) {
            return Futures.immediateFuture(Optional.empty());
        }

        Optional<IdeaStore.GitLabIssueMetadata> gitLabIssueMetadataOpt = getMetadataFromLinkedIdea(project, idea);
        if (gitLabIssueMetadataOpt.isEmpty() || gitLabIssueMetadataOpt.get().getProjectId() != integration.get().getProjectId()) {
            return Futures.immediateFuture(Optional.empty());
        }

        return submit(() -> {
            Optional<CommentModel> parentCommentOpt = comment.getParentCommentIds().isEmpty() ? Optional.empty()
                    : commentStore.getComment(project.getProjectId(), idea.getIdeaId(),
                    comment.getParentCommentIds().get(comment.getParentCommentIds().size() - 1));

            String instanceUrl = Strings.isNullOrEmpty(integration.get().getGitlabInstanceUrl())
                    ? DEFAULT_GITLAB_URL : integration.get().getGitlabInstanceUrl();
            Optional<GitLabAuthorization> authOpt = getAccountAuthorizationForProject(
                    project.getAccountId(), instanceUrl, integration.get().getProjectId());
            if (authOpt.isEmpty()) {
                log.warn("No GitLab authorization found for project {}", project.getProjectId());
                return Optional.empty();
            }

            GitLabClientProvider.GitLabClient client = gitLabClientProvider.getClient(instanceUrl, authOpt.get().getAccessToken());
            if (!client.getRateLimiter().tryAcquire()) {
                return Optional.empty();
            }

            String noteContent = "";
            if (parentCommentOpt.isPresent()) {
                noteContent += markdownAndQuillUtil.markdownQuote(
                        markdownAndQuillUtil.quillToMarkdown(
                                parentCommentOpt.get().getContentSanitized(sanitizer)));
            }
            noteContent += markdownAndQuillUtil.markdownSign(
                    comment.getAuthorName(),
                    "wrote",
                    markdownAndQuillUtil.quillToMarkdown(comment.getContentSanitized(sanitizer)));

            try {
                Note note = client.getApi().getNotesApi().createIssueNote(
                        integration.get().getProjectId(),
                        gitLabIssueMetadataOpt.get().getIssueIid(),
                        noteContent);
                return Optional.of(note);
            } catch (GitLabApiException ex) {
                if (ex.getHttpStatus() == 403) {
                    removeIntegrationConfig(project.getProjectId());
                }
                throw new RuntimeException(ex);
            }
        });
    }

    @Override
    public ListenableFuture<Optional<StatusAndOrResponse>> cfStatusAndOrResponseChangedAsync(Project project, IdeaModel idea, boolean statusChanged, boolean responseChanged) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Futures.immediateFuture(Optional.empty());
        }

        if (!statusChanged && !responseChanged) {
            return Futures.immediateFuture(Optional.empty());
        }

        Optional<GitLab> integration = project.getGitLabIntegration();
        if (integration.isEmpty()) {
            return Futures.immediateFuture(Optional.empty());
        }
        boolean syncStatus = integration.get().getStatusSync() != null;
        boolean syncResponse = integration.get().getResponseSync() == Boolean.TRUE;
        if ((!statusChanged || !syncStatus)
                && (!responseChanged || !syncResponse)) {
            return Futures.immediateFuture(Optional.empty());
        }

        Optional<IdeaStore.GitLabIssueMetadata> gitLabIssueMetadataOpt = getMetadataFromLinkedIdea(project, idea);
        if (gitLabIssueMetadataOpt.isEmpty() || gitLabIssueMetadataOpt.get().getProjectId() != integration.get().getProjectId()) {
            return Futures.immediateFuture(Optional.empty());
        }

        return submit(() -> {
            String instanceUrl = Strings.isNullOrEmpty(integration.get().getGitlabInstanceUrl())
                    ? DEFAULT_GITLAB_URL : integration.get().getGitlabInstanceUrl();
            Optional<GitLabAuthorization> authOpt = getAccountAuthorizationForProject(
                    project.getAccountId(), instanceUrl, integration.get().getProjectId());
            if (authOpt.isEmpty()) {
                log.warn("No GitLab authorization found for project {}", project.getProjectId());
                return Optional.empty();
            }

            GitLabClientProvider.GitLabClient client = gitLabClientProvider.getClient(instanceUrl, authOpt.get().getAccessToken());
            if (!client.getRateLimiter().tryAcquire()) {
                return Optional.empty();
            }

            try {
                Issue glIssue = client.getApi().getIssuesApi().getIssue(
                        integration.get().getProjectId(),
                        gitLabIssueMetadataOpt.get().getIssueIid());

                Optional<Note> responseNoteOpt = Optional.empty();

                if (responseChanged
                        && syncResponse
                        && !Strings.isNullOrEmpty(idea.getResponseAsUnsafeHtml())
                        && !Strings.isNullOrEmpty(idea.getResponseAuthorName())) {
                    Note note = client.getApi().getNotesApi().createIssueNote(
                            integration.get().getProjectId(),
                            gitLabIssueMetadataOpt.get().getIssueIid(),
                            markdownAndQuillUtil.markdownSign(
                                    idea.getResponseAuthorName(),
                                    "wrote",
                                    markdownAndQuillUtil.quillToMarkdown(idea.getResponseSanitized(sanitizer))));
                    responseNoteOpt = Optional.of(note);
                }

                if (statusChanged
                        && syncStatus
                        && !Strings.isNullOrEmpty(idea.getStatusId())) {
                    IdeaStatus statusToSet = project.getStatus(idea.getCategoryId(), idea.getStatusId()).get();

                    // Find or create label
                    Optional<Label> labelOpt = client.getApi().getLabelsApi().getProjectLabels(integration.get().getProjectId())
                            .stream()
                            .filter(label -> statusToSet.getName().equals(label.getName()))
                            .findAny();
                    Label labelToAdd;
                    if (labelOpt.isEmpty()) {
                        labelToAdd = client.getApi().getLabelsApi().createProjectLabel(
                                integration.get().getProjectId(),
                                new Label()
                                        .withName(statusToSet.getName())
                                        .withColor(colorUtil.colorToHex(colorUtil.parseColor(statusToSet.getColor())
                                                .orElse(Color.BLACK)))
                                        .withDescription("Managed by ClearFlask"));
                    } else {
                        labelToAdd = labelOpt.get();
                    }

                    // Update issue labels
                    Set<String> categoryAllStatusNames = project.getCategory(idea.getCategoryId()).get().getWorkflow().getStatuses().stream()
                            .map(IdeaStatus::getName)
                            .collect(Collectors.toSet());
                    List<String> currentLabels = glIssue.getLabels();
                    List<String> newLabels = currentLabels.stream()
                            .filter(label -> !categoryAllStatusNames.contains(label))
                            .collect(Collectors.toList());
                    newLabels.add(labelToAdd.getName());

                    // Update issue with new labels
                    client.getApi().getIssuesApi().updateIssue(
                            integration.get().getProjectId(),
                            gitLabIssueMetadataOpt.get().getIssueIid(),
                            null, null, null, null, null, String.join(",", newLabels),
                            null, null, null);

                    // Handle close/reopen
                    List<String> closedStatuses = Optional.ofNullable(integration.get().getStatusSync().getClosedStatuses()).orElse(ImmutableList.of());
                    if (!closedStatuses.isEmpty()) {
                        boolean shouldBeClosed = closedStatuses.contains(statusToSet.getStatusId());
                        boolean isClosed = "closed".equals(glIssue.getState());
                        if (shouldBeClosed != isClosed) {
                            if (shouldBeClosed) {
                                client.getApi().getIssuesApi().closeIssue(
                                        integration.get().getProjectId(),
                                        gitLabIssueMetadataOpt.get().getIssueIid());
                            } else {
                                client.getApi().getIssuesApi().updateIssue(
                                        integration.get().getProjectId(),
                                        gitLabIssueMetadataOpt.get().getIssueIid(),
                                        null, null, null, null, null, null,
                                        org.gitlab4j.api.Constants.StateEvent.REOPEN, null, null);
                            }
                        }
                    }

                    // Refresh issue after updates
                    glIssue = client.getApi().getIssuesApi().getIssue(
                            integration.get().getProjectId(),
                            gitLabIssueMetadataOpt.get().getIssueIid());
                }

                return Optional.of(new StatusAndOrResponse(glIssue, responseNoteOpt));
            } catch (GitLabApiException ex) {
                if (ex.getHttpStatus() == 403) {
                    removeIntegrationConfig(project.getProjectId());
                }
                throw new RuntimeException(ex);
            }
        });
    }

    private Optional<IdeaStore.GitLabIssueMetadata> getMetadataFromLinkedIdea(Project project, IdeaModel idea) {
        Optional<IdeaStore.GitLabIssueMetadata> gitLabIssueMetadataOpt = ideaStore.extractGitLabIssueFromIdeaId(idea.getIdeaId());
        if (gitLabIssueMetadataOpt.isEmpty()) {
            return Optional.empty();
        }
        Optional<GitLab> gitLabOpt = project.getGitLabIntegration();
        if (gitLabOpt.isEmpty() || gitLabOpt.get().getProjectId() != gitLabIssueMetadataOpt.get().getProjectId()) {
            return Optional.empty();
        }
        return gitLabIssueMetadataOpt;
    }

    private UserModel getCfUserFromGlUser(String projectId, User glUser) {
        return userStore.createOrGet(
                projectId,
                USER_GUID_GITLAB_PREFIX + glUser.getId(),
                () -> Optional.ofNullable(Strings.emptyToNull(glUser.getEmail())),
                () -> Optional.ofNullable(Strings.emptyToNull(glUser.getName())),
                false);
    }

    private <T> ListenableFuture<T> submit(Callable<T> task) {
        return executor.submit(() -> {
            try {
                return task.call();
            } catch (Throwable th) {
                log.warn("Failed to complete GitLab Integration task", th);
                throw th;
            }
        });
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(GitLabStore.class).to(GitLabStoreImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(GitLabStoreImpl.class).asEagerSingleton();
            }
        };
    }
}
