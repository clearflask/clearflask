package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.base.Suppliers;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Maps;
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.VoteApi;
import com.smotana.clearflask.api.model.Balance;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.CommentVoteGetOwnResponse;
import com.smotana.clearflask.api.model.CommentVoteUpdate;
import com.smotana.clearflask.api.model.CommentVoteUpdateResponse;
import com.smotana.clearflask.api.model.Expressing;
import com.smotana.clearflask.api.model.IdeaVote;
import com.smotana.clearflask.api.model.IdeaVoteGetOwnResponse;
import com.smotana.clearflask.api.model.IdeaVoteUpdate;
import com.smotana.clearflask.api.model.IdeaVoteUpdateExpressions;
import com.smotana.clearflask.api.model.IdeaVoteUpdateResponse;
import com.smotana.clearflask.api.model.Subscription;
import com.smotana.clearflask.api.model.Transaction;
import com.smotana.clearflask.api.model.TransactionType;
import com.smotana.clearflask.api.model.UserMe;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaAndExpressionsAndIndexingFuture;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.IdeaStore.IdeaTransactionAndIndexingFuture;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.FundModel;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.util.WebhookService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

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
    @Inject
    private WebhookService webhookService;

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1)
    @Override
    public UserMe categorySubscribe(String projectId, String categoryId, Boolean subscribe) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .get();

        // Ensure subscriptions are allowed for this category
        Project project = projectStore.getProject(projectId, true)
                .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Project does not exist"));
        Category category = project.getCategory(categoryId)
                .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Category does not exist"));
        Subscription subscription = Optional.ofNullable(category.getSubscription())
                .orElseThrow(() -> new ApiException(Response.Status.BAD_REQUEST, "Subscriptions not allowed"));

        VoteValue newVote = subscribe == Boolean.TRUE ? VoteValue.Upvote : VoteValue.None;
        VoteValue prevVote = voteStore.vote(projectId, userId, categoryId, newVote);

        UserModel user = newVote.equals(prevVote)
                ? userStore.getUser(projectId, userId).get()
                : userStore.updateSubscription(projectId, userId, categoryId, subscribe == Boolean.TRUE);

        return user.toUserMe(project.getIntercomEmailToIdentityFun());
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 5)
    @Override
    public CommentVoteGetOwnResponse commentVoteGetOwn(String projectId, List<String> commentIds, List<String> myOwnCommentIds) {
        UserModel user = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId))
                .get();

        Optional<BloomFilter<CharSequence>> bloomFilterOpt = Optional.ofNullable(user.getCommentVoteBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)));
        Map<String, VoteOption> votesByCommentId = Maps.transformValues(
                voteStore.voteSearch(projectId, user.getUserId(), commentIds.stream()
                        .filter(commentId -> myOwnCommentIds.contains(commentId)
                                || bloomFilterOpt.isPresent() && bloomFilterOpt.get().mightContain(commentId))
                        .collect(ImmutableSet.toImmutableSet())), voteModel -> VoteValue.fromValue(voteModel.getVote()).toVoteOption());
        return new CommentVoteGetOwnResponse(votesByCommentId);
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 10, challengeAfter = 50)
    @Override
    public CommentVoteUpdateResponse commentVoteUpdate(String projectId, String ideaId, String commentId, CommentVoteUpdate commentVoteUpdate) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId).orElseThrow(BadRequestException::new);
        Project project = projectStore.getProject(projectId, true).orElseThrow(BadRequestException::new);

        VoteValue vote = VoteValue.fromVoteOption(commentVoteUpdate.getVote());
        CommentModel comment = commentStore.voteComment(projectId, ideaId, commentId, userId, vote)
                .getCommentModel();

        return new CommentVoteUpdateResponse(comment.toCommentWithVote(vote.toVoteOption(), sanitizer));
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 5)
    @Override
    public IdeaVoteGetOwnResponse ideaVoteGetOwn(String projectId, List<String> ideaIds, List<String> myOwnIdeaIds) {
        UserModel user = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId))
                .get();

        Optional<BloomFilter<CharSequence>> voteBloomFilterOpt = Optional.ofNullable(user.getVoteBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)));
        Map<String, VoteOption> votesByIdeaId = Maps.transformValues(
                voteStore.voteSearch(projectId, user.getUserId(), ideaIds.stream()
                        .filter(ideaId -> myOwnIdeaIds.contains(ideaId)
                                || voteBloomFilterOpt.isPresent() && voteBloomFilterOpt.get().mightContain(ideaId))
                        .collect(ImmutableSet.toImmutableSet())), voteModel -> VoteValue.fromValue(voteModel.getVote()).toVoteOption());

        Optional<BloomFilter<CharSequence>> expressBloomFilterOpt = Optional.ofNullable(user.getExpressBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)));
        Map<String, List<String>> expressionByIdeaId = Maps.transformValues(
                voteStore.expressSearch(projectId, user.getUserId(), ideaIds.stream()
                        .filter(ideaId -> myOwnIdeaIds.contains(ideaId)
                                || expressBloomFilterOpt.isPresent() && expressBloomFilterOpt.get().mightContain(ideaId))
                        .collect(ImmutableSet.toImmutableSet())), expressModel -> expressModel.getExpressions().asList());

        Optional<BloomFilter<CharSequence>> fundBloomFilterOpt = Optional.ofNullable(user.getFundBloom())
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)));
        Map<String, Long> fundAmountByIdeaId = Maps.transformValues(
                voteStore.fundSearch(projectId, user.getUserId(), ideaIds.stream()
                        .filter(ideaId -> myOwnIdeaIds.contains(ideaId)
                                || fundBloomFilterOpt.isPresent() && fundBloomFilterOpt.get().mightContain(ideaId))
                        .collect(ImmutableSet.toImmutableSet())), FundModel::getFundAmount);

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

        if (!Strings.isNullOrEmpty(idea.getMergedToPostId())) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Cannot change a merged post");
        }

        Optional<VoteOption> voteOptionOpt = Optional.empty();
        if (voteUpdate.getVote() != null) {
            VoteValue voteValue = VoteValue.fromVoteOption(voteUpdate.getVote());
            if (!project.isVotingAllowed(voteValue, idea.getCategoryId(), Optional.ofNullable(idea.getStatusId()))) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Voting not allowed");
            }
            idea = ideaStore.voteIdea(projectId, ideaId, userId, voteValue)
                    .getIdea();
            voteOptionOpt = Optional.of(voteUpdate.getVote());
        }

        Optional<ImmutableSet<String>> expressionOpt = Optional.empty();
        if (voteUpdate.getExpressions() != null) {
            if (!project.isExpressingAllowed(idea.getCategoryId(), Optional.ofNullable(idea.getStatusId()))) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Expressions not allowed");
            }

            String categoryId = idea.getCategoryId();
            Expressing expressing = project.getCategory(categoryId)
                    .orElseThrow(BadRequestException::new)
                    .getSupport()
                    .getExpress();
            if (expressing == null) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Expressions not allowed");
            }
            if (expressing.getLimitEmojiSet() != null && expressing.getLimitEmojiSet().stream().noneMatch(e -> e.getDisplay().equals(voteUpdate.getExpressions().getExpression()))) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Expression not allowed");
            }

            IdeaAndExpressionsAndIndexingFuture result;
            boolean actionIsSetOrUnset = (voteUpdate.getExpressions().getAction() == IdeaVoteUpdateExpressions.ActionEnum.SET
                    || voteUpdate.getExpressions().getAction() == IdeaVoteUpdateExpressions.ActionEnum.UNSET);
            boolean actionIsSetOrAdd = (voteUpdate.getExpressions().getAction() == IdeaVoteUpdateExpressions.ActionEnum.SET
                    || voteUpdate.getExpressions().getAction() == IdeaVoteUpdateExpressions.ActionEnum.ADD);
            if (actionIsSetOrUnset || expressing.getLimitEmojiPerIdea() == Boolean.TRUE) {
                result = ideaStore.expressIdeaSet(projectId, ideaId, userId,
                        e -> project.getCategoryExpressionWeight(categoryId, e),
                        actionIsSetOrAdd ? Optional.of(voteUpdate.getExpressions().getExpression()) : Optional.empty());
            } else if (actionIsSetOrAdd) {
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
            if (!project.isFundingAllowed(idea.getCategoryId(), Optional.ofNullable(idea.getStatusId()))) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Funding not allowed");
            }
            boolean isIdeaAuthor = userId.equals(idea.getAuthorUserId());
            Optional<String> updateBloomWithIdeaIdOpt = isIdeaAuthor ? Optional.empty() : Optional.of(ideaId);
            String transactionType = TransactionType.VOTE.name().toLowerCase();
            String summary = "Funding for " + StringUtils.abbreviate(idea.getTitle(), 40);
            UserStore.UserAndIndexingFuture updateUserBalanceResponse;
            IdeaTransactionAndIndexingFuture fundIdeaResponse;
            if (voteUpdate.getFundDiff() > 0) {
                // For funding, first take from user, then give to idea
                updateUserBalanceResponse = userStore.updateUserBalance(projectId, userId, -voteUpdate.getFundDiff(), updateBloomWithIdeaIdOpt);
                // Note: here is a critical time when funds have been taken but not yet given
                fundIdeaResponse = ideaStore.fundIdea(projectId, ideaId, userId, voteUpdate.getFundDiff(), transactionType, summary);
            } else {
                // For *RE*funding, first take from idea, then give to user
                fundIdeaResponse = ideaStore.fundIdea(projectId, ideaId, userId, voteUpdate.getFundDiff(), transactionType, summary);
                // Note: here is a critical time when funds have been taken but not yet given
                updateUserBalanceResponse = userStore.updateUserBalance(projectId, userId, -voteUpdate.getFundDiff(), updateBloomWithIdeaIdOpt);
            }
            balanceOpt = Optional.of(updateUserBalanceResponse.getUser().toBalance());
            transactionOpt = Optional.of(fundIdeaResponse.getTransaction().toTransaction());
            fundAmountOpt = Optional.of(fundIdeaResponse.getIdeaFundAmount());
            idea = fundIdeaResponse.getIdea();
        }

        billing.recordUsage(Billing.UsageType.VOTE, project.getAccountId(), project.getProjectId(), userId);
        IdeaModel ideaModel = idea;
        Supplier<UserModel> userSupplier = Suppliers.memoize(() -> userStore.getUser(projectId, userId).get());
        voteOptionOpt.ifPresent(voteOption -> webhookService.eventPostVoteChanged(ideaModel, userSupplier, voteOption));
        expressionOpt.ifPresent(expressions -> webhookService.eventPostExpressionsChanged(ideaModel, userSupplier, expressions));
        fundAmountOpt.ifPresent(fund -> webhookService.eventPostFundingChanged(ideaModel, userSupplier, voteUpdate.getFundDiff()));

        return new IdeaVoteUpdateResponse(
                new IdeaVote(
                        voteOptionOpt.orElse(null),
                        expressionOpt.map(ImmutableList::copyOf).orElse(null),
                        fundAmountOpt.orElse(null)),
                idea.toIdea(sanitizer),
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
