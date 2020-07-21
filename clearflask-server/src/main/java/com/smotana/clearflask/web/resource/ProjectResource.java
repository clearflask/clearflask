package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.ProjectAdminApi;
import com.smotana.clearflask.api.ProjectApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static com.smotana.clearflask.web.resource.UserResource.USER_AUTH_COOKIE_NAME;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class ProjectResource extends AbstractResource implements ProjectApi, ProjectAdminApi {

    public interface Config {
        @DefaultValue(value = "www,admin,smotana,clearflask,veruv,mail,email,remote,blog,server,ns1,ns2,smtp,secure,vpn,m,shop,portal,support,dev,news,kaui", innerType = String.class)
        Set<String> reservedProjectIds();
    }

    @Inject
    private Config config;
    @Inject
    private UserResource.Config userResourceConfig;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private UserStore userStore;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private CommentStore commentStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private AuthCookie authCookie;

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public ConfigAndBindResult configGetAndUserBind(String projectId, ConfigGetAndUserBind configGetAndUserBind) {
        Optional<Project> projectOpt = projectStore.getProjectBySlug(projectId, true)
                .or(() -> projectStore.getProject(projectId, true));
        if (!projectOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Project not found");
        }
        Optional<UserStore.UserSession> userSessionOpt = getExtendedPrincipal().flatMap(ExtendedPrincipal::getUserSessionOpt);
        Optional<UserStore.UserModel> userOpt = userSessionOpt
                .map(UserStore.UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        boolean createSession = false;

        // Token refresh
        if (userOpt.isPresent() && userSessionOpt.get().getTtlInEpochSec() < Instant.now().plus(userResourceConfig.sessionRenewIfExpiringIn()).getEpochSecond()) {
            userSessionOpt = Optional.of(userStore.refreshSession(
                    userSessionOpt.get(),
                    Instant.now().plus(userResourceConfig.sessionExpiry()).getEpochSecond()));
            authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME, userSessionOpt.get().getSessionId(), userSessionOpt.get().getTtlInEpochSec());
        }

        // Auto login using auth token
        if (!userOpt.isPresent() && !Strings.isNullOrEmpty(configGetAndUserBind.getAuthToken())) {
            userOpt = userStore.verifyToken(configGetAndUserBind.getAuthToken());
            if (userOpt.isPresent()) {
                createSession = true;
            }
        }

        // Auto login using sso token
        if (!userOpt.isPresent() && !Strings.isNullOrEmpty(configGetAndUserBind.getSsoToken())) {
            userOpt = userStore.ssoCreateOrGet(projectId, projectOpt.get().getVersionedConfigAdmin().getConfig().getSsoSecretKey(), configGetAndUserBind.getAuthToken());
            if (userOpt.isPresent()) {
                createSession = true;
            }
        }

        // Auto login using browser push token (if email nor password is set)
        if (!userOpt.isPresent() && !Strings.isNullOrEmpty(configGetAndUserBind.getBrowserPushToken())) {
            userOpt = userStore.getUserByIdentifier(
                    projectId,
                    UserStore.IdentifierType.BROWSER_PUSH,
                    configGetAndUserBind.getBrowserPushToken());
            if (userOpt.isPresent()) {
                if (!Strings.isNullOrEmpty(userOpt.get().getPassword()) || !Strings.isNullOrEmpty(userOpt.get().getEmail())) {
                    userOpt = Optional.empty();
                } else {
                    createSession = true;
                }
            }
        }

        if (createSession) {
            UserStore.UserSession session = userStore.createSession(
                    projectId,
                    userOpt.get().getUserId(),
                    Instant.now().plus(userResourceConfig.sessionExpiry()).getEpochSecond());
            authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME, session.getSessionId(), session.getTtlInEpochSec());
        }

        return new ConfigAndBindResult(
                projectOpt.get().getVersionedConfig(),
                userOpt.map(UserStore.UserModel::toUserMeWithBalance).orElse(null));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configGetAdmin(String projectId) {
        Optional<Project> projectOpt = projectStore.getProjectBySlug(projectId, false)
                .or(() -> projectStore.getProject(projectId, false));
        if (!projectOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Project not found");
        }
        return projectOpt.get().getVersionedConfigAdmin();
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public ConfigGetAllResult configGetAllAdmin() {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).orElseThrow(() -> {
            log.error("Account not found for session with accountId {}", accountSession.getAccountId());
            return new InternalServerErrorException();
        });
        ImmutableSet<Project> projects = account.getProjectIds().isEmpty()
                ? ImmutableSet.of()
                : projectStore.getProjects(account.getProjectIds(), false);
        if (account.getProjectIds().size() != projects.size()) {
            log.error("ProjectIds on account not found in project table, email {} missing projects {}",
                    account.getEmail(), Sets.difference(account.getProjectIds(), projects.stream()
                            .map(c -> c.getVersionedConfigAdmin().getConfig().getProjectId()).collect(ImmutableSet.toImmutableSet())));
        }
        return new ConfigGetAllResult(projects.stream()
                .map(Project::getVersionedConfigAdmin)
                .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configSetAdmin(String projectId, ConfigAdmin configAdmin, String versionLast) {
        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, projectStore.genConfigVersion());
        projectStore.updateConfig(
                projectId,
                Optional.ofNullable(Strings.emptyToNull(versionLast)),
                versionedConfigAdmin);
        return versionedConfigAdmin;
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public NewProjectResult projectCreateAdmin(String projectId, ConfigAdmin configAdmin) {
        // TODO sanity check, projectId alphanumeric lowercase
        if (this.config.reservedProjectIds().contains(projectId)) {
            throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "'" + projectId + "' is a reserved name");
        }
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
        Project project = projectStore.createProject(projectId, new VersionedConfigAdmin(configAdmin, "new"));
        ListenableFuture<CreateIndexResponse> commentIndexFuture = commentStore.createIndex(projectId);
        ListenableFuture<CreateIndexResponse> userIndexFuture = userStore.createIndex(projectId);
        ListenableFuture<CreateIndexResponse> ideaIndexFuture = ideaStore.createIndex(projectId);
        accountStore.addProject(account.getAccountId(), projectId);
        try {
            Futures.allAsList(commentIndexFuture, userIndexFuture, ideaIndexFuture).get(1, TimeUnit.MINUTES);
        } catch (InterruptedException | ExecutionException | TimeoutException ex) {
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to create project, please contact support", ex);
        }
        return new NewProjectResult(projectId, project.getVersionedConfigAdmin());
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public void projectDeleteAdmin(String projectId) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        try {
            accountStore.removeProject(accountSession.getAccountId(), projectId);
            projectStore.deleteProject(projectId);
            ListenableFuture<AcknowledgedResponse> userFuture = userStore.deleteAllForProject(projectId);
            ListenableFuture<AcknowledgedResponse> ideaFuture = ideaStore.deleteAllForProject(projectId);
            ListenableFuture<AcknowledgedResponse> commentFuture = commentStore.deleteAllForProject(projectId);
            voteStore.deleteAllForProject(projectId);

            Futures.allAsList(userFuture, ideaFuture, commentFuture).get(1, TimeUnit.MINUTES);
        } catch (Throwable th) {
            log.error("Failed to delete project {}, potentially partially deleted", projectId, th);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to delete project, please contact support", th);
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ProjectResource.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
