package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.ProjectAdminApi;
import com.smotana.clearflask.api.ProjectApi;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.ConfigAndBindAllResult;
import com.smotana.clearflask.api.model.ConfigAndBindAllResultByProjectId;
import com.smotana.clearflask.api.model.ConfigAndBindResult;
import com.smotana.clearflask.api.model.NewProjectResult;
import com.smotana.clearflask.api.model.Onboarding;
import com.smotana.clearflask.api.model.UserBind;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.AuthenticationFilter;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.security.UserBindUtil;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.Response;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static com.smotana.clearflask.web.resource.UserResource.USER_AUTH_COOKIE_NAME_PREFIX;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class ProjectResource extends AbstractResource implements ProjectApi, ProjectAdminApi {

    @Context
    private HttpHeaders headers;
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
    private PlanStore planStore;
    @Inject
    private AuthCookie authCookie;
    @Inject
    private UserBindUtil userBindUtil;

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public ConfigAndBindResult configGetAndUserBind(String slug, UserBind userBind) {
        Optional<Project> projectOpt = projectStore.getProjectBySlug(slug, true);
        if (!projectOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Project not found");
        }

        Optional<UserStore.UserModel> loggedInUserOpt = userBindUtil.userBind(
                response,
                projectOpt.get().getProjectId(),
                getExtendedPrincipal(),
                Optional.ofNullable(Strings.emptyToNull(userBind.getSsoToken())),
                Optional.ofNullable(Strings.emptyToNull(userBind.getAuthToken())),
                Optional.ofNullable(Strings.emptyToNull(userBind.getBrowserPushToken())));

        if (!loggedInUserOpt.isPresent() && !Onboarding.VisibilityEnum.PUBLIC.equals(projectOpt.get().getVersionedConfigAdmin()
                .getConfig()
                .getUsers()
                .getOnboarding()
                .getVisibility())) {
            // For private boards, force user to login first, also hide the full config until login
            return new ConfigAndBindResult(
                    null,
                    projectOpt.get().getVersionedConfig().getConfig().getUsers().getOnboarding(),
                    null);
        }

        return new ConfigAndBindResult(
                projectOpt.get().getVersionedConfig(),
                null,
                loggedInUserOpt.map(loggedInUser -> loggedInUser.toUserMeWithBalance(projectOpt.get().getIntercomEmailToIdentityFun()))
                        .orElse(null));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configGetAdmin(String projectId) {
        Optional<Project> projectOpt = projectStore.getProject(projectId, false);
        if (!projectOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Project not found");
        }
        return projectOpt.get().getVersionedConfigAdmin();
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public ConfigAndBindAllResult configGetAllAndUserBindAllAdmin() {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).orElseThrow(() -> {
            log.warn("Account not found for session with accountId {}", accountSession.getAccountId());
            return new InternalServerErrorException();
        });
        ImmutableSet<Project> projects = account.getProjectIds().isEmpty()
                ? ImmutableSet.of()
                : projectStore.getProjects(account.getProjectIds(), false);
        if (account.getProjectIds().size() != projects.size()) {
            log.warn("ProjectIds on account not found in project table, email {} missing projects {}",
                    account.getEmail(), Sets.difference(account.getProjectIds(), projects.stream()
                            .map(c -> c.getVersionedConfigAdmin().getConfig().getProjectId()).collect(ImmutableSet.toImmutableSet())));
        }

        ImmutableMap<String, ConfigAndBindAllResultByProjectId> byProjectId = projects.stream().collect(ImmutableMap.toImmutableMap(
                Project::getProjectId,
                project -> new ConfigAndBindAllResultByProjectId(
                        project.getVersionedConfigAdmin(),
                        Optional.ofNullable(headers.getCookies().get(USER_AUTH_COOKIE_NAME_PREFIX + project.getProjectId()))
                                .flatMap(cookie -> AuthenticationFilter.authenticateUserCookie(userStore, cookie))
                                .map(UserStore.UserSession::getUserId)
                                .flatMap(userId -> userStore.getUser(project.getProjectId(), userId))
                                .map(loggedInUser -> loggedInUser.toUserMeWithBalance(project.getIntercomEmailToIdentityFun()))
                                .orElse(null))));

        return new ConfigAndBindAllResult(byProjectId);
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configSetAdmin(String projectId, ConfigAdmin configAdmin, String versionLast) {
        // Do not sanitize subdomain here, it will be sanitized in ProjectStore.
        // This allows people with restricted subdomains to continue using them.
        //
        // Amount of times I've made this mistake and rolled it back:   2
        //

        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
        planStore.verifyConfigMeetsPlanRestrictions(account.getPlanid(), configAdmin);

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, projectStore.genConfigVersion());
        projectStore.updateConfig(
                projectId,
                Optional.ofNullable(Strings.emptyToNull(versionLast)),
                versionedConfigAdmin);

        return versionedConfigAdmin;
    }

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public NewProjectResult projectCreateAdmin(ConfigAdmin configAdmin) {
        sanitizer.subdomain(configAdmin.getSlug());
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountSessionOpt).get();
        Account account = accountStore.getAccountByAccountId(accountSession.getAccountId()).get();
        planStore.verifyConfigMeetsPlanRestrictions(account.getPlanid(), configAdmin);

        String projectId = projectStore.genProjectId(configAdmin.getSlug());
        configAdmin = configAdmin.toBuilder().projectId(projectId).build();

        Project project = projectStore.createProject(account.getAccountId(), projectId, new VersionedConfigAdmin(configAdmin, "new"));
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
            ListenableFuture<UpdateResponse> projectFuture = accountStore.removeProject(accountSession.getAccountId(), projectId).getIndexingFuture();
            projectStore.deleteProject(projectId);
            ListenableFuture<AcknowledgedResponse> userFuture = userStore.deleteAllForProject(projectId);
            ListenableFuture<AcknowledgedResponse> ideaFuture = ideaStore.deleteAllForProject(projectId);
            ListenableFuture<AcknowledgedResponse> commentFuture = commentStore.deleteAllForProject(projectId);
            voteStore.deleteAllForProject(projectId);
        } catch (Throwable th) {
            log.warn("Failed to delete project {}, potentially partially deleted", projectId, th);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to delete project, please contact support", th);
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ProjectResource.class);
            }
        };
    }
}
