// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.hash.Funnels;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.smotana.clearflask.api.IdeaAdminApi;
import com.smotana.clearflask.api.IdeaApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.Billing.UsageType;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.IdeaStore.SearchResponse;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.ProjectStore.WebhookListener.ResourceType;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.util.WebhookService;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.Nullable;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class IdeaResource extends AbstractResource implements IdeaApi, IdeaAdminApi {

    @Inject
    private NotificationService notificationService;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private DraftStore draftStore;
    @Inject
    private CommentStore commentStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private UserStore userStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private Billing billing;
    @Inject
    private WebhookService webhookService;
    @Inject
    private GitHubStore gitHubStore;

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 30, challengeAfter = 20)
    @Override
    public IdeaWithVote ideaCreate(String projectId, IdeaCreate ideaCreate) {
        sanitizer.postTitle(ideaCreate.getTitle());
        sanitizer.content(ideaCreate.getDescription());
        Project project = projectStore.getProject(projectId, true).get();
        project.areTagsAllowedByUser(ideaCreate.getTagIds(), ideaCreate.getCategoryId());

        UserModel user = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId))
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"));
        IdeaModel ideaModel = new IdeaModel(
                projectId,
                ideaStore.genIdeaId(ideaCreate.getTitle()),
                user.getUserId(),
                user.getName(),
                user.getIsMod(),
                Instant.now(),
                ideaCreate.getTitle(),
                Strings.emptyToNull(ideaCreate.getDescription()),
                null,
                null,
                null,
                null,
                ideaCreate.getCategoryId(),
                project.getCategory(ideaCreate.getCategoryId())
                        .map(Category::getWorkflow)
                        .map(Workflow::getEntryStatus)
                        .orElse(null),
                ImmutableSet.copyOf(ideaCreate.getTagIds()),
                0L,
                0L,
                null,
                null,
                null,
                null,
                null,
                null,
                ImmutableMap.of(),
                0d,
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                null,
                ImmutableSet.of(),
                null,
                null,
                null,
                null);  // visibility - always public for user-created ideas
        boolean votingAllowed = project.isVotingAllowed(VoteValue.Upvote, ideaModel.getCategoryId(), Optional.ofNullable(ideaModel.getStatusId()));
        if (votingAllowed) {
            ideaModel = ideaStore.createIdeaAndUpvote(ideaModel).getIdea();
        } else {
            ideaStore.createIdea(ideaModel);
        }

        webhookService.eventPostNew(ideaModel, user);
        billing.recordUsage(UsageType.POST, project.getAccountId(), project.getProjectId(), user);
        return ideaModel.toIdeaWithVote(
                IdeaVote.builder().vote(votingAllowed ? VoteOption.UPVOTE : null).build(),
                sanitizer);
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaAggregateResponse ideaCategoryAggregateAdmin(String projectId, String categoryId) {
        return ideaStore.countIdeas(projectId, categoryId);
    }

    @RolesAllowed({Role.PROJECT_ADMIN_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithVote ideaCreateAdmin(String projectId, IdeaCreateAdmin ideaCreateAdmin, @Nullable String deleteDraftId) {
        sanitizer.postTitle(ideaCreateAdmin.getTitle());
        sanitizer.content(ideaCreateAdmin.getDescription());

        // Validate that only admins/mods can set visibility to Private
        // (method is already @RolesAllowed, but extra check for clarity)
        if (IdeaVisibility.PRIVATE.equals(ideaCreateAdmin.getVisibility())) {
            if (!securityContext.isUserInRole(Role.PROJECT_ADMIN_ACTIVE)
                    && !securityContext.isUserInRole(Role.PROJECT_ADMIN)
                    && !securityContext.isUserInRole(Role.PROJECT_MODERATOR_ACTIVE)
                    && !securityContext.isUserInRole(Role.PROJECT_MODERATOR)) {
                throw new ApiException(Response.Status.FORBIDDEN,
                        "Only admins and moderators can create private posts");
            }
        }

        Project project = projectStore.getProject(projectId, true).get();
        UserModel author = userStore.getUser(projectId, ideaCreateAdmin.getAuthorUserId())
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"));
        String ideaId = ideaStore.genIdeaId(ideaCreateAdmin.getTitle());
        IdeaModel ideaModel = new IdeaModel(
                projectId,
                ideaId,
                author.getUserId(),
                author.getName(),
                author.getIsMod(),
                Instant.now(),
                ideaCreateAdmin.getTitle(),
                Strings.emptyToNull(ideaCreateAdmin.getDescription()),
                Strings.emptyToNull(ideaCreateAdmin.getResponse()),
                Strings.isNullOrEmpty(ideaCreateAdmin.getResponse()) ? null : author.getUserId(),
                Strings.isNullOrEmpty(ideaCreateAdmin.getResponse()) ? null : author.getName(),
                Strings.isNullOrEmpty(ideaCreateAdmin.getResponse()) ? null : Instant.now(),
                ideaCreateAdmin.getCategoryId(),
                Optional.ofNullable(ideaCreateAdmin.getStatusId())
                        .orElseGet(() -> project.getCategory(ideaCreateAdmin.getCategoryId())
                                .map(Category::getWorkflow)
                                .map(Workflow::getEntryStatus)
                                .orElse(null)),
                ImmutableSet.copyOf(ideaCreateAdmin.getTagIds()),
                0L,
                0L,
                null,
                ideaCreateAdmin.getFundGoal(),
                null,
                null,
                null,
                null,
                ImmutableMap.of(),
                0d,
                ImmutableSet.of(),
                ImmutableSet.of(),
                null,
                null,
                ImmutableSet.of(),
                ideaCreateAdmin.getOrder(),
                null,
                ideaCreateAdmin.getCoverImg(),
                ideaCreateAdmin.getVisibility());
        boolean votingAllowed = project.isVotingAllowed(VoteValue.Upvote, ideaModel.getCategoryId(), Optional.ofNullable(ideaModel.getStatusId()));
        try {
            if (votingAllowed) {
                IdeaStore.IdeaAndIndexingFuture ideaAndUpvote = ideaStore.createIdeaAndUpvote(ideaModel);
                ideaModel = ideaAndUpvote.getIdea();
                ideaAndUpvote.getIndexingFuture().get(10, TimeUnit.SECONDS);
            } else {
                ideaStore.createIdea(ideaModel).get(10, TimeUnit.SECONDS);
            }
        } catch (InterruptedException | ExecutionException | TimeoutException e) {
            // Let it slide
        }

        if (!Strings.isNullOrEmpty(deleteDraftId)) {
            getExtendedPrincipal()
                    .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                    .map(UserSession::getUserId)
                    .ifPresent(userId -> draftStore.deleteDraft(projectId, userId, deleteDraftId));
        }

        if (ideaCreateAdmin.getLinkedFromPostIds() != null) {
            ideaCreateAdmin.getLinkedFromPostIds()
                    .forEach(linkedFromPostId -> ideaStore.linkIdeas(
                            projectId,
                            linkedFromPostId,
                            ideaId,
                            false,
                            project::getCategoryExpressionWeight));
        }

        if (ideaCreateAdmin.getNotifySubscribers() != null) {
            notificationService.onPostCreated(project, ideaModel, ideaCreateAdmin.getNotifySubscribers(), author);
        }
        // Notify the author if the post was created on their behalf by a different user or via API
        Optional<String> loggedInUserId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId);
        if (!loggedInUserId.isPresent() || !loggedInUserId.get().equals(author.getUserId())) {
            notificationService.onPostCreatedOnBehalfOf(project, ideaModel, author);
        }
        webhookService.eventPostNew(ideaModel, author);
        billing.recordUsage(UsageType.POST, project.getAccountId(), projectId, author);
        return ideaModel.toIdeaWithVote(
                IdeaVote.builder().vote(votingAllowed ? VoteOption.UPVOTE : null).build(),
                sanitizer);
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithVote ideaGet(String projectId, String ideaId) {
        Optional<UserModel> userOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        return ideaStore.getIdea(projectId, ideaId)
                .filter(ideaModel -> {
                    // Filter out private posts for non-admin users
                    if (IdeaVisibility.PRIVATE.equals(ideaModel.getVisibility())) {
                        return securityContext.isUserInRole(Role.PROJECT_ADMIN)
                                || securityContext.isUserInRole(Role.PROJECT_MODERATOR);
                    }
                    return true;
                })
                .map(ideaModel -> userOpt.map(user -> toIdeaWithVote(user, ideaModel))
                        .orElseGet(() -> ideaModel.toIdeaWithVote(
                                IdeaVote.builder().build(),
                                sanitizer)))
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaGetAllResponse ideaGetAll(String projectId, IdeaGetAll ideaGetAll) {
        Optional<UserModel> userOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        boolean isModOrAdmin = securityContext.isUserInRole(Role.PROJECT_ADMIN)
                || securityContext.isUserInRole(Role.PROJECT_MODERATOR);
        ImmutableCollection<IdeaModel> ideaModels = ideaStore.getIdeas(projectId, ideaGetAll.getPostIds().stream()
                .filter(Objects::nonNull)
                .collect(ImmutableList.toImmutableList())).values().stream()
                // Filter out private posts for non-admin users
                .filter(ideaModel -> isModOrAdmin || !IdeaVisibility.PRIVATE.equals(ideaModel.getVisibility()))
                .collect(ImmutableList.toImmutableList());
        return new IdeaGetAllResponse(userOpt.map(user -> toIdeasWithVotes(user, ideaModels))
                .orElseGet(() -> ideaModels.stream()
                        .map(ideaModel -> ideaModel.toIdeaWithVote(
                                new IdeaVote(null, null, null),
                                sanitizer))
                        .collect(ImmutableList.toImmutableList())));
    }

    @RolesAllowed({Role.PROJECT_ADMIN_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaGetAdmin(String projectId, String ideaId) {
        return ideaStore.getIdea(projectId, ideaId)
                .map(idea -> idea.toIdea(sanitizer))
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 10)
    @Override
    public HistogramResponse ideaHistogramAdmin(String projectId, IdeaHistogramSearchAdmin ideaHistogramSearchAdmin) {
        return ideaStore.histogram(projectId, ideaHistogramSearchAdmin);
    }

    @RolesAllowed({Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaConnectResponse ideaLinkAdmin(String projectId, String ideaId, String parentIdeaId) {
        Project project = projectStore.getProject(projectId, true).get();
        IdeaStore.LinkResponse linkResponse = ideaStore.linkIdeas(projectId, ideaId, parentIdeaId, false, project::getCategoryExpressionWeight);
        return new IdeaConnectResponse(linkResponse.getIdea().toIdea(sanitizer), linkResponse.getParentIdea().toIdea(sanitizer));
    }

    @RolesAllowed({Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaConnectResponse ideaUnLinkAdmin(String projectId, String ideaId, String parentIdeaId) {
        Project project = projectStore.getProject(projectId, true).get();
        IdeaStore.LinkResponse linkResponse = ideaStore.linkIdeas(projectId, ideaId, parentIdeaId, true, project::getCategoryExpressionWeight);
        return new IdeaConnectResponse(linkResponse.getIdea().toIdea(sanitizer), linkResponse.getParentIdea().toIdea(sanitizer));
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaConnectResponse ideaMerge(String projectId, String ideaId, String parentIdeaId) {
        Project project = projectStore.getProject(projectId, true).get();
        ImmutableMap<String, IdeaModel> ideas = ideaStore.getIdeas(projectId, ImmutableSet.of(ideaId, parentIdeaId));
        IdeaModel idea = ideas.get(ideaId);
        IdeaModel parentIdea = ideas.get(parentIdeaId);
        if (idea == null || parentIdea == null) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Does not exist");
        }
        boolean isUserMergeable = project.getCategory(idea.getCategoryId())
                .flatMap(c -> Optional.ofNullable(c.getUserMergeableCategoryIds()))
                .stream()
                .flatMap(Collection::stream)
                .anyMatch(parentIdea.getCategoryId()::equals);
        if (!isUserMergeable) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Cannot merge into this category");
        }
        IdeaStore.MergeResponse mergeResponse = ideaStore.mergeIdeas(projectId, ideaId, parentIdeaId, false, project::getCategoryExpressionWeight);
        return new IdeaConnectResponse(mergeResponse.getIdea().toIdea(sanitizer), mergeResponse.getParentIdea().toIdea(sanitizer));
    }

    @RolesAllowed({Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaConnectResponse ideaMergeAdmin(String projectId, String ideaId, String parentIdeaId) {
        Project project = projectStore.getProject(projectId, true).get();
        IdeaStore.MergeResponse mergeResponse = ideaStore.mergeIdeas(projectId, ideaId, parentIdeaId, false, project::getCategoryExpressionWeight);
        return new IdeaConnectResponse(mergeResponse.getIdea().toIdea(sanitizer), mergeResponse.getParentIdea().toIdea(sanitizer));
    }

    @RolesAllowed({Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaConnectResponse ideaUnMergeAdmin(String projectId, String ideaId, String parentIdeaId) {
        Project project = projectStore.getProject(projectId, true).get();
        IdeaStore.MergeResponse mergeResponse = ideaStore.mergeIdeas(projectId, ideaId, parentIdeaId, true, project::getCategoryExpressionWeight);
        return new IdeaConnectResponse(mergeResponse.getIdea().toIdea(sanitizer), mergeResponse.getParentIdea().toIdea(sanitizer));
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaWithVoteSearchResponse ideaSearch(String projectId, IdeaSearch ideaSearch, String cursor) {
        sanitizer.searchText(ideaSearch.getSearchText());

        Optional<UserModel> userOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                ideaSearch,
                userOpt.map(UserModel::getUserId),
                Optional.ofNullable(Strings.emptyToNull(cursor)));
        if (searchResponse.getIdeaIds().isEmpty()) {
            return new IdeaWithVoteSearchResponse(
                    null,
                    ImmutableList.of(),
                    null);
        }

        ImmutableMap<String, IdeaModel> ideasById = ideaStore.getIdeas(projectId, searchResponse.getIdeaIds());

        ImmutableList<IdeaModel> ideaModels = searchResponse.getIdeaIds().stream()
                .map(ideasById::get)
                .filter(Objects::nonNull)
                .collect(ImmutableList.toImmutableList());

        return new IdeaWithVoteSearchResponse(
                searchResponse.getCursorOpt().orElse(null),
                userOpt.map(user -> toIdeasWithVotes(user, ideaModels))
                        .orElseGet(() -> ideaModels.stream()
                                .map(ideaModel -> ideaModel.toIdeaWithVote(
                                        new IdeaVote(null, null, null),
                                        sanitizer))
                                .collect(ImmutableList.toImmutableList())),
                new Hits(
                        searchResponse.getTotalHits(),
                        searchResponse.isTotalHitsGte() ? true : null));
    }

    @RolesAllowed({Role.PROJECT_ADMIN, Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaSearchResponse ideaSearchAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin, String cursor) {
        sanitizer.searchText(ideaSearchAdmin.getSearchText());

        SearchResponse searchResponse = ideaStore.searchIdeas(
                projectId,
                ideaSearchAdmin,
                false,
                Optional.ofNullable(Strings.emptyToNull(cursor)));

        ImmutableMap<String, IdeaModel> ideasById = ideaStore.getIdeas(projectId, searchResponse.getIdeaIds());

        return new IdeaSearchResponse(
                searchResponse.getCursorOpt().orElse(null),
                searchResponse.getIdeaIds().stream()
                        .map(ideasById::get)
                        .filter(Objects::nonNull)
                        .map(idea -> idea.toIdea(sanitizer))
                        .collect(ImmutableList.toImmutableList()),
                new Hits(
                        searchResponse.getTotalHits(),
                        searchResponse.isTotalHitsGte() ? true : null));
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdate(String projectId, String ideaId, IdeaUpdate ideaUpdate) {
        sanitizer.postTitle(ideaUpdate.getTitle());
        sanitizer.content(ideaUpdate.getDescription());

        // Filter out private posts for non-admin users before allowing update
        IdeaModel existingIdea = ideaStore.getIdea(projectId, ideaId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Idea not found"));
        if (IdeaVisibility.PRIVATE.equals(existingIdea.getVisibility())) {
            if (!securityContext.isUserInRole(Role.PROJECT_ADMIN)
                    && !securityContext.isUserInRole(Role.PROJECT_MODERATOR)) {
                throw new ApiException(Response.Status.NOT_FOUND, "Idea not found");
            }
        }

        return ideaStore.updateIdea(projectId, ideaId, ideaUpdate)
                .getIdea()
                .toIdea(sanitizer);
    }

    @RolesAllowed({Role.PROJECT_ADMIN_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdateAdmin(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin) {
        sanitizer.postTitle(ideaUpdateAdmin.getTitle());
        sanitizer.content(ideaUpdateAdmin.getDescription());

        // Validate that only admins/mods can set visibility to Private
        // (method is already @RolesAllowed, but extra check for clarity)
        if (IdeaVisibility.PRIVATE.equals(ideaUpdateAdmin.getVisibility())) {
            if (!securityContext.isUserInRole(Role.PROJECT_ADMIN_ACTIVE)
                    && !securityContext.isUserInRole(Role.PROJECT_ADMIN)
                    && !securityContext.isUserInRole(Role.PROJECT_MODERATOR_ACTIVE)
                    && !securityContext.isUserInRole(Role.PROJECT_MODERATOR)) {
                throw new ApiException(Response.Status.FORBIDDEN,
                        "Only admins and moderators can set private visibility");
            }
        }

        Project project = projectStore.getProject(projectId, true).get();
        ConfigAdmin configAdmin = project.getVersionedConfigAdmin().getConfig();
        Optional<UserModel> authorUserOpt = Optional.ofNullable(Strings.emptyToNull(ideaUpdateAdmin.getResponseAuthorUserId()))
                .or(() -> getExtendedPrincipal()
                        .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                        .map(UserSession::getUserId))
                .flatMap(userId -> userStore.getUser(projectId, userId));
        IdeaModel idea = ideaStore.updateIdea(projectId, ideaId, ideaUpdateAdmin, authorUserOpt).getIdea();
        boolean statusChanged = !Strings.isNullOrEmpty(ideaUpdateAdmin.getStatusId());
        boolean responseChanged = !Strings.isNullOrEmpty(ideaUpdateAdmin.getResponse());
        if (ideaUpdateAdmin.getSuppressNotifications() != Boolean.TRUE) {
            if (statusChanged || responseChanged) {
                notificationService.onStatusOrResponseChanged(
                        configAdmin,
                        idea,
                        statusChanged,
                        responseChanged,
                        authorUserOpt);
            }
        }
        if (statusChanged || responseChanged) {
            gitHubStore.cfStatusAndOrResponseChangedAsync(project, idea, statusChanged, responseChanged);
        }
        if (ideaUpdateAdmin.getTagIds() != null) {
            webhookService.eventPostTagsChanged(idea);
        }
        if (statusChanged) {
            webhookService.eventPostStatusChanged(idea);
        }
        if (responseChanged) {
            webhookService.eventPostResponseChanged(idea);
        }
        return idea.toIdea(sanitizer);
    }

    @RolesAllowed({Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaVotersAdminResponse ideaVotersGetAdmin(String projectId, String ideaId, String cursor) {
        Project project = projectStore.getProject(projectId, true).get();
        VoteStore.ListResponse<VoteStore.VoteModel> votesBatch = voteStore.voteListByTarget(
                projectId,
                ideaId,
                Optional.ofNullable(Strings.emptyToNull(cursor)));
        ImmutableMap<String, UserModel> usersBatch = userStore.getUsers(
                projectId,
                votesBatch.getItems().stream()
                        .map(VoteStore.VoteModel::getUserId)
                        .collect(ImmutableList.toImmutableList()));
        return new IdeaVotersAdminResponse(
                votesBatch.getCursorOpt().orElse(null),
                usersBatch.values().stream()
                        .map(user -> user.toUserAdmin(project.getIntercomEmailToIdentityFun()))
                        .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDelete(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId, false);
        commentStore.deleteCommentsForIdea(projectId, ideaId);

        String userId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"));
        Project project = projectStore.getProject(projectId, true).get();
        billing.recordUsage(Billing.UsageType.POST_DELETED, project.getAccountId(), project.getProjectId(), userId);
    }

    @RolesAllowed({Role.PROJECT_ADMIN, Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDeleteAdmin(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId, true);
        commentStore.deleteCommentsForIdea(projectId, ideaId);

        Project project = projectStore.getProject(projectId, true).get();
        billing.recordUsage(Billing.UsageType.POST_DELETED, project.getAccountId(), project.getProjectId());
    }

    @RolesAllowed({Role.PROJECT_ADMIN})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDeleteBulkAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin) {
        sanitizer.searchText(ideaSearchAdmin.getSearchText());

        SearchResponse searchResponse = null;
        do {
            searchResponse = ideaStore.searchIdeas(
                    projectId,
                    // TODO handle the limit somehow better here
                    ideaSearchAdmin.toBuilder().limit(Math.min(
                            ideaSearchAdmin.getLimit(),
                            DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE)).build(),
                    true,
                    searchResponse == null ? Optional.empty() : searchResponse.getCursorOpt());
            ideaStore.deleteIdeas(projectId, searchResponse.getIdeaIds());
            searchResponse.getIdeaIds().forEach(ideaId -> commentStore.deleteCommentsForIdea(projectId, ideaId));
        } while (!searchResponse.getCursorOpt().isPresent());
        String accountId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedAccountIdOpt)
                .get();
        billing.recordUsage(Billing.UsageType.POST_DELETED, accountId, projectId);
    }

    @RolesAllowed({Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaDraftAdmin ideaDraftCreateAdmin(String projectId, IdeaCreateAdmin ideaCreateAdmin) {
        String userId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .get();

        return draftStore.setDraft(
                projectId,
                userId,
                Optional.empty(),
                ideaCreateAdmin).toIdeaDraftAdmin(sanitizer);
    }

    @RolesAllowed({Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDraftDeleteAdmin(String projectId, String draftId) {
        String userId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .get();

        draftStore.deleteDraft(projectId, userId, draftId);
    }

    @RolesAllowed({Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaDraftAdmin ideaDraftGetAdmin(String projectId, String draftId) {
        String userId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .get();

        return draftStore.getDraft(projectId, userId, draftId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Draft not found"))
                .toIdeaDraftAdmin(sanitizer);
    }

    @RolesAllowed({Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaDraftSearchResponse ideaDraftSearchAdmin(String projectId, IdeaDraftSearch ideaDraftSearch, @Nullable String cursor) {
        String userId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .get();

        DraftStore.SearchResponse searchResponse = draftStore.searchDrafts(projectId, userId, ideaDraftSearch, Optional.ofNullable(cursor));

        return new IdeaDraftSearchResponse(
                searchResponse.getCursorOpt().orElse(null),
                searchResponse.getDrafts().stream()
                        .map(draftModel -> draftModel.toIdeaDraftAdmin(sanitizer))
                        .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDraftUpdateAdmin(String projectId, String draftId, IdeaCreateAdmin ideaCreateAdmin) {
        String userId = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedUserSessionOpt)
                .map(UserSession::getUserId)
                .get();

        draftStore.setDraft(
                projectId,
                userId,
                Optional.of(draftId),
                ideaCreateAdmin).toIdeaDraftAdmin(sanitizer);
    }

    @RolesAllowed({Role.PROJECT_ADMIN_ACTIVE})
    @Limit(requiredPermits = 100)
    @Override
    public void ideaSubscribeAdmin(String projectId, SubscriptionListenerIdea subscriptionListener) {
        projectStore.addWebhookListener(projectId, new ProjectStore.WebhookListener(
                ResourceType.POST,
                subscriptionListener.getEventType().name(),
                subscriptionListener.getListenerUrl()));
    }

    @RolesAllowed({Role.PROJECT_ADMIN_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaUnsubscribeAdmin(String projectId, SubscriptionListenerIdea subscriptionListener) {
        projectStore.removeWebhookListener(projectId, new ProjectStore.WebhookListener(
                ResourceType.POST,
                subscriptionListener.getEventType().name(),
                subscriptionListener.getListenerUrl()));
    }

    private IdeaWithVote toIdeaWithVote(UserModel user, IdeaModel idea) {
        boolean isAuthor = user.getUserId().equals(idea.getAuthorUserId());
        Optional<VoteOption> voteOptionOpt = Optional.empty();
        if (isAuthor
                || user.getVoteBloom() != null
                && BloomFilters.fromByteArray(user.getVoteBloom(), Funnels.stringFunnel(Charsets.UTF_8))
                .mightContain(idea.getIdeaId())) {
            voteOptionOpt = Optional.ofNullable(voteStore.voteSearch(user.getProjectId(), user.getUserId(), ImmutableSet.of(idea.getIdeaId()))
                            .get(idea.getIdeaId()))
                    .map(voteModel -> VoteValue.fromValue(voteModel.getVote()).toVoteOption());
        }
        Optional<List<String>> expressionOpt = Optional.empty();
        if (isAuthor
                || user.getExpressBloom() != null
                && BloomFilters.fromByteArray(user.getExpressBloom(), Funnels.stringFunnel(Charsets.UTF_8))
                .mightContain(idea.getIdeaId())) {
            expressionOpt = Optional.ofNullable(voteStore.expressSearch(user.getProjectId(), user.getUserId(), ImmutableSet.of(idea.getIdeaId()))
                            .get(idea.getIdeaId()))
                    .map(expressModel -> expressModel.getExpressions().asList());
        }
        Optional<Long> fundAmountOpt = Optional.empty();
        if (isAuthor
                || user.getFundBloom() != null
                && BloomFilters.fromByteArray(user.getFundBloom(), Funnels.stringFunnel(Charsets.UTF_8))
                .mightContain(idea.getIdeaId())) {
            fundAmountOpt = Optional.ofNullable(voteStore.fundSearch(user.getProjectId(), user.getUserId(), ImmutableSet.of(idea.getIdeaId()))
                            .get(idea.getIdeaId()))
                    .map(VoteStore.FundModel::getFundAmount);
        }

        return idea.toIdeaWithVote(
                new IdeaVote(
                        voteOptionOpt.orElse(null),
                        expressionOpt.orElse(null),
                        fundAmountOpt.orElse(null)),
                sanitizer);
    }

    private ImmutableList<IdeaWithVote> toIdeasWithVotes(UserModel user, ImmutableCollection<IdeaModel> ideas) {
        ImmutableMap<String, VoteStore.VoteModel> voteResults = Optional.ofNullable(user.getVoteBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideas.stream()
                        .filter(idea -> user.getUserId().equals(idea.getAuthorUserId()) || bloomFilter.mightContain(idea.getIdeaId()))
                        .map(IdeaModel::getIdeaId)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ideaIds -> voteStore.voteSearch(user.getProjectId(), user.getUserId(), ideaIds))
                .orElse(ImmutableMap.of());

        ImmutableMap<String, VoteStore.ExpressModel> expressResults = Optional.ofNullable(user.getExpressBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideas.stream()
                        .filter(idea -> user.getUserId().equals(idea.getAuthorUserId()) || bloomFilter.mightContain(idea.getIdeaId()))
                        .map(IdeaModel::getIdeaId)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ideaIds -> voteStore.expressSearch(user.getProjectId(), user.getUserId(), ideaIds))
                .orElse(ImmutableMap.of());

        ImmutableMap<String, VoteStore.FundModel> fundResults = Optional.ofNullable(user.getFundBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideas.stream()
                        .filter(idea -> user.getUserId().equals(idea.getAuthorUserId()) || bloomFilter.mightContain(idea.getIdeaId()))
                        .map(IdeaModel::getIdeaId)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ideaIds -> voteStore.fundSearch(user.getProjectId(), user.getUserId(), ideaIds))
                .orElse(ImmutableMap.of());

        return ideas.stream()
                .map(idea -> {
                    IdeaVote.IdeaVoteBuilder voteBuilder = IdeaVote.builder();
                    VoteStore.VoteModel voteModel = voteResults.get(idea.getIdeaId());
                    if (voteModel != null) {
                        voteBuilder.vote(VoteValue.fromValue(voteModel.getVote()).toVoteOption());
                    }
                    VoteStore.ExpressModel expressModel = expressResults.get(idea.getIdeaId());
                    if (expressModel != null) {
                        voteBuilder.expression(expressModel.getExpressions().asList());
                    }
                    VoteStore.FundModel fundModel = fundResults.get(idea.getIdeaId());
                    if (fundModel != null) {
                        voteBuilder.fundAmount(fundModel.getFundAmount());
                    }
                    return idea.toIdeaWithVote(
                            voteBuilder.build(),
                            sanitizer);
                })
                .collect(ImmutableList.toImmutableList());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(IdeaResource.class);
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(IdeaResource.class);
            }
        };
    }
}
