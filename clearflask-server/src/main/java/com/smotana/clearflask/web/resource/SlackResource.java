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
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.SlackStore;
import com.smotana.clearflask.store.SlackStore.SlackMessageEvent;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.SlackSignatureVerifier;
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
import java.io.IOException;
import java.util.Optional;

/**
 * Handles incoming webhooks from Slack.
 * <p>
 * Slack sends events via the Events API when messages are posted in channels.
 * We verify the signature, parse the event, and route it to the appropriate handler.
 *
 * @see <a href="https://api.slack.com/apis/connections/events-api">Slack Events API</a>
 */
@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class SlackResource {

    public static final String EVENTS_WEBHOOK_PATH = "/webhook/slack/project/{projectId}/events";

    // Slack request headers
    private static final String SLACK_SIGNATURE_HEADER = "X-Slack-Signature";
    private static final String SLACK_TIMESTAMP_HEADER = "X-Slack-Request-Timestamp";

    public interface Config {
        @DefaultValue("")
        String signingSecret();
    }

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;
    @Inject
    private Config config;
    @Inject
    private SlackStore slackStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private Gson gson;

    /**
     * Handle Slack Events API webhook.
     * <p>
     * This endpoint handles:
     * - URL verification challenge (required for Slack app setup)
     * - Message events (message posted, edited, deleted)
     */
    @POST
    @Path(EVENTS_WEBHOOK_PATH)
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response webhookEvents(
            @PathParam("projectId") @NotNull String projectId,
            @Valid String payload) throws IOException {

        // Verify signature
        String signature = request.getHeader(SLACK_SIGNATURE_HEADER);
        String timestamp = request.getHeader(SLACK_TIMESTAMP_HEADER);

        if (!Strings.isNullOrEmpty(config.signingSecret())) {
            SlackSignatureVerifier.verifySignature(payload, timestamp, signature, config.signingSecret());
        } else {
            log.warn("Slack signing secret not configured, skipping signature verification");
        }

        // Parse the event
        JsonObject json = gson.fromJson(payload, JsonObject.class);
        String type = json.has("type") ? json.get("type").getAsString() : null;

        // Handle URL verification challenge
        if ("url_verification".equals(type)) {
            String challenge = json.get("challenge").getAsString();
            JsonObject responseJson = new JsonObject();
            responseJson.addProperty("challenge", challenge);
            return Response.ok(gson.toJson(responseJson)).build();
        }

        // Handle event callbacks
        if ("event_callback".equals(type)) {
            JsonObject event = json.getAsJsonObject("event");
            if (event == null) {
                log.warn("Received event_callback without event object");
                return Response.ok().build();
            }

            String eventType = event.has("type") ? event.get("type").getAsString() : null;
            String subtype = event.has("subtype") ? event.get("subtype").getAsString() : null;

            // Get project
            Optional<Project> projectOpt = getProject(projectId);
            if (projectOpt.isEmpty()) {
                log.info("Received Slack event for unknown project {}", projectId);
                return Response.ok().build();
            }

            Project project = projectOpt.get();

            // Route to appropriate handler
            switch (Strings.nullToEmpty(eventType)) {
                case "message":
                    handleMessageEvent(project, event, subtype);
                    break;
                default:
                    if (LogUtil.rateLimitAllowLog("slack-resource-uninteresting-event")) {
                        log.debug("Received uninteresting Slack event type: {}", eventType);
                    }
                    break;
            }
        }

        return Response.ok().build();
    }

    private void handleMessageEvent(Project project, JsonObject event, String subtype) {
        String channelId = event.has("channel") ? event.get("channel").getAsString() : null;
        String userId = event.has("user") ? event.get("user").getAsString() : null;
        String messageTs = event.has("ts") ? event.get("ts").getAsString() : null;
        String threadTs = event.has("thread_ts") ? event.get("thread_ts").getAsString() : null;
        String text = event.has("text") ? event.get("text").getAsString() : null;
        String teamId = event.has("team") ? event.get("team").getAsString() : null;

        // For bot messages, user might be in bot_id
        if (userId == null && event.has("bot_id")) {
            userId = event.get("bot_id").getAsString();
        }

        // Handle different subtypes
        if (subtype == null) {
            // Regular new message
            SlackMessageEvent msgEvent = new SlackMessageEvent(
                    teamId, channelId, userId, messageTs, threadTs, text, "message", null);

            if (threadTs != null && !threadTs.equals(messageTs)) {
                // It's a thread reply
                slackStore.slackReplyCreated(project, msgEvent);
            } else {
                // It's a new top-level message
                slackStore.slackMessageCreated(project, msgEvent);
            }
        } else if ("message_changed".equals(subtype)) {
            // Message was edited
            JsonObject message = event.getAsJsonObject("message");
            if (message != null) {
                String editedTs = message.has("ts") ? message.get("ts").getAsString() : messageTs;
                String editedText = message.has("text") ? message.get("text").getAsString() : text;
                String editedThreadTs = message.has("thread_ts") ? message.get("thread_ts").getAsString() : threadTs;

                SlackMessageEvent msgEvent = new SlackMessageEvent(
                        teamId, channelId, userId, editedTs, editedThreadTs, editedText, "message_changed", subtype);
                slackStore.slackMessageEdited(project, msgEvent);
            }
        } else if ("message_deleted".equals(subtype)) {
            // Message was deleted
            String deletedTs = event.has("deleted_ts") ? event.get("deleted_ts").getAsString() : messageTs;

            SlackMessageEvent msgEvent = new SlackMessageEvent(
                    teamId, channelId, userId, deletedTs, threadTs, null, "message_deleted", subtype);
            slackStore.slackMessageDeleted(project, msgEvent);
        } else if ("bot_message".equals(subtype)) {
            // Bot message - ignore to prevent loops
            log.debug("Ignoring bot message in channel {}", channelId);
        } else {
            if (LogUtil.rateLimitAllowLog("slack-resource-uninteresting-message-subtype")) {
                log.debug("Ignoring message subtype: {}", subtype);
            }
        }
    }

    private Optional<Project> getProject(String projectId) {
        for (boolean useCache : ImmutableList.of(Boolean.TRUE, Boolean.FALSE)) {
            Optional<Project> projectOpt = projectStore.getProject(projectId, useCache);
            if (projectOpt.isEmpty()) {
                return Optional.empty();
            }
            // Verify Slack integration exists
            com.smotana.clearflask.api.model.Slack slackConfig =
                    projectOpt.get().getVersionedConfigAdmin().getConfig().getSlack();
            if (slackConfig != null && slackConfig.getAccessToken() != null) {
                return projectOpt;
            }
        }
        return Optional.empty();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(SlackResource.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(SlackResource.class);
            }
        };
    }
}
