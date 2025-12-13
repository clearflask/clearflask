// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.github;

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
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
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
import com.smotana.clearflask.web.resource.GitHubResource;
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
import org.kohsuke.github.*;
import org.kohsuke.github.GHEventPayload.Issue;
import org.kohsuke.github.GitHub;
import org.kohsuke.github.GHEventPayload.IssueComment;

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
public class GitHubStoreImpl extends ManagedService implements GitHubStore {

    public final static String USER_GUID_GITHUB_PREFIX = "gh-";

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("Iv1.4c1c98e9e6c71cae")
        String clientId();

        @DefaultValue("")
        String clientSecret();

        @DefaultValue("P1D")
        Duration authExpiry();
    }

    @Inject
    private Config config;
    @Inject
    private GitHubResource.Config configGitHubResource;
    @Inject
    private Application.Config configApp;
    @Inject
    private Gson gson;
    @Inject
    private GitHubClientProvider gitHubClientProvider;
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

    private final JsonPath changesNameJsonPath = JsonPath.compile("changes.name");
    private final JsonPath changesBodyJsonPath = JsonPath.compile("changes.body");
    private TableSchema<GitHubAuthorization> gitHubAuthorizationSchema;
    private ListeningExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        gitHubAuthorizationSchema = singleTable.parseTableSchema(GitHubAuthorization.class);

        executor = MoreExecutors.listeningDecorator(new ThreadPoolExecutor(
                2, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS, new SynchronousQueue<>(),
                new ThreadFactoryBuilder().setNameFormat("GitHubStoreImpl-worker-%d").build()));
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
    }

    @Extern
    @Override
    public AvailableRepos getReposForUser(String accountId, String code) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            throw new ApiException(Response.Status.SERVICE_UNAVAILABLE, "GitHub integration is disabled");
        }
        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
            HttpPost reqAuthorize = new HttpPost("https://github.com/login/oauth/access_token");
            reqAuthorize.setHeader("Accept", "application/json");
            reqAuthorize.setEntity(new UrlEncodedFormEntity(ImmutableList.of(
                    new BasicNameValuePair("grant_type", "authorization_code"),
                    new BasicNameValuePair("client_id", config.clientId()),
                    new BasicNameValuePair("client_secret", config.clientSecret()),
                    new BasicNameValuePair("redirect_uri", "https://" + configApp.domain() + "/dashboard/settings/project/github"),
                    new BasicNameValuePair("code", code)),
                    Charsets.UTF_8));
            DynamoElasticUserStore.OAuthAuthorizationResponse oAuthAuthorizationResponse;
            try (CloseableHttpResponse res = client.execute(reqAuthorize)) {
                if (res.getStatusLine().getStatusCode() < 200
                        || res.getStatusLine().getStatusCode() > 299) {
                    log.info("GitHub provider failed authorization for repos, url {} response status {}",
                            reqAuthorize.getURI(), res.getStatusLine().getStatusCode());
                    throw new ApiException(Response.Status.FORBIDDEN, "Failed to authorize");
                }
                try {
                    oAuthAuthorizationResponse = gson.fromJson(new InputStreamReader(res.getEntity().getContent(), StandardCharsets.UTF_8), DynamoElasticUserStore.OAuthAuthorizationResponse.class);
                } catch (JsonSyntaxException | JsonIOException ex) {
                    log.warn("GitHub provider authorization response cannot parse, url {} response status {}",
                            reqAuthorize.getURI(), res.getStatusLine().getStatusCode(), ex);
                    throw new ApiException(Response.Status.SERVICE_UNAVAILABLE, "Failed to fetch", ex);
                }
            }
            GitHub userClient = gitHubClientProvider.getOauthClient(oAuthAuthorizationResponse.getAccessToken());
            ImmutableMap.Builder<Long, Long> repositoryAndInstallationIdsBuilder = ImmutableMap.builder();
            ImmutableList.Builder<AvailableRepo> availableReposBuilder = ImmutableList.builder();
            for (GHAppInstallation installation : userClient.getMyself().getAppInstallations()) {
                GitHub installationClient = gitHubClientProvider.getInstallationClient(installation.getId()).getClient();
                GitHubClientUtil.setRoot(installation, installationClient);
                for (GHRepository repository : installation.listRepositories()) {
                    availableReposBuilder.add(new AvailableRepo(
                            installation.getId(),
                            repository.getId(),
                            repository.getFullName()));
                    repositoryAndInstallationIdsBuilder.put(
                            repository.getId(),
                            installation.getId());
                }
            }
            authorizeAccountForRepos(accountId, repositoryAndInstallationIdsBuilder.build());
            return new AvailableRepos(availableReposBuilder.build());
        } catch (IOException ex) {
            throw new ApiException(Response.Status.FORBIDDEN, "Failed to authorize", ex);
        }
    }

    private void authorizeAccountForRepos(String accountId, ImmutableMap<Long, Long> repositoryAndInstallationIds) {
        if (repositoryAndInstallationIds.isEmpty()) {
            return;
        }
        Iterables.partition(repositoryAndInstallationIds.entrySet(), DYNAMO_WRITE_BATCH_MAX_SIZE).forEach(batch -> {
            singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(gitHubAuthorizationSchema.tableName())
                    .withItemsToPut(batch.stream()
                            .map(entry -> new GitHubAuthorization(
                                    accountId,
                                    entry.getValue(),
                                    entry.getKey(),
                                    Instant.now().plus(config.authExpiry()).getEpochSecond()))
                            .map(gitHubAuthorizationSchema::toItem)
                            .collect(ImmutableList.toImmutableList()))));
        });
    }

    @Override
    public void setupConfigGitHubIntegration(String accountId, Optional<ConfigAdmin> configPrevious, ConfigAdmin configAdmin) {
        Optional<com.smotana.clearflask.api.model.GitHub> integrationOpt = Optional.ofNullable(configAdmin.getGithub());
        Optional<com.smotana.clearflask.api.model.GitHub> integrationPreviousOpt = configPrevious.flatMap(c -> Optional.ofNullable(c.getGithub()));


        if (integrationOpt.map(com.smotana.clearflask.api.model.GitHub::getInstallationId).equals(integrationPreviousOpt.map(com.smotana.clearflask.api.model.GitHub::getInstallationId))
                && integrationOpt.map(com.smotana.clearflask.api.model.GitHub::getRepositoryId).equals(integrationPreviousOpt.map(com.smotana.clearflask.api.model.GitHub::getRepositoryId))
                // Also update webhook if we enabled Releases since we need to update the webhook event list
                && (integrationPreviousOpt.flatMap(i -> Optional.ofNullable(Strings.emptyToNull(i.getCreateReleaseWithCategoryId()))).isPresent()
                || integrationOpt.flatMap(i -> Optional.ofNullable(Strings.emptyToNull(i.getCreateReleaseWithCategoryId()))).isEmpty())) {
            return;
        }

        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            throw new ApiException(Response.Status.SERVICE_UNAVAILABLE, "GitHub integration is disabled");
        }

        // Authorize new
        Optional<GitHubAuthorization> authorizationOpt = Optional.empty();
        if (integrationOpt.isPresent()) {
            authorizationOpt = Optional.of(getAccountAuthorizationForRepo(accountId,
                    integrationOpt.get().getRepositoryId(),
                    integrationOpt.get().getInstallationId())
                    .orElseThrow(() -> new ApiException(Response.Status.UNAUTHORIZED, "Your access to this repository is expired, please refresh.")));
        }

        // Uninstall old
        if (integrationPreviousOpt.isPresent()) {
            removeIntegrationWebhook(
                    configAdmin.getProjectId(),
                    integrationPreviousOpt.get().getInstallationId(),
                    integrationPreviousOpt.get().getRepositoryId());
        }

        // Install new
        if (authorizationOpt.isPresent()) {
            // Remove first in case it was created previously
            removeIntegrationWebhook(
                    configAdmin.getProjectId(),
                    integrationOpt.get().getInstallationId(),
                    integrationOpt.get().getRepositoryId());
            linkRepository(configAdmin.getProjectId(), authorizationOpt.get());
        }
    }

    @Override
    public void removeIntegrationConfig(String projectId) {
        projectStore.getProject(projectId, false)
                .map(Project::getVersionedConfigAdmin)
                .map(versionedConfigAdmin -> versionedConfigAdmin.toBuilder()
                        .config(versionedConfigAdmin.getConfig().toBuilder()
                                .github(null)
                                .build())
                        .build())
                .ifPresent(config -> projectStore.updateConfig(
                        projectId,
                        Optional.empty(),
                        config,
                        true));
    }

    @Override
    public void removeIntegrationWebhook(String projectId, long installationId, long repositoryId) {
        try {
            GHRepository repository = gitHubClientProvider.getInstallationClient(installationId)
                    .getClient()
                    .getRepositoryById(repositoryId);
            URL webhookUrl = getWebhookUrl(projectId, installationId, repositoryId);
            for (GHHook hook : repository.getHooks()) {
                if (!webhookUrl.toExternalForm().equals(hook.getConfig().get("url"))) {
                    continue;
                }
                log.info("Removing webhook with url {}", webhookUrl);
                hook.delete();
            }
        } catch (HttpException ex) {
            if (ex.getResponseCode() == 403) {
                log.info("Failed to remove webhook, no permission to do so for project {} installation {} repository {}",
                        projectId, installationId, repositoryId);
                return;
            }
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to remove webhook", ex);
        } catch (IOException ex) {
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to remove webhook", ex);
        }
    }

    private void linkRepository(String projectId, GitHubAuthorization authorization) {
        GitHub installationClient;
        try {
            installationClient = gitHubClientProvider.getInstallationClient(authorization.getInstallationId()).getClient();
        } catch (IOException ex) {
            throw new ApiException(Response.Status.UNAUTHORIZED, "Access denied on GitHub Installation", ex);
        }
        GHRepository repository;
        try {
            repository = installationClient.getRepositoryById(authorization.getRepositoryId());
        } catch (IOException ex) {
            log.warn("Linking repo failed, could not get repository by id. projectId {}, authorization {}",
                    projectId, authorization, ex);
            throw new ApiException(Response.Status.BAD_REQUEST, "Could not access GitHub repository", ex);
        }
        try {
            repository.createHook(
                    "web",
                    ImmutableMap.of(
                            "url", getWebhookUrl(
                                    projectId,
                                    authorization.getInstallationId(),
                                    authorization.getRepositoryId())
                                    .toExternalForm(),
                            "content_type", "json",
                            // You cannot retrieve a secret after it is set,
                            // it is safe to use the same secret as App webhook
                            "secret", configGitHubResource.webhookSecret()),
                    ImmutableSet.of(
                            GHEvent.ISSUES,
                            GHEvent.ISSUE_COMMENT,
                            GHEvent.RELEASE),
                    true);
        } catch (IOException ex) {
            log.warn("Linking repo failed, could not create webhook. projectId {}, authorization {}",
                    projectId, authorization, ex);
            throw new ApiException(Response.Status.BAD_REQUEST, "Could not create GitHub repository webhook", ex);
        }
    }

    private URL getWebhookUrl(String projectId, long installationId, long repositoryId) throws MalformedURLException {
        return new URL("https://" + configApp.domain() + "/api" + Application.RESOURCE_VERSION + GitHubResource.REPO_WEBHOOK_PATH
                .replace("{projectId}", projectId)
                .replace("{installationId}", String.valueOf(installationId))
                .replace("{repositoryId}", String.valueOf(repositoryId)));
    }

    private Optional<GitHubAuthorization> getAccountAuthorizationForRepo(String accountId, long repositoryId, long installationId) {
        return Optional.ofNullable(gitHubAuthorizationSchema.fromItem(gitHubAuthorizationSchema.table().getItem(new GetItemSpec()
                        .withPrimaryKey(gitHubAuthorizationSchema.primaryKey(Map.of(
                                "accountId", accountId,
                                "repositoryId", repositoryId))))))
                .filter(auth -> auth.getInstallationId() == installationId)
                .filter(auth -> {
                    if (auth.getTtlInEpochSec() < Instant.now().getEpochSecond()) {
                        log.debug("DynamoDB has an expired auth session with expiry {}", auth.getTtlInEpochSec());
                        return false;
                    }
                    return true;
                });
    }

    @Override
    public Optional<IdeaAndIndexingFuture> ghIssueEvent(Project project, Issue ghIssue) throws IOException {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Optional.empty();
        }
        com.smotana.clearflask.api.model.GitHub integration = project.getGitHubIntegration().get();
        String ideaId = ideaStore.genDeterministicIdeaIdForGithubIssue(ghIssue.getIssue().getNumber(), ghIssue.getIssue().getId(), ghIssue.getRepository().getId());
        switch (ghIssue.getAction()) {
            case "opened":
                UserModel user = getCfUserFromGhUser(project.getProjectId(), ghIssue.getIssue().getUser());
                return Optional.of(ideaStore.createIdeaAndUpvote(new IdeaModel(
                        project.getProjectId(),
                        ideaId,
                        user.getUserId(),
                        user.getName(),
                        user.getIsMod(),
                        Instant.now(),
                        ghIssue.getIssue().getTitle(),
                        markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gh-new-post", ideaId, ghIssue.getIssue().getBody()),
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
                        ghIssue.getIssue().getHtmlUrl().toExternalForm(),
                        null,
                        null))); // adminNotes
            case "reopened":
            case "closed":
                Optional<String> switchToStatusOpt = Optional.ofNullable(integration.getStatusSync())
                        .map("reopened".equals(ghIssue.getAction())
                                ? GitHubStatusSync::getOpenStatus
                                : GitHubStatusSync::getClosedStatus);
                if (switchToStatusOpt.isPresent()) {
                    Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), ideaId);
                    if (ideaOpt.isPresent() && !switchToStatusOpt.get().equals(ideaOpt.get().getStatusId())) {
                        return Optional.of(ideaStore.updateIdea(project.getProjectId(), ideaId, IdeaUpdateAdmin.builder()
                                .statusId(switchToStatusOpt.get())
                                .build(), Optional.empty()));
                    }
                }
                break;
            case "edited":
                boolean updated = false;
                IdeaUpdateAdmin.IdeaUpdateAdminBuilder updateBuilder = IdeaUpdateAdmin.builder();
                if (ghIssue.getChanges().getTitle() != null) {
                    updateBuilder.description(ghIssue.getIssue().getTitle());
                    updated = true;
                }
                if (ghIssue.getChanges().getBody() != null) {
                    updateBuilder.description(markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gh-post", ideaId, ghIssue.getIssue().getBody()));
                    updated = true;
                }
                if (updated) {
                    return Optional.of(ideaStore.updateIdea(project.getProjectId(), ideaId, updateBuilder.build(), Optional.empty()));
                }
                break;
            case "deleted":
                try {
                    ideaStore.deleteIdea(project.getProjectId(), ideaId, true);
                    billing.recordUsage(Billing.UsageType.POST_DELETED, project.getAccountId(), project.getProjectId());
                } catch (ConditionalCheckFailedException ex) {
                    // Issue was probably created before integration was setup and doesn't exist
                }
                break;
        }

        return Optional.empty();
    }

    @Override
    public Optional<CommentAndIndexingFuture<?>> ghIssueCommentEvent(Project project, IssueComment ghIssueComment, String payload) throws IOException {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Optional.empty();
        }

        com.smotana.clearflask.api.model.GitHub integration = project.getGitHubIntegration().get();
        if (integration.getCommentSync() != Boolean.TRUE) {
            return Optional.empty();
        }

        String postId = ideaStore.genDeterministicIdeaIdForGithubIssue(ghIssueComment.getIssue().getNumber(), ghIssueComment.getIssue().getId(), ghIssueComment.getRepository().getId());
        String commentId = commentStore.genDeterministicCommentIdForGithubIssueComment(ghIssueComment.getComment().getId());
        switch (ghIssueComment.getAction()) {
            case "created":
            case "edited":
                Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), postId);
                if (ideaOpt.isPresent()) {
                    UserModel user = getCfUserFromGhUser(project.getProjectId(), ghIssueComment.getComment().getUser());
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
                            markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gh-new-comment", commentId, ghIssueComment.getComment().getBody()),
                            0,
                            0)));
                } else if ("edited".equals(ghIssueComment.getAction())) {
                    // GitHub client is missing "changes" parsing so we cannot do:
                    // ghIssueComment.getChanges().getBody()
                    // https://github.com/hub4j/github-api/issues/1243
                    // Need to extract it ourselves here
                    boolean bodyChanged = jsonPathExists(changesBodyJsonPath, payload);
                    if (bodyChanged) {
                        commentStore.updateComment(project.getProjectId(), postId, commentId, ghIssueComment.getComment().getUpdatedAt().toInstant(), CommentUpdate.builder()
                                .content(markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gh-comment", commentId, ghIssueComment.getComment().getBody())).build());
                    }
                }
                break;
            case "deleted":
                try {
                    return Optional.of(commentStore.markAsDeletedComment(project.getProjectId(), postId, commentId));
                } catch (ConditionalCheckFailedException ex) {
                    // Issue comment was probably created before integration was setup and doesn't exist
                }
                break;
        }

        return Optional.empty();
    }

    @Override
    public Optional<IdeaAndIndexingFuture> ghReleaseEvent(Project project, GHEventPayload.Release ghRelease, String payload) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Optional.empty();
        }
        com.smotana.clearflask.api.model.GitHub integration = project.getGitHubIntegration().get();
        String ideaId = ideaStore.genDeterministicIdeaIdForGithubRelease(ghRelease.getRelease().getId(), ghRelease.getRepository().getId());
        switch (ghRelease.getAction()) {
            case "published":
            case "released":
            case "edited":
                UserModel user = getCfUserFromGhUser(project.getProjectId(), ghRelease.getSender());
                Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), ideaId);
                if (ideaOpt.isEmpty()) {
                    IdeaAndIndexingFuture ideaAndIndexingFuture = ideaStore.createIdeaAndUpvote(new IdeaModel(
                            project.getProjectId(),
                            ideaId,
                            user.getUserId(),
                            user.getName(),
                            user.getIsMod(),
                            Instant.now(),
                            ghRelease.getRelease().getName(),
                            markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gh-new-post", ideaId, ghRelease.getRelease().getBody()),
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
                            ghRelease.getRelease().getHtmlUrl().toExternalForm(),
                            null,
                            null)); // adminNotes
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
                } else if ("edited".equals(ghRelease.getAction())) {
                    boolean updated = false;
                    IdeaUpdateAdmin.IdeaUpdateAdminBuilder updateBuilder = IdeaUpdateAdmin.builder();
                    // GitHub client is missing "changes" parsing so we cannot do:
                    // ghRelease.getChanges().getBody()
                    // https://github.com/hub4j/github-api/issues/1243
                    // Need to extract it ourselves here
                    if (jsonPathExists(changesNameJsonPath, payload)) {
                        updateBuilder.title(ghRelease.getRelease().getName());
                        updated = true;
                    }
                    String bodyQuill = markdownAndQuillUtil.markdownToQuill(project.getProjectId(), "gh-new-post", ideaId, ghRelease.getRelease().getBody());
                    if (jsonPathExists(changesBodyJsonPath, payload)) {
                        updateBuilder.description(bodyQuill);
                        updated = true;
                    }
                    if (updated) {
                        return Optional.of(ideaStore.updateIdea(project.getProjectId(), ideaId, updateBuilder.build(), Optional.empty()));
                    }
                }
                break;
        }

        return Optional.empty();
    }

    @Override
    public ListenableFuture<Optional<GHIssueComment>> cfCommentCreatedAsync(Project project, IdeaModel idea, CommentModel comment, UserModel user) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return Futures.immediateFuture(Optional.empty());
        }

        Optional<com.smotana.clearflask.api.model.GitHub> integration = project.getGitHubIntegration();
        if (integration.isEmpty() || integration.get().getCommentSync() != Boolean.TRUE) {
            return Futures.immediateFuture(Optional.empty());
        }

        Optional<IdeaStore.GitHubIssueMetadata> gitHubIssueMetadataOpt = getMetadataFromLinkedIdea(project, idea);
        if (gitHubIssueMetadataOpt.isEmpty() || gitHubIssueMetadataOpt.get().getRepositoryId() != integration.get().getRepositoryId()) {
            return Futures.immediateFuture(Optional.empty());
        }

        return submit(() -> {
            Optional<CommentModel> parentCommentOpt = comment.getParentCommentIds().isEmpty() ? Optional.empty()
                    : commentStore.getComment(project.getProjectId(), idea.getIdeaId(),
                    comment.getParentCommentIds().get(comment.getParentCommentIds().size() - 1));

            GitHubClientProvider.GitHubInstallation installation = gitHubClientProvider.getInstallationClient(integration.get().getInstallationId());
            if (!installation.getRateLimiter().tryAcquire()) {
                return Optional.empty();
            }

            GHRepository repository;
            try {
                repository = installation.getClient().getRepositoryById(integration.get().getRepositoryId());
            } catch (HttpException ex) {
                if (ex.getResponseCode() == 403) {
                    // Turns out we don't have permission anymore, unlink this repo
                    removeIntegrationConfig(project.getProjectId());
                }
                throw ex;
            }

            String commentContent = "";
            if (parentCommentOpt.isPresent()) {
                commentContent += markdownAndQuillUtil.markdownQuote(
                        markdownAndQuillUtil.quillToMarkdown(
                                parentCommentOpt.get().getContentSanitized(sanitizer)));
            }
            commentContent += markdownAndQuillUtil.markdownSign(
                    comment.getAuthorName(),
                    "wrote",
                    markdownAndQuillUtil.quillToMarkdown(comment.getContentSanitized(sanitizer)));

            GHIssueComment ghIssueComment = repository.getIssue((int) gitHubIssueMetadataOpt.get().getIssueNumber())
                    .comment(commentContent);
            return Optional.of(ghIssueComment);
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

        Optional<com.smotana.clearflask.api.model.GitHub> integration = project.getGitHubIntegration();
        if (integration.isEmpty()) {
            return Futures.immediateFuture(Optional.empty());
        }
        boolean syncStatus = integration.get().getStatusSync() != null;
        boolean syncResponse = integration.get().getResponseSync() == Boolean.TRUE;
        if ((!statusChanged || !syncStatus)
                && (!responseChanged || !syncResponse)) {
            return Futures.immediateFuture(Optional.empty());
        }

        Optional<IdeaStore.GitHubIssueMetadata> gitHubIssueMetadataOpt = getMetadataFromLinkedIdea(project, idea);
        if (gitHubIssueMetadataOpt.isEmpty() || gitHubIssueMetadataOpt.get().getRepositoryId() != integration.get().getRepositoryId()) {
            return Futures.immediateFuture(Optional.empty());
        }

        return submit(() -> {
            GitHubClientProvider.GitHubInstallation installation = gitHubClientProvider.getInstallationClient(integration.get().getInstallationId());
            if (!installation.getRateLimiter().tryAcquire()) {
                return Optional.empty();
            }

            GHRepository repository;
            try {
                repository = installation.getClient().getRepositoryById(gitHubIssueMetadataOpt.get().getRepositoryId());
            } catch (HttpException ex) {
                if (ex.getResponseCode() == 403) {
                    // Turns out we don't have permission anymore, unlink this repo
                    removeIntegrationConfig(project.getProjectId());
                }
                throw ex;
            }

            GHIssue ghIssue = repository.getIssue((int) gitHubIssueMetadataOpt.get().getIssueNumber());
            Optional<GHIssueComment> responseCommentOpt = Optional.empty();
            if (responseChanged
                    && syncResponse
                    && !Strings.isNullOrEmpty(idea.getResponseAsUnsafeHtml())
                    && !Strings.isNullOrEmpty(idea.getResponseAuthorName())) {
                GHIssueComment ghComment = ghIssue.comment(
                        markdownAndQuillUtil.markdownSign(
                                idea.getResponseAuthorName(),
                                "wrote",
                                markdownAndQuillUtil.quillToMarkdown(idea.getResponseSanitized(sanitizer))));
                responseCommentOpt = Optional.of(ghComment);
            }
            if (statusChanged
                    && syncStatus
                    && !Strings.isNullOrEmpty(idea.getStatusId())) {
                IdeaStatus statusToSet = project.getStatus(idea.getCategoryId(), idea.getStatusId()).get();
                Optional<GHLabel> labelOpt = repository.listLabels().toList().stream()
                        .filter(label -> statusToSet.getName().equals(label.getName()))
                        .findAny();
                GHLabel labelToAdd;
                if (labelOpt.isEmpty()) {
                    labelToAdd = repository.createLabel(
                            statusToSet.getName(),
                            colorUtil.colorToHex(colorUtil.parseColor(statusToSet.getColor())
                                    .orElse(Color.BLACK)),
                            "Managed by ClearFlask");
                } else {
                    labelToAdd = labelOpt.get();
                }
                List<GHLabel> existingLabels = ghIssue.addLabels(labelToAdd);
                Set<String> categoryAllStatusNames = project.getCategory(idea.getCategoryId()).get().getWorkflow().getStatuses().stream()
                        .map(IdeaStatus::getName)
                        .collect(Collectors.toSet());
                Set<GHLabel> labelsToDelete = existingLabels.stream()
                        .filter(label -> labelToAdd.getId() != label.getId())
                        .filter(label -> categoryAllStatusNames.contains(label.getName()))
                        .collect(Collectors.toSet());
                ghIssue.removeLabels(labelsToDelete);

                List<String> closedStatuses = Optional.ofNullable(integration.get().getStatusSync().getClosedStatuses()).orElse(ImmutableList.of());
                if (!closedStatuses.isEmpty()) {
                    boolean shouldBeClosed = closedStatuses.contains(statusToSet.getStatusId());
                    boolean isClosed = ghIssue.getState().equals(GHIssueState.CLOSED);
                    if (shouldBeClosed != isClosed) {
                        if (shouldBeClosed) {
                            ghIssue.close();
                        } else {
                            ghIssue.reopen();
                        }
                    }
                }
            }
            return Optional.of(new StatusAndOrResponse(ghIssue, responseCommentOpt));
        });
    }

    private Optional<IdeaStore.GitHubIssueMetadata> getMetadataFromLinkedIdea(Project project, IdeaModel idea) {
        Optional<IdeaStore.GitHubIssueMetadata> gitHubIssueMetadataOpt = ideaStore.extractGitHubIssueFromIdeaId(idea.getIdeaId());
        if (gitHubIssueMetadataOpt.isEmpty()) {
            return Optional.empty();
        }
        Optional<com.smotana.clearflask.api.model.GitHub> gitHubOpt = project.getGitHubIntegration();
        if (gitHubOpt.isEmpty() || gitHubOpt.get().getRepositoryId() != gitHubIssueMetadataOpt.get().getRepositoryId()) {
            return Optional.empty();
        }
        return gitHubIssueMetadataOpt;

    }

    private UserModel getCfUserFromGhUser(String projectId, GHUser ghUser) {
        return userStore.createOrGet(
                projectId,
                USER_GUID_GITHUB_PREFIX + ghUser.getId(),
                () -> {
                    try {
                        return Optional.ofNullable(Strings.emptyToNull(ghUser.getEmail()));
                    } catch (IOException ex) {
                        log.warn("Failed to fetch email from GH user, ghUser ID {} projectId {}", ghUser.getId(), projectId);
                        return Optional.empty();
                    }
                },
                () -> {
                    try {
                        return Optional.ofNullable(Strings.emptyToNull(ghUser.getName()));
                    } catch (IOException e) {
                        log.warn("Failed to fetch name from GH user, ghUser ID {} projectId {}", ghUser.getId(), projectId);
                        return Optional.empty();
                    }
                },
                false);
    }

    private <T> ListenableFuture<T> submit(Callable<T> task) {
        return executor.submit(() -> {
            try {
                return task.call();
            } catch (Throwable th) {
                log.warn("Failed to complete GitHub Integration task", th);
                throw th;
            }
        });
    }

    private <T> boolean jsonPathExists(JsonPath path, String payload) {
        try {
            return path.read(payload) != null;
        } catch (PathNotFoundException ex) {
            return false;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(GitHubStore.class).to(GitHubStoreImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(GitHubStoreImpl.class).asEagerSingleton();
            }
        };
    }
}
