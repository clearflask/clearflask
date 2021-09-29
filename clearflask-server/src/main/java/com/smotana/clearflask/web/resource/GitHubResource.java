// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
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
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class GitHubResource {

    public static final String WEBHOOK_PATH = "/webhook/github";
    public static final String REPO_WEBHOOK_PATH = "/webhook/github/project/{projectId}";

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
        handle(payload, Optional.empty());
    }

    @POST
    @Path(REPO_WEBHOOK_PATH)
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public void webhookRepo(@PathParam("projectId") @NotNull String projectId, @Valid String payload) {
        handle(payload, Optional.of(projectId));
    }

    private void handle(String payload, Optional<String> projectIdOpt) {
        try {
            String eventGuid = request.getHeader(GITHUB_ID_HEADER);
            if (Strings.isNullOrEmpty(eventGuid)) {
                if (LogUtil.rateLimitAllowLog("github-resource-guid-empty")) {
                    log.warn("GitHub event guid not provided");
                }
                return;
            }

            if (!Strings.nullToEmpty(request.getHeader(GITHUB_USER_AGENT_HEADER)).startsWith(GITHUB_USER_AGENT_VALUE)) {
                if (LogUtil.rateLimitAllowLog("github-resource-useragent-mismatch")) {
                    log.warn("GitHub useragent mismatch, found {} expected {} guid {}",
                            request.getHeader(GITHUB_USER_AGENT_HEADER), GITHUB_USER_AGENT_VALUE, eventGuid);
                }
                return;
            }

            String signature = Strings.nullToEmpty(request.getHeader(GITHUB_SIGNATURE_HEADER));
            GitHubSignatureVerifier.verifySignature(payload, signature, config.webhookSecret(), eventGuid);

            String eventType = request.getHeader(GITHUB_EVENT_TYPE_HEADER);
            if (Strings.isNullOrEmpty(eventType)) {
                if (LogUtil.rateLimitAllowLog("github-resource-event-type-empty")) {
                    log.warn("GitHub event type not provided, guid {}", eventGuid);
                }
                return;
            }

            // Common webhook properties
            // https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#webhook-payload-object-common-properties
            // BE CAREFUL: some data is null depending on the event, check documentation
            GHEventPayload event = parseEventPayload(GitHub.offline(), payload, GHEventPayload.class);

            if (projectIdOpt.isPresent()) {
                long repositoryId = event.getRepository().getId();
                Optional<Project> projectOpt = projectStore.getProject(projectIdOpt.get(), true);
                Optional<com.smotana.clearflask.api.model.GitHub> integrationOpt = projectOpt.flatMap(Project::getGitHubIntegration);
                // Ensure project is linked to repo
                if (projectOpt.isEmpty() || integrationOpt.isEmpty()
                        || !integrationOpt.get().getRepositoryId().equals(repositoryId)) {
                    // Try again with no cache
                    projectOpt = projectStore.getProject(projectIdOpt.get(), false);
                    integrationOpt = projectOpt.flatMap(Project::getGitHubIntegration);
                    if (projectOpt.isEmpty() || integrationOpt.isEmpty()
                            || !integrationOpt.get().getRepositoryId().equals(repositoryId)) {
                        log.info("Unlinking webhook with repository id {} for project with different integration {}",
                                repositoryId, integrationOpt);
                        gitHubStore.unlinkRepository(projectIdOpt.get(), repositoryId, false, true);
                        // If customer uninstalls or removes a repository, but does not remove the webhook,
                        // we will continue to receive messages and there is nothing we can do about it
                        // since we don't have permission to remove the webhook.
                        // https://github.community/t/delete-a-webhook-from-unwanted-repository/14124/6
                        throw new ClientErrorException(Response.Status.GONE);
                    }
                }

                GitHubInstallation installation = gitHubClientProvider.getInstallationClient(integrationOpt.get().getInstallationId());

                if (!installation.getRateLimiter().tryAcquire()) {
                    return;
                }
                switch (eventType) {
                    case "issues":
                        GHEventPayload.Issue issue = parseEventPayload(installation.getClient(), payload, GHEventPayload.Issue.class);
                        gitHubStore.ghIssueEvent(projectOpt.get(), issue);
                        break;
                    case "issue_comment":
                        GHEventPayload.IssueComment issueComment = parseEventPayload(installation.getClient(), payload, GHEventPayload.IssueComment.class);
                        gitHubStore.ghIssueCommentEvent(projectOpt.get(), issueComment, payload);
                        break;
                    default:
                        if (LogUtil.rateLimitAllowLog("github-resource-uninteresting-event")) {
                            log.warn("Received uninteresting event {}", eventType);
                        }
                        break;
                }
            } else {
                switch (eventType) {
                    case "installation":
                        GHEventPayload.Installation installation = parseEventPayload(GitHub.offline(), payload, GHEventPayload.Installation.class);
                        log.info("Detected installation added, installationId {}", installation.getInstallation().getId());
                        installation.getRepositories().forEach(ghRepository -> log.info(
                                "Detected repository added as part of installation, name {} repoId {} installationId {}",
                                ghRepository.getFullName(), ghRepository.getId(), installation.getInstallation().getId()));
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
        } catch (Exception ex) {
            if (LogUtil.rateLimitAllowLog("github-resource-general-failure")) {
                log.warn("GitHub event general failure", ex);
            }
        }
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
