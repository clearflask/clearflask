package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Maps;
import com.google.common.hash.Funnels;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.VoteApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaAndExpressionsAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.IdeaStore.IdeaTransactionAndIndexingFuture;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.VoteStore.FundModel;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
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
@Path(Application.RESOURCE_VERSION)
public class VoteResource extends AbstractResource implements VoteApi {

    @Inject
    private ProjectStore projectStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private UserStore userStore;
    @Inject
    private CommentStore commentStore;
    @Inject
    private Billing billing;

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 5)
    @Override
    public CommentVoteGetOwnResponse commentVoteGetOwn(String projectId, List<String> commentIds) {
        UserModel user = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId))
                .get();

        Map<String, VoteOption> votesByCommentId = Optional.ofNullable(user.getVoteBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> commentIds.stream()
                        .filter(bloomFilter::mightContain)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(ids -> voteStore.voteSearch(projectId, user.getUserId(), ids))
                .map(m -> Maps.transformValues(m, voteModel -> VoteStore.VoteValue.fromValue(voteModel.getVote()).toVoteOption()))
                .orElse(Map.of());

        return new CommentVoteGetOwnResponse(votesByCommentId);
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 10, challengeAfter = 50)
    @Override
    public CommentVoteUpdateResponse commentVoteUpdate(String projectId, String ideaId, String commentId, CommentVoteUpdate commentVoteUpdate) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId).orElseThrow(BadRequestException::new);
        Project project = projectStore.getProject(projectId, true).orElseThrow(BadRequestException::new);

        VoteStore.VoteValue vote = VoteStore.VoteValue.fromVoteOption(commentVoteUpdate.getVote());
        CommentModel comment = commentStore.voteComment(projectId, ideaId, commentId, userId, vote)
                .getCommentModel();

        billing.recordUsage(Billing.UsageType.VOTE, project.getAccountId(), project.getProjectId(), userId);

        return new CommentVoteUpdateResponse(comment.toCommentWithVote(vote.toVoteOption()));
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 5)
    @Override
    public IdeaVoteGetOwnResponse ideaVoteGetOwn(String projectId, List<String> ideaIds) {
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

        return new IdeaVoteGetOwnResponse(
                votesByIdeaId,
                expressionByIdeaId,
                fundAmountByIdeaId);
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 10, challengeAfter = 50)
    @Override
    public IdeaVoteUpdateResponse ideaVoteUpdate(String projectId, String ideaId, IdeaVoteUpdate voteUpdate) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId).orElseThrow(BadRequestException::new);
        Project project = projectStore.getProject(projectId, true).orElseThrow(BadRequestException::new);
        IdeaModel idea = ideaStore.getIdea(projectId, ideaId).orElseThrow(BadRequestException::new);

        Optional<VoteOption> voteOptionOpt = Optional.empty();
        if (voteUpdate.getVote() != null) {
            idea = ideaStore.voteIdea(projectId, ideaId, userId, VoteStore.VoteValue.fromVoteOption(voteUpdate.getVote()))
                    .getIdea();
            voteOptionOpt = Optional.of(voteUpdate.getVote());
        }

        Optional<ImmutableSet<String>> expressionOpt = Optional.empty();
        if (voteUpdate.getExpressions() != null) {
            String categoryId = idea.getCategoryId();
            Expressing expressing = project.getCategory(categoryId)
                    .orElseThrow(BadRequestException::new)
                    .getSupport()
                    .getExpress();
            if (expressing == null) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Expressions not allowed");
            }
            if (expressing.getLimitEmojiSet() != null && expressing.getLimitEmojiSet().stream().noneMatch(e -> e.getDisplay().equals(voteUpdate.getExpressions().getExpression()))) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Expression not allowed");
            }

            IdeaAndExpressionsAndIndexingFuture result;
            if (expressing.getLimitEmojiPerIdea() == Boolean.TRUE) {
                result = ideaStore.expressIdeaSet(projectId, ideaId, userId,
                        e -> project.getCategoryExpressionWeight(categoryId, e),
                        voteUpdate.getExpressions().getAction() == IdeaVoteUpdateExpressions.ActionEnum.ADD
                                ? Optional.of(voteUpdate.getExpressions().getExpression()) : Optional.empty());
            } else if (voteUpdate.getExpressions().getAction() == IdeaVoteUpdateExpressions.ActionEnum.ADD) {
                result = ideaStore.expressIdeaAdd(projectId, ideaId, userId,
                        e -> project.getCategoryExpressionWeight(categoryId, e),
                        voteUpdate.getExpressions().getExpression());
            } else {
                result = ideaStore.expressIdeaRemove(projectId, ideaId, userId,
                        e -> project.getCategoryExpressionWeight(categoryId, e),
                        voteUpdate.getExpressions().getExpression());
            }
            idea = result.getIdea();
            expressionOpt = Optional.of(result.getExpressions());
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
                updateUserBalanceResponse = userStore.updateUserBalance(projectId, userId, -voteUpdate.getFundDiff(), Optional.of(ideaId));
                // Note: here is a critical time when funds have been taken but not yet given
                fundIdeaResponse = ideaStore.fundIdea(projectId, ideaId, userId, voteUpdate.getFundDiff(), transactionType, summary);
            } else {
                // For *RE*funding, first take from idea, then give to user
                fundIdeaResponse = ideaStore.fundIdea(projectId, ideaId, userId, -voteUpdate.getFundDiff(), transactionType, summary);
                // Note: here is a critical time when funds have been taken but not yet given
                updateUserBalanceResponse = userStore.updateUserBalance(projectId, userId, voteUpdate.getFundDiff(), Optional.of(ideaId));
            }
            balanceOpt = Optional.of(updateUserBalanceResponse.getUser().toBalance());
            transactionOpt = Optional.of(fundIdeaResponse.getTransaction().toTransaction());
            fundAmountOpt = Optional.of(fundIdeaResponse.getIdeaFundAmount());
        }

        billing.recordUsage(Billing.UsageType.VOTE, project.getAccountId(), project.getProjectId(), userId);

        return new IdeaVoteUpdateResponse(
                new IdeaVote(
                        voteOptionOpt.orElse(null),
                        expressionOpt.map(ImmutableList::copyOf).orElse(null),
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
