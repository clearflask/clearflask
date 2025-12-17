// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.github.rholder.retry.RetryException;
import com.github.rholder.retry.RetryerBuilder;
import com.github.rholder.retry.StopStrategies;
import com.github.rholder.retry.WaitStrategies;
import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.RateLimiter;
import com.google.inject.AbstractModule;
import com.google.inject.Injector;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.ProjectAdminApi;
import com.smotana.clearflask.api.ProjectApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.billing.PlanVerifyStore;
import com.smotana.clearflask.billing.RequiresUpgradeException;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore.InvitationModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.elastic.DefaultElasticSearchProvider;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.impl.DynamoElasticAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticCommentStore;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.store.mysql.DefaultMysqlProvider;
import com.smotana.clearflask.util.DateUtil;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.AuthenticationFilter;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.security.UserBindUtil;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.joda.time.DateTime;

import javax.annotation.Nullable;
import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.text.ParseException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.web.resource.UserResource.USER_AUTH_COOKIE_NAME_PREFIX;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class ProjectResource extends AbstractResource implements ProjectApi, ProjectAdminApi {

    public interface Config {
        @DefaultValue("100")
        double exportRateLimitPerSecond();

        @DefaultValue("100")
        double importRateLimitPerSecond();
    }

    @Context
    private HttpHeaders headers;
    @Inject
    private Injector injector;
    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserResource.Config configUserResource;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private GitHubStore gitHubStore;
    @Inject
    private GitLabStore gitLabStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private UserStore userStore;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private DraftStore draftStore;
    @Inject
    private CommentStore commentStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private PlanVerifyStore planVerifyStore;
    @Inject
    private AuthCookie authCookie;
    @Inject
    private UserBindUtil userBindUtil;
    @Inject
    private Billing billing;
    @Inject
    private NotificationService notificationService;
    @Inject
    private DateUtil dateUtil;
    @Inject
    private ElasticUtil elasticUtil;
    @Inject
    private SlackStore slackStore;

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public ConfigBindSlugResult configBindSlug(String slug) {
        Project project = projectStore.getProjectBySlug(slug, true)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Project does not exist or was deleted by owner"));
        if (!Onboarding.VisibilityEnum.PUBLIC.equals(project.getVersionedConfigAdmin()
                .getConfig()
                .getUsers()
                .getOnboarding()
                .getVisibility())) {
            // For private boards, force user to login first, also hide the full config until login
            return new ConfigBindSlugResult(
                    project.getProjectId(),
                    null,
                    project.getVersionedConfig().getConfig().getUsers().getOnboarding());
        }

        return new ConfigBindSlugResult(
                project.getProjectId(),
                project.getVersionedConfig(),
                null);
    }

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public UserBindResponse userBindSlug(String slug, UserBind userBind) {
        Optional<UserBind> userBindOpt = Optional.ofNullable(userBind);
        Project project = projectStore.getProjectBySlug(slug, true)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Project does not exist or was deleted by owner"));
        Optional<UserStore.UserModel> loggedInUserOpt = userBindUtil.userBind(
                request,
                response,
                project.getProjectId(),
                getExtendedPrincipal(),
                userBindOpt.flatMap(ub -> Optional.ofNullable(Strings.emptyToNull(ub.getSsoToken()))),
                userBindOpt.flatMap(ub -> Optional.ofNullable(Strings.emptyToNull(ub.getAuthToken()))),
                userBindOpt.flatMap(ub -> Optional.ofNullable(ub.getOauthToken())),
                userBindOpt.flatMap(ub -> Optional.ofNullable(Strings.emptyToNull(ub.getBrowserPushToken()))));

        return new UserBindResponse(loggedInUserOpt
                .map(loggedInUser -> loggedInUser.toUserMeWithBalance(project.getIntercomEmailToIdentityFun()))
                .orElse(null));
    }

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public ConfigAndUserBindSlugResult configAndUserBindSlug(String slug, UserBind userBind) {
        Optional<UserBind> userBindOpt = Optional.ofNullable(userBind);
        Project project = projectStore.getProjectBySlug(slug, true)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Project does not exist or was deleted by owner"));
        Optional<UserModel> loggedInUserOpt = userBindUtil.userBind(
                request,
                response,
                project.getProjectId(),
                getExtendedPrincipal(),
                userBindOpt.flatMap(ub -> Optional.ofNullable(Strings.emptyToNull(ub.getSsoToken()))),
                userBindOpt.flatMap(ub -> Optional.ofNullable(Strings.emptyToNull(ub.getAuthToken()))),
                userBindOpt.flatMap(ub -> Optional.ofNullable(ub.getOauthToken())),
                userBindOpt.flatMap(ub -> Optional.ofNullable(Strings.emptyToNull(ub.getBrowserPushToken()))));

        if (!loggedInUserOpt.isPresent() && !Onboarding.VisibilityEnum.PUBLIC.equals(project.getVersionedConfigAdmin()
                .getConfig()
                .getUsers()
                .getOnboarding()
                .getVisibility())) {
            // For private boards, force user to login first, also hide the full config until login
            return new ConfigAndUserBindSlugResult(
                    project.getProjectId(),
                    null,
                    project.getVersionedConfig().getConfig().getUsers().getOnboarding(),
                    null);
        }

        return new ConfigAndUserBindSlugResult(
                project.getProjectId(),
                project.getVersionedConfig(),
                null,
                loggedInUserOpt.map(loggedInUser -> loggedInUser.toUserMeWithBalance(project.getIntercomEmailToIdentityFun()))
                        .orElse(null));
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configGetAdmin(String projectId) {
        Optional<Project> projectOpt = projectStore.getProject(projectId, false);
        if (!projectOpt.isPresent()) {
            throw new ApiException(Response.Status.NOT_FOUND, "Project not found");
        }
        return projectOpt.get().getVersionedConfigAdmin();
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public ConfigAndBindAllResult configGetAllAndUserBindAllAdmin() {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, false))
                .get();
        ImmutableSet<String> allProjectIds = Sets.union(account.getProjectIds(), account.getExternalProjectIds()).immutableCopy();
        ImmutableSet<Project> projects = allProjectIds.isEmpty()
                ? ImmutableSet.of()
                : projectStore.getProjects(allProjectIds, false);
        if (allProjectIds.size() != projects.size()) {
            log.info("ProjectIds on account not found in project table, email {} missing projects {}",
                    account.getEmail(), Sets.difference(allProjectIds, projects.stream()
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
                                .orElseGet(() -> {
                                    UserModel user = userStore.accountCreateOrGet(project.getProjectId(), account);
                                    UserStore.UserSession session = userStore.createSession(user,
                                            Instant.now().plus(configUserResource.sessionExpiry()).getEpochSecond());
                                    authCookie.setAuthCookie(request, response, USER_AUTH_COOKIE_NAME_PREFIX + project.getProjectId(), session.getSessionId(), session.getTtlInEpochSec());
                                    return user;
                                })
                                .toUserMeWithBalance(project.getIntercomEmailToIdentityFun()),
                        account.getExternalProjectIds().contains(project.getProjectId()))));

        return new ConfigAndBindAllResult(byProjectId);
    }

    @RolesAllowed({Role.PROJECT_ADMIN_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configSetAdmin(String projectId, ConfigAdmin configAdmin, String versionLast) {
        // Do not sanitize subdomain here, it will be sanitized in ProjectStore.
        // This allows people with restricted subdomains to continue using them.
        //
        // Amount of times I've made this mistake and rolled it back:   2
        //

        if (!projectId.equals(configAdmin.getProjectId())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Mismatching project ID");
        }

        String accountId = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .get();

        Project project = projectStore.getProject(projectId, false).get();

        Account projectAccount = accountStore.getAccount(project.getAccountId(), true).get();
        try {
            planVerifyStore.verifyConfigMeetsPlanRestrictions(projectAccount.getPlanid(), accountId, configAdmin);
        } catch (RequiresUpgradeException ex) {
            if (!billing.tryAutoUpgradePlan(projectAccount, ex.getRequiredPlanId())) {
                throw ex;
            }
        }
        boolean isSuperAdmin = getExtendedPrincipal().map(ExtendedPrincipal::getAuthenticatedSuperAccountIdOpt).isPresent();
        planVerifyStore.verifyConfigChangeMeetsRestrictions(isSuperAdmin, Optional.of(project.getVersionedConfigAdmin().getConfig()), configAdmin);

        gitHubStore.setupConfigGitHubIntegration(
                accountId,
                Optional.of(project.getVersionedConfigAdmin().getConfig()),
                configAdmin);
        gitLabStore.setupConfigGitLabIntegration(
                accountId,
                Optional.of(project.getVersionedConfigAdmin().getConfig()),
                configAdmin);

        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, projectStore.genConfigVersion());
        projectStore.updateConfig(
                projectId,
                Optional.ofNullable(Strings.emptyToNull(versionLast)),
                versionedConfigAdmin,
                isSuperAdmin);

        return versionedConfigAdmin;
    }

    @RolesAllowed({Role.PROJECT_ADMIN_ACTIVE})
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public ProjectAdminsInviteResult projectAdminsInviteAdmin(String projectId, String email) {
        Account projectAccount = projectStore.getProject(projectId, true)
                .map(Project::getAccountId)
                .flatMap(accountId -> accountStore.getAccount(accountId, true))
                .orElseThrow();

        if (projectStore.getProject(projectId, true)
                .stream()
                .map(Project::getModel)
                .flatMap(project -> Stream.concat(
                        Stream.of(project.getAccountId()),
                        project.getAdminsAccountIds().stream()))
                .map(accountId -> accountStore.getAccount(accountId, true).orElseThrow())
                .map(Account::getEmail)
                .anyMatch(email::equalsIgnoreCase)) {
            throw new ApiException(Response.Status.CONFLICT, "An admin with the same email already exists");
        }

        try {
            planVerifyStore.verifyTeammateInviteMeetsPlanRestrictions(projectAccount.getPlanid(), projectAccount.getAccountId(), true);
        } catch (RequiresUpgradeException ex) {
            if (!billing.tryAutoUpgradePlan(projectAccount, ex.getRequiredPlanId())) {
                throw ex;
            }
        }

        Account account = accountStore.getAccount(getExtendedPrincipal().flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt).get(), true).get();
        InvitationModel invitation = projectStore.createInvitation(projectId, email, account.getName());

        notificationService.onTeammateInvite(invitation);

        return new ProjectAdminsInviteResult(invitation.toInvitationAdmin());
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 1)
    @Override
    public ProjectAdminsListResult projectAdminsListAdmin(String projectId) {
        Project project = projectStore.getProject(projectId, true).get();
        ImmutableList<ProjectAdmin> admins = Stream.concat(Stream.of(project.getAccountId()), project.getModel().getAdminsAccountIds().stream())
                .map(accountId -> accountStore.getAccount(accountId, true))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(account -> account.toProjectAdmin(account.getAccountId().equals(project.getAccountId())
                        ? ProjectAdmin.RoleEnum.OWNER : ProjectAdmin.RoleEnum.ADMIN))
                .collect(ImmutableList.toImmutableList());
        ImmutableList<InvitationAdmin> invitations = projectStore.getInvitations(projectId).stream()
                .filter(Predicate.not(ProjectStore.InvitationModel::isAccepted))
                .map(InvitationModel::toInvitationAdmin)
                .collect(ImmutableList.toImmutableList());
        return new ProjectAdminsListResult(admins, invitations);
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public void projectAdminsRemoveAdmin(String projectId, @Nullable String accountId, @Nullable String invitationId) {
        if (!Strings.isNullOrEmpty(accountId)) {
            projectStore.removeAdmin(projectId, accountId);
            // This is a critical time, if something happens here, there will be inconsistent state in ownership
            accountStore.removeExternalProject(accountId, projectId);
        }
        if (!Strings.isNullOrEmpty(invitationId)) {
            projectStore.revokeInvitation(projectId, invitationId);
        }
    }

    @RolesAllowed({Role.ADMINISTRATOR_ACTIVE})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public NewProjectResult projectCreateAdmin(ConfigAdmin configAdmin) {
        boolean isSuperAdmin = getExtendedPrincipal().map(ExtendedPrincipal::getAuthenticatedSuperAccountIdOpt).isPresent();

        String projectId = projectStore.genProjectId(configAdmin.getSlug());
        configAdmin = configAdmin.toBuilder().projectId(projectId).build();

        sanitizer.subdomain(configAdmin.getSlug(), isSuperAdmin);
        Optional.ofNullable(Strings.emptyToNull(configAdmin.getDomain())).ifPresent(domain -> sanitizer.domain(domain, isSuperAdmin));
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, true))
                .get();

        try {
            planVerifyStore.verifyActionMeetsPlanRestrictions(account.getPlanid(), account.getAccountId(), PlanVerifyStore.Action.CREATE_PROJECT);
        } catch (RequiresUpgradeException ex) {
            if (!billing.tryAutoUpgradePlan(account, ex.getRequiredPlanId())) {
                throw ex;
            }
        }

        try {
            planVerifyStore.verifyConfigMeetsPlanRestrictions(account.getPlanid(), account.getAccountId(), configAdmin);
        } catch (RequiresUpgradeException ex) {
            if (!billing.tryAutoUpgradePlan(account, ex.getRequiredPlanId())) {
                throw ex;
            }
        }
        planVerifyStore.verifyConfigChangeMeetsRestrictions(isSuperAdmin, Optional.empty(), configAdmin);

        gitHubStore.setupConfigGitHubIntegration(
                account.getAccountId(),
                Optional.empty(),
                configAdmin);
        gitLabStore.setupConfigGitLabIntegration(
                account.getAccountId(),
                Optional.empty(),
                configAdmin);

        Project project = projectStore.createProject(account.getAccountId(), projectId, new VersionedConfigAdmin(configAdmin, "new"));
        try {
            RetryerBuilder.<List<Void>>newBuilder()
                    .withStopStrategy(StopStrategies.stopAfterDelay(3, TimeUnit.MINUTES))
                    .withWaitStrategy(WaitStrategies.exponentialWait(50, 15, TimeUnit.SECONDS))
                    .build()
                    .call(() -> {
                        ListenableFuture<Void> commentIndexFuture = commentStore.createIndex(projectId);
                        ListenableFuture<Void> userIndexFuture = userStore.createIndex(projectId);
                        ListenableFuture<Void> ideaIndexFuture = ideaStore.createIndex(projectId);
                        accountStore.addProject(account.getAccountId(), projectId);
                        return Futures.allAsList(commentIndexFuture, userIndexFuture, ideaIndexFuture).get(1, TimeUnit.MINUTES);
                    });
        } catch (ExecutionException | RetryException ex) {
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to create project, please contact support", ex);
        }

        UserModel accountUser = userStore.accountCreateOrGet(projectId, account);
        UserStore.UserSession session = userStore.createSession(
                accountUser,
                Instant.now().plus(configUserResource.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(request, response, USER_AUTH_COOKIE_NAME_PREFIX + projectId, session.getSessionId(), session.getTtlInEpochSec());

        return new NewProjectResult(
                projectId,
                project.getVersionedConfigAdmin(),
                accountUser.toUserMeWithBalance(project.getIntercomEmailToIdentityFun()));
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public void projectDeleteAdmin(String projectId) {
        Account account = getExtendedPrincipal()
                .flatMap(ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .flatMap(accountId -> accountStore.getAccount(accountId, true))
                .get();
        projectDeleteAdmin(account, projectId);
    }

    @Extern
    private void projectDeleteAdminExtern(String projectId) {
        Project project = projectStore.getProject(projectId, true).get();
        projectDeleteAdmin(accountStore.getAccount(project.getAccountId(), true).get(), projectId);
    }

    public void projectDeleteAdmin(Account account, String projectId) {
        try {
            ListenableFuture<Void> projectFuture = accountStore.removeProject(account.getAccountId(), projectId).getIndexingFuture();
            projectStore.deleteProject(projectId);
            ListenableFuture<Void> userFuture = userStore.deleteAllForProject(projectId);
            ListenableFuture<Void> ideaFuture = ideaStore.deleteAllForProject(projectId);
            billing.recordUsage(Billing.UsageType.POST_DELETED, account.getAccountId(), projectId);
            draftStore.deleteAllForProject(projectId);
            ListenableFuture<Void> commentFuture = commentStore.deleteAllForProject(projectId);
            voteStore.deleteAllForProject(projectId);
        } catch (Throwable th) {
            log.warn("Failed to delete project {}, potentially partially deleted", projectId, th);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to delete project, please contact support", th);
        }
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 100, challengeAfter = 1)
    @Override
    public StreamingOutput projectExportAdmin(
            String projectId,
            @Nullable Boolean includePosts,
            @Nullable Boolean includeUsers,
            @Nullable Boolean includeComments) {
        String fileName = getExportFileName(projectId, "data", "zip");
        response.setHeader("content-disposition", "attachment; filename=" + fileName);

        return (outputStream) -> {
            RateLimiter limiter = RateLimiter.create(config.exportRateLimitPerSecond());
            try (ZipOutputStream zos = new ZipOutputStream(outputStream)) {
                CSVFormat format = CSVFormat.DEFAULT;
                if (includePosts == Boolean.TRUE) {
                    zos.putNextEntry(new ZipEntry(getExportFileName(projectId, "posts", "csv")));
                    CSVPrinter csvPrinter = new CSVPrinter(new OutputStreamWriter(zos), format.withHeader(
                            "ideaId",
                            "authorUserId",
                            "created",
                            "title",
                            "description",
                            "response",
                            "categoryId",
                            "statusId",
                            "tagIds",
                            "funded",
                            "fundersCount",
                            "fundGoal",
                            "voteValue",
                            "votersCount",
                            "expressionsValue",
                            "expressions"));
                    ideaStore.exportAllForProject(projectId, idea -> {
                        try {
                            csvPrinter.printRecord(
                                    idea.getIdeaId(),
                                    idea.getAuthorUserId(),
                                    idea.getCreated(),
                                    idea.getTitle(),
                                    idea.getDescriptionSanitized(sanitizer),
                                    idea.getResponseSanitized(sanitizer),
                                    idea.getCategoryId(),
                                    idea.getStatusId(),
                                    String.join(",", idea.getTagIds()),
                                    idea.getFunded(),
                                    idea.getFundersCount(),
                                    idea.getFundGoal(),
                                    idea.getVoteValue(),
                                    idea.getVotersCount(),
                                    idea.getExpressionsValue(),
                                    idea.getExpressions() == null ? null : idea.getExpressions().entrySet().stream()
                                            .map(entry -> entry.getKey() + "=" + entry.getValue())
                                            .collect(Collectors.joining(",")));
                        } catch (IOException ex) {
                            throw new RuntimeException(ex);
                        }
                        limiter.acquire();
                    });
                    csvPrinter.flush();
                    zos.closeEntry();
                }
                if (includeUsers == Boolean.TRUE) {
                    zos.putNextEntry(new ZipEntry(getExportFileName(projectId, "users", "csv")));
                    CSVPrinter csvPrinter = new CSVPrinter(new OutputStreamWriter(zos), format.withHeader(
                            "userId",
                            "ssoGuid",
                            "isMod",
                            "name",
                            "email",
                            "emailVerified",
                            "emailNotify",
                            "balance",
                            "created"));
                    userStore.exportAllForProject(projectId, user -> {
                        try {
                            csvPrinter.printRecord(
                                    user.getUserId(),
                                    user.getSsoGuid(),
                                    user.getIsMod(),
                                    user.getName(),
                                    user.getEmail(),
                                    user.getEmailVerified(),
                                    user.isEmailNotify(),
                                    user.getBalance(),
                                    user.getCreated());
                        } catch (IOException ex) {
                            throw new RuntimeException(ex);
                        }
                        limiter.acquire();
                    });
                    csvPrinter.flush();
                    zos.closeEntry();
                }
                if (includeComments == Boolean.TRUE) {
                    zos.putNextEntry(new ZipEntry(getExportFileName(projectId, "comments", "csv")));
                    CSVPrinter csvPrinter = new CSVPrinter(new OutputStreamWriter(zos), format.withHeader(
                            "ideaId",
                            "commentId",
                            "parentCommentId",
                            "authorUserId",
                            "created",
                            "edited",
                            "content",
                            "upvotes",
                            "downvotes"));
                    commentStore.exportAllForProject(projectId, comment -> {
                        try {
                            csvPrinter.printRecord(
                                    comment.getIdeaId(),
                                    comment.getCommentId(),
                                    comment.getParentCommentIds().isEmpty()
                                            ? null
                                            : comment.getParentCommentIds().get(comment.getParentCommentIds().size() - 1),
                                    comment.getAuthorUserId(),
                                    comment.getCreated(),
                                    comment.getEdited(),
                                    comment.getContentSanitized(sanitizer),
                                    comment.getUpvotes(),
                                    comment.getDownvotes());
                        } catch (IOException ex) {
                            throw new RuntimeException(ex);
                        }
                        limiter.acquire();
                    });
                    csvPrinter.flush();
                    zos.closeEntry();
                }
            }
        };
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 100, challengeAfter = 10)
    @Override
    public ImportResponse projectImportPostAdmin(String projectId,
            String categoryId,
            String authorUserId,
            Long indexTitle,
            InputStream body,
            @Nullable Boolean firstRowIsHeader,
            @Nullable Long indexDescription,
            @Nullable Long indexStatusId,
            @Nullable Long indexStatusName,
            @Nullable Long indexTagIds,
            @Nullable Long indexTagNames,
            @Nullable Long indexVoteValue,
            @Nullable Long indexDateTime,
            @Nullable Long tzOffInMin) {
        RateLimiter limiter = RateLimiter.create(config.importRateLimitPerSecond());

        Optional<UserModel> authorOpt = userStore.getUser(projectId, authorUserId);
        if (!authorOpt.isPresent()) {
            return new ImportResponse("Author not found", true);
        }

        Optional<Project> projectOpt = projectStore.getProject(projectId, false);
        if (!projectOpt.isPresent()) {
            return new ImportResponse("Project not found", true);
        }

        Optional<Category> categoryOpt = projectOpt.get().getCategory(categoryId);
        if (!categoryOpt.isPresent()) {
            return new ImportResponse("Category not found", true);
        }

        CSVFormat format = CSVFormat.DEFAULT;
        if (firstRowIsHeader == Boolean.TRUE) {
            format = format.withFirstRecordAsHeader();
        }

        ImmutableSet<String> allStatusIds = categoryOpt.get().getWorkflow().getStatuses().stream()
                .map(IdeaStatus::getStatusId)
                .collect(ImmutableSet.toImmutableSet());
        ImmutableMap<String, String> statusNameToId = categoryOpt.get().getWorkflow().getStatuses().stream().collect(ImmutableMap
                .toImmutableMap(IdeaStatus::getName, IdeaStatus::getStatusId));

        ImmutableSet<String> allTagIds = categoryOpt.get().getTagging().getTags().stream()
                .map(Tag::getTagId)
                .collect(ImmutableSet.toImmutableSet());
        ImmutableMap<String, String> tagNameToId = categoryOpt.get().getTagging().getTags().stream().collect(ImmutableMap
                .toImmutableMap(Tag::getName, Tag::getTagId));

        AtomicLong counter = new AtomicLong(0);
        AtomicReference<DateTimeFormatter> lastDateTimeFormatter = new AtomicReference<>();
        try (CSVParser csvFileParser = CSVParser.parse(body, Charsets.UTF_8, format)) {
            ideaStore.createIdeas(projectId, StreamSupport.stream(csvFileParser.spliterator(), false).map(record -> {
                limiter.acquire();
                counter.incrementAndGet();

                String title = record.get(indexTitle.intValue());

                Optional<String> statusIdOpt = Optional.ofNullable(indexStatusId).map(Long::intValue).map(record::get);
                if (statusIdOpt.isPresent() && !allStatusIds.contains(statusIdOpt.get())) {
                    throw new ApiException(Response.Status.BAD_REQUEST, "Status with ID not found: " + statusIdOpt.get());
                }
                if (!statusIdOpt.isPresent() && indexStatusName != null) {
                    statusIdOpt = Optional.ofNullable(Strings.emptyToNull(record.get(indexStatusName.intValue()))).map(statusName -> {
                        String statusId = statusNameToId.get(statusName);
                        if (statusId == null) {
                            throw new ApiException(Response.Status.BAD_REQUEST, "Status with name not found: " + statusName);
                        }
                        return statusId;
                    });
                }

                ImmutableSet<String> tagIds = Optional.ofNullable(indexTagIds).map(Long::intValue).map(record::get).stream()
                        .flatMap(tagIdsStr -> {
                            if (tagIdsStr.startsWith("[") && tagIdsStr.endsWith("]")) {
                                tagIdsStr = tagIdsStr.substring(1, tagIdsStr.length() - 2);
                            }
                            return Arrays.stream(tagIdsStr.split(","));
                        })
                        .map(String::trim)
                        .collect(ImmutableSet.toImmutableSet());
                for (String tagId : tagIds) {
                    if (!allTagIds.contains(tagId)) {
                        throw new ApiException(Response.Status.BAD_REQUEST, "Tag with ID not found: " + tagId);
                    }
                }
                if (tagIds.isEmpty() && indexTagNames != null) {
                    tagIds = Optional.ofNullable(Strings.emptyToNull(record.get(indexTagNames.intValue())))
                            .stream()
                            .flatMap(tagIdsStr -> Arrays.stream(tagIdsStr.split(",")))
                            .map(tagName -> {
                                String tagId = tagNameToId.get(tagName);
                                if (tagId == null) {
                                    throw new ApiException(Response.Status.BAD_REQUEST, "Tag with name not found: " + tagName);
                                }
                                return tagId;
                            })
                            .collect(ImmutableSet.toImmutableSet());
                }

                Optional<Long> voteValueOpt = Optional.ofNullable(indexVoteValue).map(Long::intValue).map(record::get).map(Long::valueOf);

                Optional<Instant> createdOpt = Optional.ofNullable(indexDateTime)
                        .map(Long::intValue)
                        .map(record::get)
                        .map(dateTimeStr -> {
                            if (lastDateTimeFormatter.get() != null) {
                                try {
                                    return dateUtil.parse(dateTimeStr, lastDateTimeFormatter.get())
                                            .plus(tzOffInMin == null ? 0L : tzOffInMin, ChronoUnit.MINUTES);
                                } catch (Exception ex) {
                                    // Failed to parse using last format, continue to find new one
                                }
                            }
                            DateTimeFormatter dateTimeFormatter = dateUtil.determineDateFormat(dateTimeStr)
                                    .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Cannot parse date/time: " + dateTimeStr));
                            lastDateTimeFormatter.set(dateTimeFormatter);
                            try {
                                return dateUtil.parse(dateTimeStr, dateTimeFormatter)
                                        .plus(tzOffInMin == null ? 0L : tzOffInMin, ChronoUnit.MINUTES);
                            } catch (ParseException ex) {
                                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot parse date/time " + dateTimeStr + " usig format " + dateTimeFormatter, ex);
                            }
                        });

                return new IdeaModel(
                        projectId,
                        ideaStore.genIdeaId(title),
                        authorOpt.get().getUserId(),
                        authorOpt.get().getName(),
                        authorOpt.get().getIsMod(),
                        authorOpt.get().getPic(),
                        authorOpt.get().getPicUrl(),
                        createdOpt.orElseGet(Instant::now),
                        title,
                        Optional.ofNullable(indexDescription).map(Long::intValue).map(record::get)
                                .map(desc -> sanitizer.richHtml(desc, "idea", "import", projectId, true))
                                .orElse(null),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        categoryId,
                        statusIdOpt.orElse(null),
                        tagIds,
                        0L,
                        0L,
                        null,
                        null,
                        null,
                        voteValueOpt.orElse(null),
                        voteValueOpt.map(Math::abs).orElse(null),
                        null,
                        ImmutableMap.of(),
                        null,
                        ImmutableSet.of(),
                        ImmutableSet.of(),
                        null,
                        null,
                        ImmutableSet.of(),
                        null,
                        null,
                        null,
                        null,  // visibility
                        null); // adminNotes
            }).collect(Collectors.toList())).get();
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Failed to import CSV", ex);
            return new ImportResponse("Failed to import CSV", true);
        }

        return new ImportResponse("Successfully imported " + counter.get() + " item(s)", null);
    }

    private String getExportFileName(String projectId, String type, String extension) {
        return projectId + "-" + type + "-" + DateTime.now().toString("yyyy-MM-dd-HH-mm-ss") + "." + extension;
    }

    /**
     * One-off method to clean up projects on blocked accounts.
     */
    @Extern
    private void deleteProjectsForBlockedAccounts(boolean dryRun) {
        accountStore.listAllAccounts(account -> {
            if (!SubscriptionStatus.BLOCKED.equals(account.getStatus())) {
                return;
            }
            for (String projectId : account.getProjectIds()) {
                if (dryRun) {
                    log.info("Running in dry-run: would have deleted project for blocked account id {}, projectId {}",
                            account.getAccountId(), projectId);
                } else {
                    log.info("Deleting project for blocked account id {}, projectId {}",
                            account.getAccountId(), projectId);
                    projectDeleteAdmin(account, projectId);
                }
            }
        });
    }

    @Extern
    private void createIndexes(boolean createElasticSearch, boolean createMysql) throws Exception {
        if (createMysql) {
            injector.getInstance(DefaultMysqlProvider.class).createDatabase();
            injector.getInstance(DynamoElasticAccountStore.class).createIndexMysql();
            injector.getInstance(DynamoElasticUserStore.class).createIndexMysql();
            injector.getInstance(DynamoElasticIdeaStore.class).createIndexMysql();
            injector.getInstance(DynamoElasticCommentStore.class).createIndexMysql();
        }
        if (createElasticSearch) {
            injector.getInstance(DefaultElasticSearchProvider.class).putScripts();
            injector.getInstance(DynamoElasticAccountStore.class).createIndexElasticSearch();
            DynamoElasticUserStore dynamoElasticUserStore = injector.getInstance(DynamoElasticUserStore.class);
            DynamoElasticIdeaStore dynamoElasticIdeaStore = injector.getInstance(DynamoElasticIdeaStore.class);
            DynamoElasticCommentStore dynamoElasticCommentStore = injector.getInstance(DynamoElasticCommentStore.class);
            projectStore.listAllProjects(project -> {
                try {
                    dynamoElasticUserStore.createIndexElasticSearch(project.getProjectId());
                    dynamoElasticIdeaStore.createIndexElasticSearch(project.getProjectId());
                    dynamoElasticCommentStore.createIndexElasticSearch(project.getProjectId());
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            });
        }
    }

    @Extern
    private void reindexProjects(boolean deleteExistingIndices, boolean repopulateElasticSearch, boolean repopulateMysql) throws Exception {
        projectStore.listAllProjects(project -> {
            try {
                reindexProject(project.getProjectId(), deleteExistingIndices, repopulateElasticSearch, repopulateMysql);
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
        });
    }

    @Extern
    private void reindexProjectWithDefaultSource(String projectId, boolean deleteExistingIndices) throws Exception {
        SearchEngine searchEngine = projectStore.getSearchEngineForProject(projectId);
        reindexProject(projectId,
                deleteExistingIndices,
                searchEngine.isWriteElastic(),
                searchEngine.isWriteMysql());
    }

    @Extern
    private void reindexProject(String projectId, boolean deleteExistingIndices, boolean repopulateElasticSearch, boolean repopulateMysql) throws Exception {
        checkArgument(projectStore.getProject(projectId, false).isPresent(), "Project id does not exist: " + projectId);
        userStore.repopulateIndex(projectId, deleteExistingIndices, repopulateElasticSearch, repopulateMysql);
        ideaStore.repopulateIndex(projectId, deleteExistingIndices, repopulateElasticSearch, repopulateMysql);
        commentStore.repopulateIndex(projectId, deleteExistingIndices, repopulateElasticSearch, repopulateMysql);
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 5, challengeAfter = 10)
    @Override
    public SlackChannelsResponse slackGetChannelsAdmin(String projectId) {
        Optional<Project> projectOpt = projectStore.getProject(projectId, false);
        if (!projectOpt.isPresent()) {
            throw new ApiException(Response.Status.NOT_FOUND, "Project not found");
        }

        List<SlackStore.SlackChannel> channels = slackStore.getAvailableChannels(projectId);

        return SlackChannelsResponse.builder()
                .channels(channels.stream()
                        .map(ch -> com.smotana.clearflask.api.model.SlackChannel.builder()
                                .channelId(ch.getChannelId())
                                .channelName(ch.getChannelName())
                                .isPrivate(ch.isPrivate())
                                .isMember(ch.isMember())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ProjectResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(ProjectResource.class);
            }
        };
    }
}
