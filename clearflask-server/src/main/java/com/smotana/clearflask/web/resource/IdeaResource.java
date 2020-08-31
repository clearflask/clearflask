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
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.Billing.UsageType;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore.AccountSession;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.IdeaStore.SearchResponse;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
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
                null,
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
        ideaModel = ideaStore.voteIdea(projectId, ideaModel.getIdeaId(), ideaCreate.getAuthorUserId(), VoteValue.Upvote).getIdea();
        Project project = projectStore.getProject(projectId, true).get();
        billing.recordUsage(UsageType.POST, project.getAccountId(), project.getProjectId(), user.getUserId());
        return ideaModel.toIdeaWithVote(IdeaVote.builder().vote(VoteOption.UPVOTE).build());
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithVote ideaCreateAdmin(String projectId, IdeaCreateAdmin ideaCreateAdmin) {
        AccountSession accountSession = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAccountSessionOpt).get();
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
                ideaCreateAdmin.getStatusId(),
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
        ideaModel = ideaStore.voteIdea(projectId, ideaModel.getIdeaId(), ideaCreateAdmin.getAuthorUserId(), VoteValue.Upvote).getIdea();
        billing.recordUsage(UsageType.POST, accountSession.getAccountId(), projectId, user.getUserId());
        return ideaModel.toIdeaWithVote(IdeaVote.builder().vote(VoteOption.UPVOTE).build());
    }

    @RolesAllowed({Role.PROJECT_ANON, Role.PROJECT_USER})
    @Limit(requiredPermits = 1)
    @Override
    public IdeaWithVote ideaGet(String projectId, String ideaId) {
        Optional<UserModel> userOpt = getExtendedPrincipal()
                .flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        return ideaStore.getIdea(projectId, ideaId)
                .map(ideaModel -> userOpt.map(user -> addVote(user, ideaModel))
                        .orElseGet(() -> ideaModel.toIdeaWithVote(new IdeaVote(null, null, null))))
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaGetAdmin(String projectId, String ideaId) {
        return ideaStore.getIdea(projectId, ideaId)
                .map(IdeaModel::toIdea)
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "Idea not found"));
    }

    @RolesAllowed({Role.PROJECT_ANON, Role.PROJECT_USER})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaWithVoteSearchResponse ideaSearch(String projectId, IdeaSearch ideaSearch, String cursor) {
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
            return new IdeaWithVoteSearchResponse(null, ImmutableList.of());
        }

        ImmutableMap<String, IdeaModel> ideasById = ideaStore.getIdeas(projectId, searchResponse.getIdeaIds());

        ImmutableList<IdeaModel> ideaModels = searchResponse.getIdeaIds().stream()
                .map(ideasById::get)
                .filter(Objects::nonNull)
                .collect(ImmutableList.toImmutableList());

        return new IdeaWithVoteSearchResponse(
                searchResponse.getCursorOpt().orElse(null),
                userOpt.map(user -> addVotes(user, ideaModels))
                        .orElseGet(() -> ideaModels.stream()
                                .map(ideaModel -> ideaModel.toIdeaWithVote(new IdeaVote(null, null, null)))
                                .collect(ImmutableList.toImmutableList())));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaSearchResponse ideaSearchAdmin(String projectId, IdeaSearchAdmin ideaSearchAdmin, String cursor) {
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
                        .map(IdeaModel::toIdea)
                        .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdate(String projectId, String ideaId, IdeaUpdate ideaUpdate) {
        return ideaStore.updateIdea(projectId, ideaId, ideaUpdate).getIdea().toIdea();
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public Idea ideaUpdateAdmin(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin) {
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
        return idea.toIdea();
    }

    @RolesAllowed({Role.IDEA_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void ideaDelete(String projectId, String ideaId) {
        ideaStore.deleteIdea(projectId, ideaId);
        commentStore.deleteCommentsForIdea(projectId, ideaId);
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
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

    private IdeaWithVote addVote(UserModel user, IdeaModel idea) {
        Optional<VoteOption> voteOptionOpt = Optional.empty();
        if (user.getVoteBloom() != null
                && BloomFilters.fromByteArray(user.getVoteBloom(), Funnels.stringFunnel(Charsets.UTF_8))
                .mightContain(idea.getIdeaId())) {
            voteOptionOpt = Optional.ofNullable(voteStore.voteSearch(user.getProjectId(), user.getUserId(), ImmutableSet.of(idea.getIdeaId()))
                    .get(idea.getIdeaId()))
                    .map(voteModel -> VoteValue.fromValue(voteModel.getVote()).toVoteOption());
        }
        Optional<List<String>> expressionOpt = Optional.empty();
        if (user.getExpressBloom() != null
                && BloomFilters.fromByteArray(user.getExpressBloom(), Funnels.stringFunnel(Charsets.UTF_8))
                .mightContain(idea.getIdeaId())) {
            expressionOpt = Optional.ofNullable(voteStore.expressSearch(user.getProjectId(), user.getUserId(), ImmutableSet.of(idea.getIdeaId()))
                    .get(idea.getIdeaId()))
                    .map(expressModel -> expressModel.getExpressions().asList());
        }
        Optional<Long> fundAmountOpt = Optional.empty();
        if (user.getFundBloom() != null
                && BloomFilters.fromByteArray(user.getFundBloom(), Funnels.stringFunnel(Charsets.UTF_8))
                .mightContain(idea.getIdeaId())) {
            fundAmountOpt = Optional.ofNullable(voteStore.fundSearch(user.getProjectId(), user.getUserId(), ImmutableSet.of(idea.getIdeaId()))
                    .get(idea.getIdeaId()))
                    .map(VoteStore.FundModel::getFundAmount);
        }

        return idea.toIdeaWithVote(new IdeaVote(
                voteOptionOpt.orElse(null),
                expressionOpt.orElse(null),
                fundAmountOpt.orElse(null)
        ));
    }

    private ImmutableList<IdeaWithVote> addVotes(UserModel user, ImmutableList<IdeaModel> ideas) {
        ImmutableMap<String, VoteStore.VoteModel> voteResults = Optional.ofNullable(user.getVoteBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideas.stream()
                        .map(IdeaModel::getIdeaId)
                        .filter(bloomFilter::mightContain)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ideaIds -> voteStore.voteSearch(user.getProjectId(), user.getUserId(), ideaIds))
                .orElse(ImmutableMap.of());

        ImmutableMap<String, VoteStore.ExpressModel> expressResults = Optional.ofNullable(user.getExpressBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideas.stream()
                        .map(IdeaModel::getIdeaId)
                        .filter(bloomFilter::mightContain)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ideaIds -> voteStore.expressSearch(user.getProjectId(), user.getUserId(), ideaIds))
                .orElse(ImmutableMap.of());

        ImmutableMap<String, VoteStore.FundModel> fundResults = Optional.ofNullable(user.getFundBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideas.stream()
                        .map(IdeaModel::getIdeaId)
                        .filter(bloomFilter::mightContain)
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
                    return idea.toIdeaWithVote(voteBuilder.build());
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
