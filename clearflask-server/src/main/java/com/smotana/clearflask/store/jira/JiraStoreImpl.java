// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.jira;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
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
import com.smotana.clearflask.api.model.AvailableJiraProject;
import com.smotana.clearflask.api.model.AvailableJiraProjects;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.IdeaStatus;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.CommentStore.CommentAndIndexingFuture;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.JiraStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraApiClient;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraClient;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraComment;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraIssue;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraIssueType;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraProject;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraCloudInstance;
import com.smotana.clearflask.store.jira.JiraClientProvider.JiraTransition;
import com.smotana.clearflask.store.jira.JiraClientProvider.OAuthTokens;
import com.smotana.clearflask.store.jira.JiraClientProvider.CreateIssueRequest;
import com.smotana.clearflask.store.jira.JiraClientProvider.UpdateIssueRequest;
import com.smotana.clearflask.store.jira.JiraClientProvider.RegisterWebhookRequest;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Singleton
public class JiraStoreImpl extends ManagedService implements JiraStore {

    public static final String USER_GUID_JIRA_PREFIX = "jira-";
    private static final Pattern JIRA_IDEA_ID_PATTERN = Pattern.compile("^jira-([A-Z]+-\\d+)-(.+)$");
    private static final Pattern JIRA_COMMENT_ID_PATTERN = Pattern.compile("^jira-(\\d+)-(.+)$");

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("P1D")
        Duration authExpiry();

