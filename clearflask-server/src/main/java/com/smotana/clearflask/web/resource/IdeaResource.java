package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.hash.Funnels;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.IdeaAdminApi;
import com.smotana.clearflask.api.IdeaApi;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Hits;
import com.smotana.clearflask.api.model.Idea;
import com.smotana.clearflask.api.model.IdeaAggregateResponse;
import com.smotana.clearflask.api.model.IdeaCreate;
import com.smotana.clearflask.api.model.IdeaCreateAdmin;
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaSearchResponse;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.api.model.IdeaVote;
import com.smotana.clearflask.api.model.IdeaWithVote;
import com.smotana.clearflask.api.model.IdeaWithVoteSearchResponse;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.api.model.Workflow;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.Billing.UsageType;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.IdeaStore.SearchResponse;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class IdeaResource extends AbstractResource implements IdeaApi, IdeaAdminApi {

    @Inject
    private NotificationService notificationService;
    @Inject
    private IdeaStore ideaStore;
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

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 30, challengeAfter = 20)
    @Override
    public IdeaWithVote ideaCreate(String projectId, IdeaCreate ideaCreate) {
        sanitizer.postTitle(ideaCreate.getTitle());
        sanitizer.content(ideaCreate.getDescription());
        Project project = projectStore.getProject(projectId, true).get();
        project.areTagsAllowedByUser(ideaCreate.getTagIds(), ideaCreate.getCategoryId());

        UserModel user = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId))
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"));
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
                0d);
        ideaStore.createIdea(ideaModel);

        boolean votingAllowed = project.isVotingAllowed(VoteValue.Upvote, ideaModel.getCategoryId(), Optional.ofNullable(ideaModel.getStatusId()));
        if (votingAllowed) {
            ideaModel = ideaStore.voteIdea(projectId, ideaModel.getIdeaId(), ideaCreate.getAuthorUserId(), VoteValue.Upvote).getIdea();
        }

        billing.recordUsage(UsageType.POST, project.getAccountId(), project.getProjectId(), user.getUserId());
        return ideaModel.toIdeaWithVote(
                IdeaVote.builder().vote(votingAllowed ? VoteOption.UPVOTE : null).build(),
                sanitizer);
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaAggregateResponse ideaCategoryAggregateAdmin(String projectId, String categoryId) {
        return ideaStore.countIdeas(projectId, categoryId);
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithVote ideaCreateAdmin(String projectId, IdeaCreateAdmin ideaCreateAdmin) {
        sanitizer.postTitle(ideaCreateAdmin.getTitle());
        sanitizer.content(ideaCreateAdmin.getDescription());

        Project project = projectStore.getProject(projectId, true).get();
        UserModel user = userStore.getUser(projectId, ideaCreateAdmin.getAuthorUserId())
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"));
        IdeaModel ideaModel = new IdeaModel(
                projectId,
                ideaStore.genIdeaId(ideaCreateAdmin.getTitle()),
                user.getUserId(),
                user.getName(),
                user.getIsMod(),
                Instant.now(),
                ideaCreateAdmin.getTitle(),
                Strings.emptyToNull(ideaCreateAdmin.getDescription()),
                Strings.emptyToNull(ideaCreateAdmin.getResponse()),
                Strings.isNullOrEmpty(ideaCreateAdmin.getResponse()) ? null : user.getUserId(),
                Strings.isNullOrEmpty(ideaCreateAdmin.getResponse()) ? null : user.getName(),
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
                0d);
        ideaStore.createIdea(ideaModel);

        boolean votingAllowed = project.isVotingAllowed(VoteValue.Upvote, ideaModel.getCategoryId(), Optional.ofNullable(ideaModel.getStatusId()));
        if (votingAllowed) {
            ideaModel = ideaStore.voteIdea(projectId, ideaModel.getIdeaId(), ideaCreateAdmin.getAuthorUserId(), VoteValue.Upvote).getIdea();
        }
        billing.recordUsage(UsageType.POST, project.getAccountId(), projectId, user.getUserId());
        return ideaModel.toIdeaWithVote(
                IdeaVote.builder().vote(votingAllowed ? VoteOption.UPVOTE : null).build(),
                sanitizer);
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithVote ideaGet(String projectId, String ideaId) {
        Optional<UserModel> userOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        return ideaStore.getIdea(projectId, ideaId)
                .map(ideaModel -> userOpt.map(user -> toIdeaWithVote(user, ideaModel))
                        .orElseGet(() -> ideaModel.toIdeaWithVote(
                                IdeaVote.builder().build(),
                                sanitizer)))
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaGetAdmin(String projectId, String ideaId) {
        return ideaStore.getIdea(projectId, ideaId)
                .map(idea -> idea.toIdea(sanitizer))
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaWithVoteSearchResponse ideaSearch(String projectId, IdeaSearch ideaSearch, String cursor) {
        sanitizer.searchText(ideaSearch.getSearchText());

        Optional<UserModel> userOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
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

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
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

        return ideaStore.updateIdea(projectId, ideaId, ideaUpdate)
                .getIdea()
                .toIdea(sanitizer);
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdateAdmin(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin) {
        sanitizer.postTitle(ideaUpdateAdmin.getTitle());
        sanitizer.content(ideaUpdateAdmin.getDescription());

        ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
        Optional<UserModel> userOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        IdeaModel idea = ideaStore.updateIdea(projectId, ideaId, ideaUpdateAdmin, userOpt).getIdea();
        if (ideaUpdateAdmin.getSuppressNotifications() != Boolean.TRUE) {
            boolean statusChanged = !Strings.isNullOrEmpty(ideaUpdateAdmin.getStatusId());
            boolean responseChanged = !Strings.isNullOrEmpty(ideaUpdateAdmin.getResponse());
            if (statusChanged || responseChanged) {
                notificationService.onStatusOrResponseChanged(
                        configAdmin,
                        idea,
                        statusChanged,
                        responseChanged);
            }
        }
        return idea.toIdea(sanitizer);
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDelete(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId);
        commentStore.deleteCommentsForIdea(projectId, ideaId);
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDeleteAdmin(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId);
        commentStore.deleteCommentsForIdea(projectId, ideaId);
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
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

    private ImmutableList<IdeaWithVote> toIdeasWithVotes(UserModel user, ImmutableList<IdeaModel> ideas) {
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
            }
        };
    }
}
