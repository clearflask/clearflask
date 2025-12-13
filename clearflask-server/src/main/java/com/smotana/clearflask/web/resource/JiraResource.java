// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.JiraStore;
import com.smotana.clearflask.store.JiraStore.JiraCommentEvent;
import com.smotana.clearflask.store.JiraStore.JiraIssueEvent;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.util.JiraSignatureVerifier;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

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
public class JiraResource {

    public static final String WEBHOOK_PATH = "/webhook/jira/project/{projectId}/cloud/{cloudId}";

    // Jira webhook headers
    private static final String JIRA_WEBHOOK_ID_HEADER = "X-Atlassian-Webhook-Identifier";
    private static final String JIRA_WEBHOOK_SECRET_HEADER = "X-Hub-Secret";
    private static final String JIRA_USER_AGENT_HEADER = "user-agent";
    private static final String JIRA_USER_AGENT_VALUE = "Atlassian";

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("")
        String webhookSecret();
    }

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;
    @Inject
    private Config config;
    @Inject
    private JiraStore jiraStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private Gson gson;

    @POST
    @Path(WEBHOOK_PATH)
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public void webhookProject(
            @PathParam("projectId") @NotNull String projectId,
            @PathParam("cloudId") @NotNull String cloudId,
            @Valid String payload) {

        if (!config.enabled()) {
            log.debug("Jira integration not enabled, ignoring webhook");
            return;
        }

        String webhookId = getWebhookId();
        checkUserAgent(webhookId);

        // Verify signature if secret is configured
        if (!Strings.isNullOrEmpty(config.webhookSecret())) {
            String signature = request.getHeader(JIRA_WEBHOOK_SECRET_HEADER);
            JiraSignatureVerifier.verifySignature(payload, signature, config.webhookSecret(), webhookId);
        }

        // Parse the webhook payload
        JsonObject payloadJson;
        try {
            payloadJson = gson.fromJson(payload, JsonObject.class);
        } catch (Exception e) {
            log.warn("Failed to parse Jira webhook payload, webhookId {}", webhookId, e);
            throw new BadRequestException("Invalid JSON payload");
        }

        String webhookEvent = payloadJson.has("webhookEvent")
                ? payloadJson.get("webhookEvent").getAsString()
                : null;
        if (Strings.isNullOrEmpty(webhookEvent)) {
            log.warn("Jira webhook missing webhookEvent, webhookId {}", webhookId);
            throw new BadRequestException("Missing webhookEvent");
        }

        // Get project and verify integration
        Optional<Project> projectOpt = Optional.empty();
        for (boolean useCache : ImmutableList.of(Boolean.TRUE, Boolean.FALSE)) {
            projectOpt = projectStore.getProject(projectId, useCache);
            if (projectOpt.isEmpty()) {
                break; // Project doesn't exist
            }
            projectOpt = projectOpt.filter(p -> p.getVersionedConfigAdmin().getConfig().getJira() != null
                    && p.getVersionedConfigAdmin().getConfig().getJira().getCloudId().equals(cloudId));
            if (projectOpt.isPresent()) {
                break; // Project is here and valid
            }
        }

        if (projectOpt.isEmpty()) {
            log.info("Unlinking webhook for missing integration with projectId {} cloudId {}",
                    projectId, cloudId);
            jiraStore.removeIntegrationWebhook(projectId, cloudId, null);
            throw new ClientErrorException(Response.Status.GONE);
        }

        Project project = projectOpt.get();

        // Route to appropriate handler based on event type
        switch (webhookEvent) {
            case "jira:issue_created":
            case "jira:issue_updated":
            case "jira:issue_deleted":
                handleIssueEvent(project, payloadJson, webhookEvent);
                break;
            case "comment_created":
            case "comment_updated":
            case "comment_deleted":
                handleCommentEvent(project, payloadJson, webhookEvent);
                break;
            default:
                log.debug("Unhandled Jira webhook event: {}", webhookEvent);
                break;
        }
    }

    private void handleIssueEvent(Project project, JsonObject payload, String webhookEvent) {
        JsonObject issue = payload.has("issue") ? payload.getAsJsonObject("issue") : null;
        if (issue == null) {
            log.warn("Jira issue event missing issue object");
            return;
        }

        JsonObject fields = issue.has("fields") ? issue.getAsJsonObject("fields") : null;

        JiraIssueEvent.JiraIssueEventBuilder eventBuilder = JiraIssueEvent.builder()
                .webhookEvent(webhookEvent)
                .issueKey(issue.get("key").getAsString())
                .issueId(issue.get("id").getAsString());

        if (fields != null) {
            if (fields.has("summary") && !fields.get("summary").isJsonNull()) {
                eventBuilder.summary(fields.get("summary").getAsString());
            }

            if (fields.has("description") && !fields.get("description").isJsonNull()) {
                eventBuilder.description(gson.toJson(fields.get("description")));
            }

            if (fields.has("status") && !fields.get("status").isJsonNull()) {
                JsonObject status = fields.getAsJsonObject("status");
                eventBuilder.status(status.has("name") ? status.get("name").getAsString() : null);
            }

            if (fields.has("issuetype") && !fields.get("issuetype").isJsonNull()) {
                JsonObject issueType = fields.getAsJsonObject("issuetype");
                eventBuilder.issueType(issueType.has("name") ? issueType.get("name").getAsString() : null);
            }

            if (fields.has("priority") && !fields.get("priority").isJsonNull()) {
                JsonObject priority = fields.getAsJsonObject("priority");
                eventBuilder.priority(priority.has("name") ? priority.get("name").getAsString() : null);
            }

            if (fields.has("reporter") && !fields.get("reporter").isJsonNull()) {
                JsonObject reporter = fields.getAsJsonObject("reporter");
                eventBuilder.reporterAccountId(reporter.get("accountId").getAsString());
                if (reporter.has("displayName")) {
                    eventBuilder.reporterDisplayName(reporter.get("displayName").getAsString());
                }
                if (reporter.has("emailAddress")) {
                    eventBuilder.reporterEmail(reporter.get("emailAddress").getAsString());
                }
            }
        }

        // Construct issue URL
        var jiraConfig = project.getVersionedConfigAdmin().getConfig().getJira();
        if (jiraConfig != null && jiraConfig.getCloudName() != null) {
            String issueUrl = "https://" + jiraConfig.getCloudName() + ".atlassian.net/browse/" + issue.get("key").getAsString();
            eventBuilder.issueUrl(issueUrl);
        }

        try {
            jiraStore.jiraIssueEvent(project, eventBuilder.build());
        } catch (Exception e) {
            log.warn("Failed to handle Jira issue event for project {}", project.getProjectId(), e);
        }
    }

    private void handleCommentEvent(Project project, JsonObject payload, String webhookEvent) {
        JsonObject comment = payload.has("comment") ? payload.getAsJsonObject("comment") : null;
        JsonObject issue = payload.has("issue") ? payload.getAsJsonObject("issue") : null;

        if (comment == null || issue == null) {
            log.warn("Jira comment event missing required objects");
            return;
        }

        JiraCommentEvent.JiraCommentEventBuilder eventBuilder = JiraCommentEvent.builder()
                .webhookEvent(webhookEvent)
                .issueKey(issue.get("key").getAsString())
                .commentId(comment.get("id").getAsString());

        if (comment.has("body") && !comment.get("body").isJsonNull()) {
            eventBuilder.body(gson.toJson(comment.get("body")));
        }

        if (comment.has("author") && !comment.get("author").isJsonNull()) {
            JsonObject author = comment.getAsJsonObject("author");
            eventBuilder.authorAccountId(author.get("accountId").getAsString());
            if (author.has("displayName")) {
                eventBuilder.authorDisplayName(author.get("displayName").getAsString());
            }
            if (author.has("emailAddress")) {
                eventBuilder.authorEmail(author.get("emailAddress").getAsString());
            }
        }

        try {
            jiraStore.jiraCommentEvent(project, eventBuilder.build());
        } catch (Exception e) {
            log.warn("Failed to handle Jira comment event for project {}", project.getProjectId(), e);
        }
    }

    private String getWebhookId() {
        String webhookId = request.getHeader(JIRA_WEBHOOK_ID_HEADER);
        if (Strings.isNullOrEmpty(webhookId)) {
            // Jira doesn't always send this header, generate a placeholder
            webhookId = "jira-" + System.currentTimeMillis();
        }
        return webhookId;
    }

    private void checkUserAgent(String webhookId) {
        String userAgent = Strings.nullToEmpty(request.getHeader(JIRA_USER_AGENT_HEADER));
        // Jira webhook user-agent format: "Atlassian Webhook HTTP Client"
        if (!userAgent.contains(JIRA_USER_AGENT_VALUE) && !userAgent.isEmpty()) {
            if (LogUtil.rateLimitAllowLog("jira-resource-useragent-mismatch")) {
                log.warn("Jira useragent mismatch, found {} expected to contain {} webhookId {}",
                        userAgent, JIRA_USER_AGENT_VALUE, webhookId);
            }
            // Don't throw - Jira's user-agent can vary
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(JiraResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(JiraResource.class);
            }
        };
    }
}
