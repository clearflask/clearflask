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
        @DefaultValue("secret_shh")
        String webhookSecret();
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
        checkToken();
        String eventType = getEventType();

        Optional<Project> projectOpt = Optional.empty();
        for (boolean useCache : ImmutableList.of(Boolean.TRUE, Boolean.FALSE)) {
            projectOpt = projectStore.getProject(projectId, true);
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

    private void checkToken() {
        String token = Strings.nullToEmpty(request.getHeader(GITLAB_TOKEN_HEADER));
        if (!config.webhookSecret().equals(token)) {
            if (LogUtil.rateLimitAllowLog("gitlab-resource-token-mismatch")) {
                log.warn("GitLab webhook token mismatch");
            }
            throw new BadRequestException("Invalid token");
        }
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
