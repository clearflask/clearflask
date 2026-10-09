// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.GitLabStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.gitlab.GitLabClientProvider;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.WebhookTokenUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.gitlab4j.api.webhook.IssueEvent;
import org.gitlab4j.api.webhook.NoteEvent;
import org.gitlab4j.api.webhook.ReleaseEvent;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class GitLabResource {

    public static final String WEBHOOK_PATH = "/webhook/gitlab/project/{projectId}/gitlabProject/{gitlabProjectId}";

    // GitLab webhook headers
    private static final String GITLAB_EVENT_HEADER = "X-Gitlab-Event";
    private static final String GITLAB_TOKEN_HEADER = "X-Gitlab-Token";
    private static final String GITLAB_INSTANCE_HEADER = "X-Gitlab-Instance";

    public interface Config {
        /**
         * Server-side secret from which per-project webhook tokens are derived, see {@link WebhookTokenUtil}.
         * MUST be configured in production - empty default will cause webhooks to fail.
         * The secret itself is never sent to GitLab; each linked project gets its own derived token.
         */
        @DefaultValue("")
        String webhookSecret();

        /**
         * Webhooks created before per-project tokens existed carry the raw global secret. Accepting it keeps those
         * links working, at the cost that anyone who learned the secret from their own GitLab instance can still
         * forge events for any project. Re-link GitLab projects and then set this to false.
         */
        @DefaultValue("true")
        boolean acceptLegacyGlobalToken();
    }

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;
    @Inject
    private Config config;
    @Inject
    private GitLabStore gitLabStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private GitLabClientProvider gitLabClientProvider;
    @Inject
    private Gson gson;

    @POST
    @Path(WEBHOOK_PATH)
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public void webhook(
            @PathParam("projectId") @NotNull String projectId,
            @PathParam("gitlabProjectId") @NotNull long gitlabProjectId,
            @Valid String payload) {
        checkToken(projectId, gitlabProjectId);
        String eventType = getEventType();

        Optional<Project> projectOpt = Optional.empty();
        for (boolean useCache : ImmutableList.of(Boolean.TRUE, Boolean.FALSE)) {
            projectOpt = projectStore.getProject(projectId, useCache);
            if (projectOpt.isEmpty()) {
                break; // Project doesn't exist
            }
            projectOpt = projectOpt.filter(p -> p.getGitLabIntegration()
                    .filter(i -> i.getProjectId() == gitlabProjectId)
                    .isPresent());
            if (projectOpt.isPresent()) {
                break; // Project is here and valid, no need to continue
            }
        }
        if (projectOpt.isEmpty()) {
            log.info("Unlinking webhook for missing integration with projectId {} gitlabProjectId {}",
                    projectId, gitlabProjectId);
            String instanceUrl = Strings.nullToEmpty(request.getHeader(GITLAB_INSTANCE_HEADER));
            if (Strings.isNullOrEmpty(instanceUrl)) {
                instanceUrl = "https://gitlab.com";
            }
            gitLabStore.removeIntegrationWebhook(projectId, instanceUrl, gitlabProjectId);
            throw new ClientErrorException(Response.Status.GONE);
        }
        Project project = projectOpt.get();

        switch (eventType) {
            case "Issue Hook":
                IssueEvent issueEvent = gson.fromJson(payload, IssueEvent.class);
                gitLabStore.glIssueEvent(project, issueEvent);
                break;
            case "Note Hook":
                NoteEvent noteEvent = gson.fromJson(payload, NoteEvent.class);
                gitLabStore.glNoteEvent(project, noteEvent);
                break;
            case "Release Hook":
                ReleaseEvent releaseEvent = gson.fromJson(payload, ReleaseEvent.class);
                gitLabStore.glReleaseEvent(project, releaseEvent);
                break;
            case "Push Hook":
            case "System Hook":
                // Ignore push hooks and system hooks
                break;
            default:
                if (LogUtil.rateLimitAllowLog("gitlab-resource-uninteresting-event")) {
                    log.warn("Received uninteresting GitLab event {}", eventType);
                }
                break;
        }
    }

    private void checkToken(String projectId, long gitlabProjectId) {
        String configuredSecret = config.webhookSecret();
        if (Strings.isNullOrEmpty(configuredSecret)) {
            log.error("GitLab webhook secret is not configured. Please set a secure random secret in the configuration.");
            throw new InternalServerErrorException("GitLab webhook secret not configured");
        }

        String token = Strings.nullToEmpty(request.getHeader(GITLAB_TOKEN_HEADER));
        String expectedToken = webhookToken(configuredSecret, projectId, gitlabProjectId);
        if (WebhookTokenUtil.matches(expectedToken, token)) {
            return;
        }
        if (config.acceptLegacyGlobalToken() && WebhookTokenUtil.matches(configuredSecret, token)) {
            if (LogUtil.rateLimitAllowLog("gitlab-resource-legacy-token")) {
                log.warn("GitLab webhook for projectId {} gitlabProjectId {} authenticated with the legacy global token;"
                        + " re-link the project to switch to a per-project token", projectId, gitlabProjectId);
            }
            return;
        }
        if (LogUtil.rateLimitAllowLog("gitlab-resource-token-mismatch")) {
            log.warn("GitLab webhook token mismatch for projectId {} gitlabProjectId {}", projectId, gitlabProjectId);
        }
        throw new BadRequestException("Invalid token");
    }

    /** Token registered with GitLab for a given link; only valid for that one project pair. */
    public static String webhookToken(String secret, String projectId, long gitlabProjectId) {
        return WebhookTokenUtil.derive(secret, "gitlab", projectId, String.valueOf(gitlabProjectId));
    }

    private String getEventType() {
        String eventType = request.getHeader(GITLAB_EVENT_HEADER);
        if (Strings.isNullOrEmpty(eventType)) {
            if (LogUtil.rateLimitAllowLog("gitlab-resource-event-type-empty")) {
                log.warn("GitLab event type not provided");
            }
            throw new BadRequestException("Missing header " + GITLAB_EVENT_HEADER);
        }
        return eventType;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(GitLabResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(GitLabResource.class);
            }
        };
    }
}
