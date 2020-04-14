package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Maps;
import com.google.common.hash.Funnels;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.VoteAdminApi;
import com.smotana.clearflask.api.VoteApi;
import com.smotana.clearflask.api.model.Balance;
import com.smotana.clearflask.api.model.Expressing;
import com.smotana.clearflask.api.model.Transaction;
import com.smotana.clearflask.api.model.TransactionType;
import com.smotana.clearflask.api.model.Vote;
import com.smotana.clearflask.api.model.VoteGetOwnResponse;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.api.model.VoteSearchAdmin;
import com.smotana.clearflask.api.model.VoteSearchResponse;
import com.smotana.clearflask.api.model.VoteUpdate;
import com.smotana.clearflask.api.model.VoteUpdateExpressions;
import com.smotana.clearflask.api.model.VoteUpdateResponse;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.IdeaStore.IdeaTransactionAndIndexingFuture;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.FundModel;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.NotImplementedException;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;
import org.elasticsearch.action.update.UpdateResponse;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
public class VoteResource extends AbstractResource implements VoteApi, VoteAdminApi {

    @Inject
    private ProjectStore projectStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private UserStore userStore;

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public VoteSearchResponse voteSearchAdmin(String projectId, VoteSearchAdmin voteSearchAdmin, String cursor) {
        throw new NotImplementedException();
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 5)
    @Override
    public VoteGetOwnResponse voteGetOwn(String projectId, List<String> ideaIds) {
        UserModel user = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId))
                .get();

        Map<String, VoteOption> votesByIdeaId = Optional.ofNullable(user.getVoteBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideaIds.stream()
                        .filter(bloomFilter::mightContain)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ids -> voteStore.voteSearch(projectId, user.getUserId(), ids))
                .map(m -> Maps.transformValues(m, voteModel -> VoteStore.VoteValue.fromValue(voteModel.getVote()).toVoteOption()))
                .orElse(Map.of());

        Map<String, List<String>> expressionByIdeaId = Optional.ofNullable(user.getExpressBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideaIds.stream()
                        .filter(bloomFilter::mightContain)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ids -> voteStore.expressSearch(projectId, user.getUserId(), ids))
                .map(m -> Maps.transformValues(m, expressModel -> (List<String>) expressModel.getExpressions().asList()))
                .orElse(Map.of());

        Map<String, Long> fundAmountByIdeaId = Optional.ofNullable(user.getFundBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> ideaIds.stream()
                        .filter(bloomFilter::mightContain)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ids -> voteStore.fundSearch(projectId, user.getUserId(), ids))
                .map(m -> Maps.transformValues(m, FundModel::getFundAmount))
                .orElse(Map.of());

        return new VoteGetOwnResponse(
                votesByIdeaId,
                expressionByIdeaId,
                fundAmountByIdeaId);
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 10, challengeAfter = 50)
    @Override
    public VoteUpdateResponse voteUpdate(String projectId, VoteUpdate voteUpdate) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId).orElseThrow(BadRequestException::new);
        Project project = projectStore.getProject(projectId, true).orElseThrow(BadRequestException::new);
        IdeaModel idea = ideaStore.getIdea(projectId, voteUpdate.getIdeaId()).orElseThrow(BadRequestException::new);

        Optional<VoteOption> voteOptionOpt = Optional.empty();
        if (voteUpdate.getVote() != null) {
            idea = ideaStore.voteIdea(projectId, voteUpdate.getIdeaId(), userId, VoteStore.VoteValue.fromVoteOption(voteUpdate.getVote()))
                    .getIdea();
            userStore.userVote(projectId, userId, voteUpdate.getIdeaId());
        }

        Optional<List<String>> expressionOpt = Optional.empty();
        if (voteUpdate.getExpressions() != null) {
            userStore.userExpress(projectId, userId, voteUpdate.getIdeaId());
            String categoryId = idea.getCategoryId();
            Expressing expressing = project.getCategory(categoryId)
                    .orElseThrow(BadRequestException::new)
                    .getSupport()
                    .getExpress();
            if (expressing == null) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Expressions not allowed");
            }
            if (expressing.getLimitEmojiSet().stream().noneMatch(e -> e.getDisplay().equals(voteUpdate.getExpressions().getExpression()))) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Expression not allowed");
            }

            if (expressing.getLimitEmojiPerIdea() == Boolean.TRUE) {
                idea = ideaStore.expressIdeaSet(projectId, voteUpdate.getIdeaId(), userId,
                        e -> project.getCategoryExpressionWeight(categoryId, e),
                        voteUpdate.getExpressions().getAction() == VoteUpdateExpressions.ActionEnum.ADD
                                ? Optional.of(voteUpdate.getExpressions().getExpression()) : Optional.empty())
                        .getIdea();
            } else if (voteUpdate.getExpressions().getAction() == VoteUpdateExpressions.ActionEnum.ADD) {
                idea = ideaStore.expressIdeaAdd(projectId, voteUpdate.getIdeaId(), userId,
                        e -> project.getCategoryExpressionWeight(categoryId, e),
                        voteUpdate.getExpressions().getExpression())
                        .getIdea();
            } else {
                idea = ideaStore.expressIdeaRemove(projectId, voteUpdate.getIdeaId(), userId,
                        e -> project.getCategoryExpressionWeight(categoryId, e),
                        voteUpdate.getExpressions().getExpression())
                        .getIdea();
            }
            userStore.userExpress(projectId, userId, idea.getIdeaId());
        }

        Optional<Long> fundAmountOpt = Optional.empty();
        Optional<Transaction> transactionOpt = Optional.empty();
        Optional<Balance> balanceOpt = Optional.empty();
        if (voteUpdate.getFundDiff() != null && voteUpdate.getFundDiff() != 0L) {
            String transactionType = TransactionType.VOTE.name().toLowerCase();
            String summary = "Funding for " + StringUtils.abbreviate(idea.getTitle(), 40);
            UserStore.UserAndIndexingFuture<UpdateResponse> updateUserBalanceResponse;
            IdeaTransactionAndIndexingFuture fundIdeaResponse;
            if (voteUpdate.getFundDiff() > 0) {
                // For funding, first take from user, then give to idea
                updateUserBalanceResponse = userStore.updateUserBalance(projectId, userId, -voteUpdate.getFundDiff(), Optional.of(voteUpdate.getIdeaId()));
                // Note: here is a critical time when funds have been taken but not yet given
                fundIdeaResponse = ideaStore.fundIdea(projectId, voteUpdate.getIdeaId(), userId, voteUpdate.getFundDiff(), transactionType, summary);
            } else {
                // For *RE*funding, first take from idea, then give to user
                fundIdeaResponse = ideaStore.fundIdea(projectId, voteUpdate.getIdeaId(), userId, -voteUpdate.getFundDiff(), transactionType, summary);
                // Note: here is a critical time when funds have been taken but not yet given
                updateUserBalanceResponse = userStore.updateUserBalance(projectId, userId, voteUpdate.getFundDiff(), Optional.of(voteUpdate.getIdeaId()));
            }
            balanceOpt = Optional.of(updateUserBalanceResponse.getUser().toBalance());
            transactionOpt = Optional.of(fundIdeaResponse.getTransaction().toTransaction());
        }

        return new VoteUpdateResponse(
                new Vote(
                        voteOptionOpt.orElse(null),
                        expressionOpt.orElse(null),
                        fundAmountOpt.orElse(null)),
                idea.toIdea(),
                balanceOpt.orElse(null),
                transactionOpt.orElse(null));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(VoteResource.class);
            }
        };
    }
}
