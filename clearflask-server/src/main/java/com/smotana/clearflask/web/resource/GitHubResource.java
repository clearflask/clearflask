// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.GitHubStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.github.GitHubClientProvider;
import com.smotana.clearflask.store.github.GitHubClientProvider.GitHubInstallation;
import com.smotana.clearflask.util.GitHubSignatureVerifier;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.kohsuke.github.GHEventPayload;
import org.kohsuke.github.GHRepository;
import org.kohsuke.github.GitHub;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.ClientErrorException;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringReader;
import java.util.List;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class GitHubResource {

    public static final String WEBHOOK_PATH = "/webhook/github";
    public static final String REPO_WEBHOOK_PATH = "/webhook/github/project/{projectId}/installation/{installationId}/repository/{repositoryId}";

    // See https://developer.github.com/webhooks/#payloads
    private static final String GITHUB_EVENT_TYPE_HEADER = "X-GitHub-Event";
    private static final String GITHUB_SIGNATURE_HEADER = "X-Hub-Signature-256";
    private static final String GITHUB_ID_HEADER = "X-GitHub-Delivery";
    private static final String GITHUB_USER_AGENT_HEADER = "user-agent";
    private static final String GITHUB_USER_AGENT_VALUE = "GitHub-Hookshot";

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
    private GitHubStore gitHubStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private GitHubClientProvider gitHubClientProvider;

    @POST
    @Path(WEBHOOK_PATH)
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public void webhook(@Valid String payload) {
        String eventGuid = getEventGuid();
        checkUserAgent(eventGuid);
        checkSignature(payload, eventGuid);
        String eventType = getEventType(eventGuid);

        // Common webhook properties
        // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#webhook-payload-object-common-properties
        GHEventPayload event = parseEventPayload(GitHub.offline(), payload, GHEventPayload.class);

        switch (eventType) {
            case "installation":
                GHEventPayload.Installation installation = parseEventPayload(GitHub.offline(), payload, GHEventPayload.Installation.class);
                log.info("Detected installation {}, installationId {}",
                        event.getAction(), installation.getInstallation().getId());
                List<GHRepository> repositories;
                try {
                    repositories = installation.getRepositories();
                } catch (NullPointerException ex) {
                    break; // Silly GitHub library has an NPE in certain cases
                }
                repositories.forEach(ghRepository -> log.info(
                        "Detected repository {} as part of installation, name {} repoId {} installationId {}",
                        event.getAction(), ghRepository.getFullName(), ghRepository.getId(), installation.getInstallation().getId()));
                break;
            case "installation_repositories":
                GHEventPayload.InstallationRepositories installationRepositories = parseEventPayload(GitHub.offline(), payload, GHEventPayload.InstallationRepositories.class);
                installationRepositories.getRepositoriesAdded().forEach(ghRepository -> log.info(
                        "Detected repository added, name {} repoId {} installationId {}",
                        ghRepository.getFullName(), ghRepository.getId(), installationRepositories.getInstallation().getId()));
                installationRepositories.getRepositoriesRemoved().forEach(ghRepository -> log.info(
                        "Detected repository removed, name {} repoId {} installationId {}",
                        ghRepository.getFullName(), ghRepository.getId(), installationRepositories.getInstallation().getId()));
                break;
            case "github_app_authorization":
                if ("revoked".equals(event.getAction())) {
                    // Ideally we should unlink the repository from our side however:
                    // 1. We actually don't have permission to (https://github.community/t/delete-a-webhook-from-unwanted-repository/14124/3)
                    // 2. We don't know which project(s) are affected since we can't check the webhooks.
                    // What will happen is the next event from ClearFlask will fail due to acces denied, and that call will remove the link.
                    log.info("Detected installation removed, installationId {}", event.getInstallation().getId());
                }
                break;
        }
    }

    @POST
    @Path(REPO_WEBHOOK_PATH)
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public void webhookRepo(
            @PathParam("projectId") @NotNull String projectId,
            @PathParam("installationId") @NotNull long installationId,
            @PathParam("repositoryId") @NotNull long repositoryId,
            @Valid String payload) throws IOException {
        String eventGuid = getEventGuid();
        checkUserAgent(eventGuid);
        checkSignature(payload, eventGuid);
        String eventType = getEventType(eventGuid);

        Optional<Project> projectOpt = Optional.empty();
        for (boolean useCache : ImmutableList.of(Boolean.TRUE, Boolean.FALSE)) {
            projectOpt = projectStore.getProject(projectId, true);
            if (projectOpt.isEmpty()) {
                break; // Project doesn't exist
            }
            projectOpt = projectOpt.filter(p -> p.getGitHubIntegration()
                    .filter(i -> i.getInstallationId() == installationId)
                    .filter(i -> i.getRepositoryId() == repositoryId)
                    .isPresent());
            if (projectOpt.isPresent()) {
                break; // Project is here and valid, no need to continue
            }
        }
        if (projectOpt.isEmpty()) {
            log.info("Unlinking webhook for missing integration with projectId {} installationId {} repositoryId {}",
                    projectId, installationId, repositoryId);
            gitHubStore.removeIntegrationWebhook(projectId, installationId, repositoryId);
            // If customer uninstalls or removes a repository, but does not remove the webhook,
            // we will continue to receive messages and there is nothing we can do about it
            // since we don't have permission to remove the webhook.
            // https://github.community/t/delete-a-webhook-from-unwanted-repository/14124/6
            throw new ClientErrorException(Response.Status.GONE);
        }
        Project project = projectOpt.get();
        com.smotana.clearflask.api.model.GitHub integration = project.getGitHubIntegration().get();

        GitHubInstallation installation = gitHubClientProvider.getInstallationClient(installationId);

        if (!installation.getRateLimiter().tryAcquire()) {
            throw new ClientErrorException(Response.Status.TOO_MANY_REQUESTS);
        }
        switch (eventType) {
            case "issues":
                GHEventPayload.Issue issue = parseEventPayload(installation.getClient(), payload, GHEventPayload.Issue.class);
                gitHubStore.ghIssueEvent(project, issue);
                break;
            case "issue_comment":
                GHEventPayload.IssueComment issueComment = parseEventPayload(installation.getClient(), payload, GHEventPayload.IssueComment.class);
                gitHubStore.ghIssueCommentEvent(project, issueComment, payload);
                break;
            case "release":
                GHEventPayload.Release release = parseEventPayload(installation.getClient(), payload, GHEventPayload.Release.class);
                gitHubStore.ghReleaseEvent(project, release, payload);
                break;
            default:
                if (LogUtil.rateLimitAllowLog("github-resource-uninteresting-event")) {
                    log.warn("Received uninteresting event {}", eventType);
                }
                break;
        }
    }

    private String getEventGuid() {
        String eventGuid = request.getHeader(GITHUB_ID_HEADER);
        if (Strings.isNullOrEmpty(eventGuid)) {
            if (LogUtil.rateLimitAllowLog("github-resource-guid-empty")) {
                log.warn("GitHub event guid not provided");
            }
            throw new BadRequestException("Missing header " + GITHUB_ID_HEADER);
        }
        return eventGuid;
    }

    private void checkUserAgent(String eventGuid) {
        if (!Strings.nullToEmpty(request.getHeader(GITHUB_USER_AGENT_HEADER)).startsWith(GITHUB_USER_AGENT_VALUE)) {
            if (LogUtil.rateLimitAllowLog("github-resource-useragent-mismatch")) {
                log.warn("GitHub useragent mismatch, found {} expected {} guid {}",
                        request.getHeader(GITHUB_USER_AGENT_HEADER), GITHUB_USER_AGENT_VALUE, eventGuid);
            }
            throw new BadRequestException("Invalid user-agent");
        }
    }

    private void checkSignature(String payload, String eventGuid) {
        String signature = Strings.nullToEmpty(request.getHeader(GITHUB_SIGNATURE_HEADER));
        GitHubSignatureVerifier.verifySignature(payload, signature, config.webhookSecret(), eventGuid);
    }

    private String getEventType(String eventGuid) {
        String eventType = request.getHeader(GITHUB_EVENT_TYPE_HEADER);
        if (Strings.isNullOrEmpty(eventType)) {
            if (LogUtil.rateLimitAllowLog("github-resource-event-type-empty")) {
                log.warn("GitHub event type not provided, guid {}", eventGuid);
            }
            throw new BadRequestException("Missing header " + GITHUB_EVENT_TYPE_HEADER);
        }
        return eventType;
    }

    private <T extends GHEventPayload> T parseEventPayload(GitHub gitHubClient, String payload, Class<T> type) {
        try {
            return gitHubClient.parseEventPayload(new StringReader(payload), type);
        } catch (IOException ex) {
            if (LogUtil.rateLimitAllowLog("github-resource-parse-event-failure")) {
                log.warn("GitHub event failed to parse", ex);
            }
            throw new BadRequestException();
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(GitHubResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(GitHubResource.class);
            }
        };
    }
}