        @DefaultValue("")
        String webhookSecret();
    }

    @Inject
    private Config config;
    @Inject
    private JiraClientProviderImpl.Config configJiraClient;
    @Inject
    private Application.Config configApp;
    @Inject
    private Gson gson;
    @Inject
    private JiraClientProvider jiraClientProvider;
    @Inject
    private AdfQuillConverter adfQuillConverter;
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
    @Inject
    private NotificationService notificationService;

    private TableSchema<JiraAuthorization> jiraAuthorizationSchema;
    private TableSchema<JiraWebhook> jiraWebhookSchema;
    private ListeningExecutorService executor;

    @Override
    protected void serviceStart() throws Exception {
        jiraAuthorizationSchema = singleTable.parseTableSchema(JiraAuthorization.class);
        jiraWebhookSchema = singleTable.parseTableSchema(JiraWebhook.class);

        executor = MoreExecutors.listeningDecorator(new ThreadPoolExecutor(
                2, Integer.MAX_VALUE, 60L, TimeUnit.SECONDS, new SynchronousQueue<>(),
                new ThreadFactoryBuilder().setNameFormat("JiraStoreImpl-worker-%d").build()));
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
    }

    @Extern
    @Override
    public AvailableJiraProjects getProjectsForUser(String accountId, String code) {
        if (!config.enabled()) {
            log.debug("Jira integration not enabled, skipping");
            throw new ApiException(Response.Status.SERVICE_UNAVAILABLE, "Jira integration is disabled");
        }

        try {
            String redirectUri = "https://" + configApp.domain() + "/dashboard/settings/project/jira";
            OAuthTokens tokens = jiraClientProvider.exchangeAuthorizationCode(code, redirectUri);

            ImmutableList<JiraCloudInstance> instances = jiraClientProvider.getAccessibleResources(tokens.getAccessToken());

            ImmutableList.Builder<AvailableJiraProject> availableProjectsBuilder = ImmutableList.builder();

            for (JiraCloudInstance instance : instances) {
                // Store authorization for this cloud instance
                storeAuthorization(accountId, instance.getId(), tokens);

                // Get projects for this instance
                JiraClient client = jiraClientProvider.getClient(instance.getId(), tokens.getAccessToken());
                try {
                    ImmutableList<JiraProject> projects = client.getApiClient().getProjects();
                    for (JiraProject project : projects) {
                        availableProjectsBuilder.add(AvailableJiraProject.builder()
                                .cloudId(instance.getId())
                                .cloudName(instance.getName())
                                .cloudUrl(instance.getUrl())
                                .projectId(project.getId())
                                .projectKey(project.getKey())
                                .projectName(project.getName())
                                .build());
                    }
                } catch (IOException e) {
                    log.warn("Failed to fetch projects for Jira cloud instance {}", instance.getId(), e);
                }
            }

            return AvailableJiraProjects.builder()
                    .projects(availableProjectsBuilder.build())
                    .build();
        } catch (IOException e) {
            log.warn("Failed to get Jira projects for user", e);
            throw new ApiException(Response.Status.BAD_REQUEST, "Failed to authenticate with Jira", e);
        }
    }

    private void storeAuthorization(String accountId, String cloudId, OAuthTokens tokens) {
        JiraAuthorization auth = JiraAuthorization.builder()
                .accountId(accountId)
                .cloudId(cloudId)
                .accessToken(tokens.getAccessToken())
                .refreshToken(tokens.getRefreshToken())
                .ttlInEpochSec(Instant.now().plus(config.authExpiry()).getEpochSecond())
                .build();

        dynamoDoc.getTable(jiraAuthorizationSchema.tableName())
                .putItem(jiraAuthorizationSchema.toItem(auth));
    }

    private Optional<JiraAuthorization> getAuthorization(String accountId, String cloudId) {
        return Optional.ofNullable(dynamoDoc.getTable(jiraAuthorizationSchema.tableName())
                        .getItem(new GetItemSpec().withPrimaryKey(jiraAuthorizationSchema.primaryKey(ImmutableMap.of(
                                "accountId", accountId,
                                "cloudId", cloudId)))))
                .map(jiraAuthorizationSchema::fromItem);
    }

    /**
     * Get authorization with automatic token refresh if needed.
     * Refreshes the token if it will expire within the next 5 minutes.
     */
    private Optional<JiraAuthorization> getAuthorizationWithRefresh(String accountId, String cloudId) {
        Optional<JiraAuthorization> authOpt = getAuthorization(accountId, cloudId);
        if (authOpt.isEmpty()) {
            return authOpt;
        }

        JiraAuthorization auth = authOpt.get();
        long now = System.currentTimeMillis() / 1000;
        long expiresIn = auth.getTtlInEpochSec() - now;

        // Refresh if token will expire within 5 minutes (300 seconds)
        if (expiresIn < 300) {
            try {
                log.info("Refreshing Jira access token for account {} cloudId {} (expires in {} seconds)",
                        accountId, cloudId, expiresIn);
                OAuthTokens refreshedTokens = jiraClientProvider.refreshAccessToken(auth.getRefreshToken());

                // Update authorization with new tokens
                JiraAuthorization updatedAuth = JiraAuthorization.builder()
                        .accountId(accountId)
                        .cloudId(cloudId)
                        .accessToken(refreshedTokens.getAccessToken())
                        .refreshToken(refreshedTokens.getRefreshToken())
                        .ttlInEpochSec(now + refreshedTokens.getExpiresIn())
                        .build();

                jiraAuthorizationSchema.table().putItem(jiraAuthorizationSchema.toItem(updatedAuth));
                return Optional.of(updatedAuth);
            } catch (IOException e) {
                log.error("Failed to refresh Jira access token for account {} cloudId {}", accountId, cloudId, e);
                // Return expired auth anyway - API call might still work or will fail gracefully
                return authOpt;
            }
        }

        return authOpt;
    }

    @Extern
    @Override
    public void setupConfigJiraIntegration(String accountId, Optional<ConfigAdmin> configPrevious, ConfigAdmin configAdmin) {
        if (!config.enabled()) {
            log.debug("Jira integration not enabled, skipping");
            return;
        }

        // Remove previous webhook if configuration changed
        if (configPrevious.isPresent()
                && configPrevious.get().getJira() != null
                && configAdmin.getJira() != null
                && (!configPrevious.get().getJira().getCloudId().equals(configAdmin.getJira().getCloudId())
                    || !configPrevious.get().getJira().getProjectKey().equals(configAdmin.getJira().getProjectKey()))) {
            try {
                removeIntegrationWebhook(
                        configAdmin.getProjectId(),
                        configPrevious.get().getJira().getCloudId(),
                        configPrevious.get().getJira().getProjectKey());
            } catch (Exception e) {
                log.warn("Failed to remove previous Jira webhook for project {}", configAdmin.getProjectId(), e);
            }
        }

        // Set up new webhook
        if (configAdmin.getJira() != null) {
            Optional<JiraAuthorization> authOpt = getAuthorization(accountId, configAdmin.getJira().getCloudId());
            if (authOpt.isEmpty()) {
                log.warn("No Jira authorization found for cloudId {}", configAdmin.getJira().getCloudId());
                throw new ApiException(Response.Status.BAD_REQUEST, "Jira authorization expired, please re-authenticate");
            }

            try {
                JiraClient client = jiraClientProvider.getClient(
                        configAdmin.getJira().getCloudId(),
                        authOpt.get().getAccessToken());

                // Register webhook
                String webhookUrl = "https://" + configApp.domain() + "/api/v1/webhook/jira/project/"
                        + configAdmin.getProjectId() + "/cloud/" + configAdmin.getJira().getCloudId();

                RegisterWebhookRequest request = RegisterWebhookRequest.builder()
                        .url(webhookUrl)
                        .events(ImmutableList.of(
                                "jira:issue_created",
                                "jira:issue_updated",
                                "jira:issue_deleted",
                                "comment_created",
                                "comment_updated",
                                "comment_deleted"))
                        .filters(ImmutableList.of("project = " + configAdmin.getJira().getProjectKey()))
                        .name("ClearFlask-" + configAdmin.getProjectId())
                        .build();

                var registration = client.getApiClient().registerWebhook(request);

                // Store webhook info
                JiraWebhook webhook = JiraWebhook.builder()
                        .projectId(configAdmin.getProjectId())
                        .cloudId(configAdmin.getJira().getCloudId())
                        .webhookId(registration.getId())
                        .jiraProjectKey(configAdmin.getJira().getProjectKey())
                        .build();

                dynamoDoc.getTable(jiraWebhookSchema.tableName())
                        .putItem(jiraWebhookSchema.toItem(webhook));

                log.info("Registered Jira webhook for project {} with cloudId {} projectKey {}",
                        configAdmin.getProjectId(), configAdmin.getJira().getCloudId(),
                        configAdmin.getJira().getProjectKey());

            } catch (IOException e) {
                log.warn("Failed to set up Jira webhook for project {}", configAdmin.getProjectId(), e);
                throw new ApiException(Response.Status.BAD_REQUEST, "Failed to set up Jira integration", e);
            }
        }
    }

    @Override
    public void removeIntegrationConfig(String projectId) {
        // Get project config to find cloud ID
        Optional<Project> projectOpt = projectStore.getProject(projectId, false);
        if (projectOpt.isPresent() && projectOpt.get().getVersionedConfigAdmin().getConfig().getJira() != null) {
            var jiraConfig = projectOpt.get().getVersionedConfigAdmin().getConfig().getJira();
            removeIntegrationWebhook(projectId, jiraConfig.getCloudId(), jiraConfig.getProjectKey());
        }
    }

    @Override
    public void removeIntegrationWebhook(String projectId, String cloudId, String jiraProjectKey) {
        // Find and delete webhook
        Optional<JiraWebhook> webhookOpt = Optional.ofNullable(
                dynamoDoc.getTable(jiraWebhookSchema.tableName())
                        .getItem(new GetItemSpec().withPrimaryKey(jiraWebhookSchema.primaryKey(ImmutableMap.of(
                                "projectId", projectId,
                                "cloudId", cloudId)))))
                .map(jiraWebhookSchema::fromItem);

        if (webhookOpt.isPresent()) {
            // Get project to find account for authorization
            Optional<Project> projectOpt = projectStore.getProject(projectId, false);
            if (projectOpt.isPresent()) {
                Optional<JiraAuthorization> authOpt = getAuthorization(
                        projectOpt.get().getAccountId(), cloudId);
                if (authOpt.isPresent()) {
                    try {
                        JiraClient client = jiraClientProvider.getClient(cloudId, authOpt.get().getAccessToken());
                        client.getApiClient().deleteWebhook(webhookOpt.get().getWebhookId());
                    } catch (IOException e) {
                        log.warn("Failed to delete Jira webhook {} for project {}",
                                webhookOpt.get().getWebhookId(), projectId, e);
                    }
                }
            }

            // Delete from DynamoDB
            dynamoDoc.getTable(jiraWebhookSchema.tableName())
                    .deleteItem(jiraWebhookSchema.primaryKey(ImmutableMap.of(
                            "projectId", projectId,
                            "cloudId", cloudId)));
        }
    }

    // ==================== Jira → ClearFlask (webhook handlers) ====================

    @Override
    public Optional<IdeaAndIndexingFuture> jiraIssueEvent(Project project, JiraIssueEvent event) {
        if (!config.enabled()) {
            return Optional.empty();
        }

        var jiraConfig = project.getVersionedConfigAdmin().getConfig().getJira();
        if (jiraConfig == null) {
            log.warn("Received Jira webhook for project {} but no Jira config found", project.getProjectId());
            return Optional.empty();
        }

        String ideaId = genDeterministicIdeaIdForJiraIssue(event.getIssueKey(), jiraConfig.getCloudId());

        switch (event.getWebhookEvent()) {
            case "jira:issue_created":
                return handleIssueCreated(project, jiraConfig, event, ideaId);
            case "jira:issue_updated":
                return handleIssueUpdated(project, jiraConfig, event, ideaId);
            case "jira:issue_deleted":
                return handleIssueDeleted(project, ideaId);
            default:
                log.debug("Unhandled Jira issue event: {}", event.getWebhookEvent());
                return Optional.empty();
        }
    }

    private Optional<IdeaAndIndexingFuture> handleIssueCreated(Project project,
            com.smotana.clearflask.api.model.Jira jiraConfig,
            JiraIssueEvent event, String ideaId) {

        // Check if idea already exists (idempotency)
        if (ideaStore.getIdea(project.getProjectId(), ideaId).isPresent()) {
            log.debug("Idea {} already exists, skipping creation", ideaId);
            return Optional.empty();
        }

        // Get or create user for the reporter
        UserModel user = getCfUserFromJiraUser(
                project.getProjectId(),
                event.getReporterAccountId(),
                event.getReporterDisplayName(),
                event.getReporterEmail());

        // Convert ADF description to Quill
        String descriptionQuill = null;
        if (!Strings.isNullOrEmpty(event.getDescription())) {
            try {
                descriptionQuill = adfQuillConverter.adfToQuill(event.getDescription());
            } catch (Exception e) {
                log.warn("Failed to convert ADF to Quill for issue {}", event.getIssueKey(), e);
                descriptionQuill = adfQuillConverter.plainTextToQuill(
                        "Description conversion failed. View in Jira: " + event.getIssueUrl());
            }
        }

        // Determine initial status
        String statusId = jiraConfig.getInitialStatusId();
        if (statusId == null) {
            // Use workflow default
            var category = project.getCategory(jiraConfig.getCreateWithCategoryId());
            if (category.isPresent() && category.get().getWorkflow() != null
                    && !category.get().getWorkflow().getStatuses().isEmpty()) {
                statusId = category.get().getWorkflow().getStatuses().get(0).getStatusId();
            }
        }

        // Build tags
        ImmutableSet<String> tagIds = jiraConfig.getCreateWithTags() != null
                ? ImmutableSet.copyOf(jiraConfig.getCreateWithTags())
                : ImmutableSet.of();

        IdeaModel idea = new IdeaModel(
                project.getProjectId(),
                ideaId,
                user.getUserId(),
                user.getName(),
                user.getIsMod(),
                Instant.now(),
                event.getSummary(),  // title
                descriptionQuill,    // description
                null, // response
                null, // responseAuthorUserId
                null, // responseAuthorName
                null, // responseEdited
                jiraConfig.getCreateWithCategoryId(),
                statusId,
                tagIds,
                0L, // commentCount
                0L, // childCommentCount
                null, // funded
                null, // fundGoal
                null, // fundersCount
                null, // voteValue
                null, // votersCount
                null, // expressionsValue
                ImmutableMap.of(), // expressions
                null, // trendScore
                ImmutableSet.of(), // linkedToPostIds
                ImmutableSet.of(), // linkedFromPostIds
                null, // mergedToPostId
                null, // mergedToPostTime
                ImmutableSet.of(), // mergedPostIds
                null, // order
                null, // linkedGitHubUrl
                null, // coverImg
                null, // visibility
                null); // adminNotes

        return Optional.of(ideaStore.createIdeaAndUpvote(idea));
    }

    private Optional<IdeaAndIndexingFuture> handleIssueUpdated(Project project,
            com.smotana.clearflask.api.model.Jira jiraConfig,
            JiraIssueEvent event, String ideaId) {

        Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), ideaId);
        if (ideaOpt.isEmpty()) {
            // Issue was created in Jira but we haven't synced it yet
            // Create it now
            return handleIssueCreated(project, jiraConfig, event, ideaId);
        }

        IdeaModel idea = ideaOpt.get();
        IdeaModel.IdeaModelBuilder builder = idea.toBuilder();
        boolean changed = false;

        // Update title if changed
        if (!Strings.isNullOrEmpty(event.getSummary()) && !event.getSummary().equals(idea.getTitle())) {
            builder.title(event.getSummary());
            changed = true;
        }

        // Update description if changed
        if (!Strings.isNullOrEmpty(event.getDescription())) {
            try {
                String newDesc = adfQuillConverter.adfToQuill(event.getDescription());
                if (!newDesc.equals(idea.getDescriptionAsUnsafeHtml())) {
                    builder.description(newDesc);
                    changed = true;
                }
            } catch (Exception e) {
                log.warn("Failed to convert ADF description for issue {}", event.getIssueKey(), e);
            }
        }

        // Update status if status sync is enabled and status mapping exists
        if (jiraConfig.getStatusSync() != null
                && jiraConfig.getStatusSync().getReverseStatusMapping() != null
                && !Strings.isNullOrEmpty(event.getStatus())) {
            String cfStatusId = jiraConfig.getStatusSync().getReverseStatusMapping().get(event.getStatus());
            if (cfStatusId != null && !cfStatusId.equals(idea.getStatusId())) {
                builder.statusId(cfStatusId);
                changed = true;
            }
        }

        if (!changed) {
            return Optional.empty();
        }

        IdeaModel updated = builder.build();
        return Optional.of(ideaStore.updateIdea(project.getProjectId(), ideaId,
                IdeaUpdate.builder()
                        .title(updated.getTitle())
                        .description(updated.getDescriptionAsUnsafeHtml())
                        .build()));
    }

    private Optional<IdeaAndIndexingFuture> handleIssueDeleted(Project project, String ideaId) {
        Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), ideaId);
        if (ideaOpt.isEmpty()) {
            return Optional.empty();
        }

        ideaStore.deleteIdea(project.getProjectId(), ideaId, false);
        log.info("Deleted idea {} for deleted Jira issue", ideaId);
        return Optional.empty();
    }

    @Override
    public Optional<CommentAndIndexingFuture<?>> jiraCommentEvent(Project project, JiraCommentEvent event) {
        if (!config.enabled()) {
            return Optional.empty();
        }

        var jiraConfig = project.getVersionedConfigAdmin().getConfig().getJira();
        if (jiraConfig == null || !Boolean.TRUE.equals(jiraConfig.getCommentSync())) {
            return Optional.empty();
        }

        String ideaId = genDeterministicIdeaIdForJiraIssue(event.getIssueKey(), jiraConfig.getCloudId());
        String commentId = genDeterministicCommentIdForJiraComment(event.getCommentId(), jiraConfig.getCloudId());

        // Check if linked idea exists
        Optional<IdeaModel> ideaOpt = ideaStore.getIdea(project.getProjectId(), ideaId);
        if (ideaOpt.isEmpty()) {
            log.debug("No linked idea found for Jira issue {}, skipping comment sync", event.getIssueKey());
            return Optional.empty();
        }

        switch (event.getWebhookEvent()) {
            case "comment_created":
                return handleCommentCreated(project, jiraConfig, event, ideaId, commentId);
            case "comment_updated":
                return handleCommentUpdated(project, jiraConfig, event, ideaId, commentId);
            case "comment_deleted":
                return handleCommentDeleted(project, ideaId, commentId);
            default:
                log.debug("Unhandled Jira comment event: {}", event.getWebhookEvent());
                return Optional.empty();
        }
    }

    private Optional<CommentAndIndexingFuture<?>> handleCommentCreated(Project project,
            com.smotana.clearflask.api.model.Jira jiraConfig,
            JiraCommentEvent event, String ideaId, String commentId) {

        // Check if comment already exists (idempotency)
        if (commentStore.getComment(project.getProjectId(), ideaId, commentId).isPresent()) {
            log.debug("Comment {} already exists, skipping creation", commentId);
            return Optional.empty();
        }

        // Get or create user
        UserModel user = getCfUserFromJiraUser(
                project.getProjectId(),
                event.getAuthorAccountId(),
                event.getAuthorDisplayName(),
                event.getAuthorEmail());

        // Convert ADF to Quill
        String contentQuill;
        try {
            contentQuill = adfQuillConverter.adfToQuill(event.getBody());
        } catch (Exception e) {
            log.warn("Failed to convert ADF comment body for issue {}", event.getIssueKey(), e);
            contentQuill = adfQuillConverter.plainTextToQuill("(Comment content conversion failed)");
        }

        CommentModel comment = new CommentModel(
                project.getProjectId(),
                ideaId,
                commentId,
                ImmutableList.of(), // parentCommentIds - Jira doesn't have threaded comments by default
                0, // level
                0L, // childCommentCount
                user.getUserId(),
                user.getName(),
                user.getIsMod(),
                Instant.now(),
                null, // edited
                contentQuill,
                0, // upvotes
                0); // downvotes

        return Optional.of(commentStore.createCommentAndUpvote(comment));
    }

    private Optional<CommentAndIndexingFuture<?>> handleCommentUpdated(Project project,
            com.smotana.clearflask.api.model.Jira jiraConfig,
            JiraCommentEvent event, String ideaId, String commentId) {

        Optional<CommentModel> commentOpt = commentStore.getComment(project.getProjectId(), ideaId, commentId);
        if (commentOpt.isEmpty()) {
            // Comment created before we synced, create it now
            return handleCommentCreated(project, jiraConfig, event, ideaId, commentId);
        }

        String contentQuill;
        try {
            contentQuill = adfQuillConverter.adfToQuill(event.getBody());
        } catch (Exception e) {
            log.warn("Failed to convert ADF comment body for issue {}", event.getIssueKey(), e);
            return Optional.empty();
        }

        return Optional.of(commentStore.updateComment(
                project.getProjectId(),
                ideaId,
                commentId,
                Instant.now(), // updated
                CommentUpdate.builder()
                        .content(contentQuill)
                        .build()));
    }

    private Optional<CommentAndIndexingFuture<?>> handleCommentDeleted(Project project, String ideaId, String commentId) {
        commentStore.deleteComment(project.getProjectId(), ideaId, commentId);
        log.debug("Deleted comment {} for deleted Jira comment", commentId);
        return Optional.empty();
    }

    // ==================== ClearFlask → Jira ====================

    @Override
    public ListenableFuture<Optional<JiraIssue>> cfPostCreatedAsync(Project project, IdeaModel idea, UserModel user) {
        if (!config.enabled()) {
            return Futures.immediateFuture(Optional.empty());
        }

        var jiraConfig = project.getVersionedConfigAdmin().getConfig().getJira();
        if (jiraConfig == null || !Boolean.TRUE.equals(jiraConfig.getAutoCreateIssue())) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Don't sync ideas that came from Jira (avoid loop)
        if (idea.getIdeaId().startsWith("jira-")) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Only sync ideas in configured category
        if (!idea.getCategoryId().equals(jiraConfig.getCreateWithCategoryId())) {
            return Futures.immediateFuture(Optional.empty());
        }

        return executor.submit(() -> {
            try {
                Optional<JiraAuthorization> authOpt = getAuthorizationWithRefresh(
                        project.getAccountId(), jiraConfig.getCloudId());
                if (authOpt.isEmpty()) {
                    log.warn("No Jira authorization found for project {}", project.getProjectId());
                    return Optional.empty();
                }

                JiraClient client = jiraClientProvider.getClient(
                        jiraConfig.getCloudId(), authOpt.get().getAccessToken());

                if (!client.getRateLimiter().tryAcquire()) {
                    log.warn("Jira rate limit hit for project {}", project.getProjectId());
                    return Optional.empty();
                }

                // Convert Quill to ADF
                String descriptionAdf = null;
                if (!Strings.isNullOrEmpty(idea.getDescriptionAsUnsafeHtml())) {
                    descriptionAdf = adfQuillConverter.quillToAdf(idea.getDescriptionAsUnsafeHtml());
                }

                // Determine issue type ID - fetch available types if not configured
                String issueTypeId = jiraConfig.getIssueTypeId();
                if (Strings.isNullOrEmpty(issueTypeId)) {
                    try {
                        ImmutableList<JiraIssueType> issueTypes = client.getApiClient().getIssueTypes(jiraConfig.getProjectKey());
                        if (!issueTypes.isEmpty()) {
                            issueTypeId = issueTypes.get(0).getId();
                            log.info("Using first available issue type '{}' for project '{}'",
                                    issueTypes.get(0).getName(), jiraConfig.getProjectKey());
                        } else {
                            log.warn("No issue types found for project '{}'", jiraConfig.getProjectKey());
                            issueTypeId = "10001"; // Fallback to common default
                        }
                    } catch (IOException e) {
                        log.warn("Failed to fetch issue types for project '{}', using default", jiraConfig.getProjectKey(), e);
                        issueTypeId = "10001"; // Fallback
                    }
                }

                CreateIssueRequest request = CreateIssueRequest.builder()
                        .projectKey(jiraConfig.getProjectKey())
                        .issueTypeId(issueTypeId)
                        .summary(idea.getTitle())
                        .description(descriptionAdf)
                        .build();

                JiraIssue jiraIssue = client.getApiClient().createIssue(request);

                // Store Jira URL in idea
                String jiraUrl = "https://" + jiraConfig.getCloudName() + ".atlassian.net/browse/" + jiraIssue.getKey();
                ideaStore.updateIdea(project.getProjectId(), idea.getIdeaId(),
                        IdeaUpdate.builder()
                                .externalUrl(jiraUrl)
                                .build());

                log.info("Created Jira issue {} for ClearFlask post {}", jiraIssue.getKey(), idea.getIdeaId());
                return Optional.of(jiraIssue);

            } catch (IOException e) {
                log.warn("Failed to create Jira issue for post {}", idea.getIdeaId(), e);
                return Optional.empty();
            }
        });
    }

    @Override
    public ListenableFuture<Optional<JiraComment>> cfCommentCreatedAsync(Project project, IdeaModel idea,
            CommentModel comment, UserModel user) {
        if (!config.enabled()) {
            return Futures.immediateFuture(Optional.empty());
        }

        var jiraConfig = project.getVersionedConfigAdmin().getConfig().getJira();
        if (jiraConfig == null || !Boolean.TRUE.equals(jiraConfig.getCommentSync())) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Don't sync comments that came from Jira (avoid loop)
        if (comment.getCommentId().startsWith("jira-")) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Only sync comments on Jira-linked ideas
        Optional<JiraIssueRef> jiraRefOpt = extractJiraIssueFromIdeaId(idea.getIdeaId());
        if (jiraRefOpt.isEmpty()) {
            // Only sync ideas created from Jira
            return Futures.immediateFuture(Optional.empty());
        }

        return executor.submit(() -> {
            try {
                Optional<JiraAuthorization> authOpt = getAuthorizationWithRefresh(
                        project.getAccountId(), jiraConfig.getCloudId());
                if (authOpt.isEmpty()) {
                    log.warn("No Jira authorization found for project {}", project.getProjectId());
                    return Optional.empty();
                }

                JiraClient client = jiraClientProvider.getClient(
                        jiraConfig.getCloudId(), authOpt.get().getAccessToken());

                if (!client.getRateLimiter().tryAcquire()) {
                    log.warn("Jira rate limit hit for project {}", project.getProjectId());
                    return Optional.empty();
                }

                // Extract issue key from Jira reference
                String issueKey = jiraRefOpt.get().getIssueKey();
                if (issueKey == null) {
                    return Optional.empty();
                }

                // Format comment with author attribution
                String authorName = user.getName() != null ? user.getName() : "ClearFlask User";
                String commentText = authorName + " wrote:\n\n" + adfQuillConverter.quillToPlainText(comment.getContentAsUnsafeHtml());
                String commentAdf = adfQuillConverter.plainTextToAdf(commentText);

                JiraComment jiraComment = client.getApiClient().addComment(issueKey, commentAdf);

                log.info("Created Jira comment {} on issue {} for ClearFlask comment {}",
                        jiraComment.getId(), issueKey, comment.getCommentId());
                return Optional.of(jiraComment);

            } catch (IOException e) {
                log.warn("Failed to create Jira comment for ClearFlask comment {}", comment.getCommentId(), e);
                return Optional.empty();
            }
        });
    }

    @Override
    public ListenableFuture<Optional<JiraStatusAndOrResponse>> cfStatusAndOrResponseChangedAsync(
            Project project, IdeaModel idea, boolean statusChanged, boolean responseChanged) {
        if (!config.enabled()) {
            return Futures.immediateFuture(Optional.empty());
        }

        var jiraConfig = project.getVersionedConfigAdmin().getConfig().getJira();
        if (jiraConfig == null) {
            return Futures.immediateFuture(Optional.empty());
        }

        // Only sync for Jira-linked ideas
        Optional<JiraIssueRef> jiraRefOpt = extractJiraIssueFromIdeaId(idea.getIdeaId());
        if (jiraRefOpt.isEmpty()) {
            // Only sync ideas created from Jira
            return Futures.immediateFuture(Optional.empty());
        }

        boolean shouldSyncStatus = statusChanged
                && jiraConfig.getStatusSync() != null
                && jiraConfig.getStatusSync().getStatusMapping() != null;
        boolean shouldSyncResponse = responseChanged && Boolean.TRUE.equals(jiraConfig.getResponseSync());

        if (!shouldSyncStatus && !shouldSyncResponse) {
            return Futures.immediateFuture(Optional.empty());
        }

        return executor.submit(() -> {
            try {
                Optional<JiraAuthorization> authOpt = getAuthorizationWithRefresh(
                        project.getAccountId(), jiraConfig.getCloudId());
                if (authOpt.isEmpty()) {
                    return Optional.empty();
                }

                JiraClient client = jiraClientProvider.getClient(
                        jiraConfig.getCloudId(), authOpt.get().getAccessToken());

                if (!client.getRateLimiter().tryAcquire()) {
                    return Optional.empty();
                }

                String issueKey = jiraRefOpt.get().getIssueKey();
                if (issueKey == null) {
                    return Optional.empty();
                }

                JiraIssue issue = client.getApiClient().getIssue(issueKey);
                JiraComment responseComment = null;

                // Sync status via transition
                if (shouldSyncStatus && idea.getStatusId() != null) {
                    String jiraTransitionName = jiraConfig.getStatusSync().getStatusMapping().get(idea.getStatusId());
                    if (jiraTransitionName != null) {
                        ImmutableList<JiraTransition> transitions = client.getApiClient().getTransitions(issueKey);
                        Optional<JiraTransition> transitionOpt = transitions.stream()
                                .filter(t -> t.getName().equalsIgnoreCase(jiraTransitionName)
                                        || (t.getTo() != null && t.getTo().getName().equalsIgnoreCase(jiraTransitionName)))
                                .findFirst();

                        if (transitionOpt.isPresent()) {
                            client.getApiClient().transitionIssue(issueKey, transitionOpt.get().getId());
                            log.info("Transitioned Jira issue {} to {} for ClearFlask status change",
                                    issueKey, jiraTransitionName);
                        }
                    }
                }

                // Sync response as comment
                if (shouldSyncResponse && !Strings.isNullOrEmpty(idea.getResponseAsUnsafeHtml())) {
                    String authorName = idea.getResponseAuthorName() != null
                            ? idea.getResponseAuthorName() : "ClearFlask Team";
                    String responseText = "Response from " + authorName + ":\n\n"
                            + adfQuillConverter.quillToPlainText(idea.getResponseAsUnsafeHtml());
                    String responseAdf = adfQuillConverter.plainTextToAdf(responseText);

                    responseComment = client.getApiClient().addComment(issueKey, responseAdf);
                    log.info("Added response comment to Jira issue {}", issueKey);
                }

                return Optional.of(new JiraStatusAndOrResponse(issue, Optional.ofNullable(responseComment)));

            } catch (IOException e) {
                log.warn("Failed to sync status/response to Jira for idea {}", idea.getIdeaId(), e);
                return Optional.empty();
            }
        });
    }

    // ==================== Helper methods ====================

    private UserModel getCfUserFromJiraUser(String projectId, String accountId,
            String displayName, String email) {
        String cfUserId = USER_GUID_JIRA_PREFIX + accountId;

        Optional<UserModel> existingUser = userStore.getUser(projectId, cfUserId);
        if (existingUser.isPresent()) {
            return existingUser.get();
        }

        // Create new user
        UserModel user = new UserModel(
                projectId,
                cfUserId,
                null, // ssoGuid
                false, // isMod
                displayName, // name
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
                ImmutableSet.of()); // subscribedCategoryIds

        return userStore.createUser(user).getUser();
    }

    public Optional<JiraIssueRef> extractJiraIssueFromIdeaId(String ideaId) {
        Matcher matcher = JIRA_IDEA_ID_PATTERN.matcher(ideaId);
        if (matcher.matches()) {
            return Optional.of(new JiraIssueRef(matcher.group(1), matcher.group(2)));
        }
        return Optional.empty();
    }

    private String extractIssueKeyFromUrl(String url) {
        if (url == null) {
            return null;
        }
        // URL format: https://xxx.atlassian.net/browse/PROJ-123
        int browseIndex = url.indexOf("/browse/");
        if (browseIndex >= 0) {
            return url.substring(browseIndex + 8);
        }
        return null;
    }

    @lombok.Value
    public static class JiraIssueRef {
        String issueKey;
        String cloudId;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(JiraStore.class).to(JiraStoreImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(JiraStoreImpl.class);
            }
        };
    }
}
