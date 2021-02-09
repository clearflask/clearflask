package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.RateLimiter;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.ProjectAdminApi;
import com.smotana.clearflask.api.ProjectApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
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
import org.elasticsearch.action.support.WriteResponse;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;
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
import java.time.Instant;
import java.util.Arrays;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

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
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserResource.Config configUserResource;
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
        Optional<Project> projectOpt = Optional.empty();
        if (slug.endsWith("." + configApp.domain())) {
            projectOpt = projectStore.getProjectBySlug(slug.substring(0, slug.indexOf('.')), true);
        }
        if (!projectOpt.isPresent()) {
            projectOpt = projectStore.getProjectBySlug(slug, true);
        }
        if (!projectOpt.isPresent()) {
            throw new ApiException(Response.Status.NOT_FOUND, "Project does not exist or was deleted by owner");
        }
        Project project = projectOpt.get();

        Optional<UserModel> loggedInUserOpt = userBind.getSkipBind() == Boolean.TRUE
            ? Optional.empty()
            : userBindUtil.userBind(
                request,
                response,
                project.getProjectId(),
                getExtendedPrincipal(),
                Optional.ofNullable(Strings.emptyToNull(userBind.getSsoToken())),
                Optional.ofNullable(Strings.emptyToNull(userBind.getAuthToken())),
                Optional.ofNullable(userBind.getOauthToken()),
                Optional.ofNullable(Strings.emptyToNull(userBind.getBrowserPushToken())));

        if (!loggedInUserOpt.isPresent() && !Onboarding.VisibilityEnum.PUBLIC.equals(project.getVersionedConfigAdmin()
                .getConfig()
                .getUsers()
                .getOnboarding()
                .getVisibility())) {
            // For private boards, force user to login first, also hide the full config until login
            return new ConfigAndBindResult(
                    null,
                    project.getVersionedConfig().getConfig().getUsers().getOnboarding(),
                    null);
        }

        return new ConfigAndBindResult(
                project.getVersionedConfig(),
                null,
                loggedInUserOpt.map(loggedInUser -> loggedInUser.toUserMeWithBalance(project.getIntercomEmailToIdentityFun()))
                        .orElse(null));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
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
        Account account = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountOpt).get();
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

        Account account = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountOpt).get();
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
        Optional.ofNullable(Strings.emptyToNull(configAdmin.getDomain())).ifPresent(sanitizer::domain);
        Account account = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountOpt).get();
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
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to create project, please contact support", ex);
        }
        return new NewProjectResult(projectId, project.getVersionedConfigAdmin());
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 10, challengeAfter = 3)
    @Override
    public void projectDeleteAdmin(String projectId) {
        Account account = getExtendedPrincipal().flatMap(ExtendedPrincipal::getAccountOpt).get();
        try {
            ListenableFuture<WriteResponse> projectFuture = accountStore.removeProject(account.getAccountId(), projectId).getIndexingFuture();
            projectStore.deleteProject(projectId);
            ListenableFuture<AcknowledgedResponse> userFuture = userStore.deleteAllForProject(projectId);
            ListenableFuture<AcknowledgedResponse> ideaFuture = ideaStore.deleteAllForProject(projectId);
            ListenableFuture<AcknowledgedResponse> commentFuture = commentStore.deleteAllForProject(projectId);
            voteStore.deleteAllForProject(projectId);
        } catch (Throwable th) {
            log.warn("Failed to delete project {}, potentially partially deleted", projectId, th);
            throw new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to delete project, please contact support", th);
        }
    }

    @RolesAllowed({Role.PROJECT_OWNER})
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
                                                 @Nullable Long indexVoteValue) {
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
        try (CSVParser csvFileParser = CSVParser.parse(body, Charsets.UTF_8, format)) {
            ideaStore.createIdeas(Iterables.transform(csvFileParser, record -> {
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
                return new IdeaModel(
                        projectId,
                        ideaStore.genIdeaId(title),
                        authorOpt.get().getUserId(),
                        authorOpt.get().getName(),
                        authorOpt.get().getIsMod(),
                        Instant.now(),
                        title,
                        Optional.ofNullable(indexDescription).map(Long::intValue).map(record::get).orElse(null),
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
                        null,
                        null);
            })).get();
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
