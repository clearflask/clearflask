// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Maps;
import com.google.common.collect.Sets;
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;
import com.smotana.clearflask.api.CommentAdminApi;
import com.smotana.clearflask.api.CommentApi;
import com.smotana.clearflask.api.model.Comment;
import com.smotana.clearflask.api.model.CommentCreate;
import com.smotana.clearflask.api.model.CommentSearch;
import com.smotana.clearflask.api.model.CommentSearchAdmin;
import com.smotana.clearflask.api.model.CommentSearchResponse;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.api.model.CommentWithVote;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramSearchAdmin;
import com.smotana.clearflask.api.model.IdeaCommentSearch;
import com.smotana.clearflask.api.model.IdeaCommentSearchResponse;
import com.smotana.clearflask.api.model.SubscriptionListenerComment;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.ProjectStore.WebhookListener.ResourceType;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.impl.DynamoElasticCommentStore;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.util.WebhookService;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.validation.Valid;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class CommentResource extends AbstractResource implements CommentAdminApi, CommentApi {

    @Inject
    private DynamoElasticCommentStore.Config configCommentStore;
    @Inject
    private CommentStore commentStore;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private UserStore userStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private NotificationService notificationService;
    @Inject
    private Billing billing;
    @Inject
    private WebhookService webhookService;

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 10, challengeAfter = 50)
    @Override
    public CommentWithVote commentCreate(String projectId, String ideaId, CommentCreate create) {
        sanitizer.content(create.getContent());

        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt).map(UserStore.UserSession::getUserId).get();
        UserModel user = userStore.getUser(projectId, userId).orElseThrow(() -> new ApiException(Response.Status.UNAUTHORIZED, "User not found"));
        Project project = projectStore.getProject(projectId, true).get();
        ConfigAdmin configAdmin = project.getVersionedConfigAdmin().getConfig();
        IdeaStore.IdeaModel idea = ideaStore.getIdea(projectId, ideaId)
                .orElseThrow(() -> new BadRequestException("Cannot create comment, containing idea doesn't exist"));
        Optional<CommentModel> parentCommentOpt = Optional.ofNullable(Strings.emptyToNull(create.getParentCommentId()))
                .map(parentCommentId -> commentStore.getComment(projectId, ideaId, parentCommentId)
                        .orElseThrow(() -> new BadRequestException("Cannot create comment, parent comment doesn't exist")));
        ImmutableList<String> parentCommentIds = parentCommentOpt.map(parentComment -> ImmutableList.<String>builder()
                .addAll(parentComment.getParentCommentIds())
                .add(parentComment.getCommentId())
                .build())
                .orElse(ImmutableList.of());
        CommentModel commentModel = commentStore.createComment(new CommentModel(
                projectId,
                ideaId,
                commentStore.genCommentId(sanitizer.richHtmlToPlaintext(create.getContent())),
                parentCommentIds,
                parentCommentIds.size(),
                0,
                user.getUserId(),
                user.getName(),
                user.getIsMod(),
                Instant.now(),
                null,
                create.getContent(),
                0,
                0))
                .getCommentModel();
        commentModel = commentStore.voteComment(projectId, commentModel.getIdeaId(), commentModel.getCommentId(), commentModel.getAuthorUserId(), VoteValue.Upvote).getCommentModel();
        notificationService.onCommentReply(
                configAdmin,
                idea,
                parentCommentOpt,
                commentModel,
                user);
        billing.recordUsage(Billing.UsageType.COMMENT, project.getAccountId(), projectId, user);
        webhookService.eventCommentNew(idea, commentModel, user);
        return commentModel.toCommentWithVote(VoteOption.UPVOTE, sanitizer);
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 10)
    @Override
    public IdeaCommentSearchResponse ideaCommentSearch(String projectId, String ideaId, IdeaCommentSearch ideaCommentSearch) {
        boolean isParent = ideaCommentSearch.getParentCommentId() != null;
        boolean isInitial = isParent && (ideaCommentSearch.getExcludeChildrenCommentIds() == null || ideaCommentSearch.getExcludeChildrenCommentIds().isEmpty());
        IdeaStore.IdeaModel idea = ideaStore.getIdea(projectId, ideaId).get();
        ImmutableSet<CommentModel> comments = commentStore.getCommentsForPost(
                projectId,
                ideaId,
                idea.getMergedPostIds(),
                Optional.ofNullable(Strings.emptyToNull(ideaCommentSearch.getParentCommentId())),
                ideaCommentSearch.getExcludeChildrenCommentIds() == null ? ImmutableSet.of() : ImmutableSet.copyOf(ideaCommentSearch.getExcludeChildrenCommentIds()));
        return new IdeaCommentSearchResponse(toCommentWithVotesAndAddMergedPostsAsComments(
                projectId,
                comments,
                Optional.of(ideaId),
                idea.getMergedPostIds(),
                isInitial ? configCommentStore.searchInitialFetchMax() : configCommentStore.searchSubsequentFetchMax(),
                ideaCommentSearch.getExcludeChildrenCommentIds()));
    }

    @RolesAllowed({Role.COMMENT_OWNER})
    @Limit(requiredPermits = 1, challengeAfter = 100)
    @Override
    public Comment commentUpdate(String projectId, String ideaId, String commentId, CommentUpdate update) {
        sanitizer.content(update.getContent());

        return commentStore.updateComment(projectId, ideaId, commentId, Instant.now(), update)
                .getCommentModel().toComment(sanitizer);
    }

    @RolesAllowed({Role.COMMENT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentDelete(String projectId, String ideaId, String commentId) {
        return commentStore.markAsDeletedComment(projectId, ideaId, commentId)
                .getCommentModel().toComment(sanitizer);
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 10)
    @Override
    public CommentSearchResponse commentSearch(String projectId, CommentSearch commentSearch, String cursor) {
        CommentStore.SearchCommentsResponse response = commentStore.searchComments(
                projectId,
                CommentSearchAdmin.builder()
                        .filterAuthorId(commentSearch.getFilterAuthorId())
                        .build(),
                false,
                Optional.ofNullable(Strings.emptyToNull(cursor)),
                Optional.empty());
        return new CommentSearchResponse(
                response.getCursorOpt().orElse(null),
                toCommentWithVotes(projectId, response.getComments()));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentDeleteAdmin(String projectId, String ideaId, String commentId) {
        return commentStore.markAsDeletedComment(projectId, ideaId, commentId)
                .getCommentModel().toComment(sanitizer);
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 10)
    @Override
    public HistogramResponse commentHistogramAdmin(String projectId, HistogramSearchAdmin histogramSearchAdmin) {
        return userStore.histogram(projectId, histogramSearchAdmin);
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public CommentSearchResponse commentSearchAdmin(String projectId, @Valid CommentSearchAdmin commentSearchAdmin, String cursor) {
        sanitizer.searchText(commentSearchAdmin.getSearchText());

        CommentStore.SearchCommentsResponse response = commentStore.searchComments(
                projectId,
                commentSearchAdmin,
                false,
                Optional.ofNullable(Strings.emptyToNull(cursor)),
                Optional.empty());
        return new CommentSearchResponse(
                response.getCursorOpt().orElse(null),
                toCommentWithVotes(projectId, response.getComments()));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 100)
    @Override
    public void commentSubscribeAdmin(String projectId, SubscriptionListenerComment subscriptionListener) {
        projectStore.addWebhookListener(projectId, new ProjectStore.WebhookListener(
                ResourceType.COMMENT,
                subscriptionListener.getEventType().name(),
                subscriptionListener.getListenerUrl()));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void commentUnsubscribeAdmin(String projectId, SubscriptionListenerComment subscriptionListener) {
        projectStore.removeWebhookListener(projectId, new ProjectStore.WebhookListener(
                ResourceType.COMMENT,
                subscriptionListener.getEventType().name(),
                subscriptionListener.getListenerUrl()));
    }

    private ImmutableList<CommentWithVote> toCommentWithVotes(String projectId, ImmutableCollection<CommentModel> comments) {
        return toCommentWithVotesAndAddMergedPostsAsComments(projectId, comments, Optional.empty(), ImmutableSet.of(), 0, ImmutableList.of());
    }

    private ImmutableList<CommentWithVote> toCommentWithVotesAndAddMergedPostsAsComments(String projectId, ImmutableCollection<CommentModel> comments, Optional<String> parentIdeaIdOpt, ImmutableSet<String> mergedPostIds, int fillUntilResultSize, List<String> excludeMergedPostIds) {
        Optional<UserModel> userOpt = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserStore.UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        Map<String, VoteOption> voteResults = ImmutableMap.of();
        if (userOpt.isPresent()) {
            Optional<BloomFilter<CharSequence>> bloomFilterOpt = userOpt.map(UserModel::getCommentVoteBloom)
                    .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)));
            voteResults = Maps.transformValues(
                    voteStore.voteSearch(projectId, userOpt.get().getUserId(), comments.stream()
                            .filter(comment -> userOpt.get().getUserId().equals(comment.getAuthorUserId())
                                    || bloomFilterOpt.isPresent() && bloomFilterOpt.get().mightContain(comment.getCommentId()))
                            .map(CommentModel::getCommentId)
                            .collect(ImmutableSet.toImmutableSet())
                    ), v -> v == null ? null : VoteValue.fromValue(v.getVote()).toVoteOption());
        }

        Set<String> additionalMergedPostIds = Sets.newHashSet();
        Map<String, VoteOption> finalVoteResults = voteResults;
        ImmutableList<CommentWithVote> commentsWithVote = comments.stream().map(comment -> comment.toCommentWithVote(
                finalVoteResults.get(comment.getCommentId()),
                sanitizer,
                // When a post is merged into another one,
                // top level comments for the other merged posts should be
                // repointed to a mocked up comment representing the merged post
                parentIdeaIdOpt
                        .filter(parentIdeaId -> !parentIdeaId.equals(comment.getIdeaId()))
                        .map(parentIdeaId -> {
                            additionalMergedPostIds.add(comment.getIdeaId());
                            return comment.getIdeaId();
                        })))
                .collect(ImmutableList.toImmutableList());

        for (String mergedPostId : mergedPostIds) {
            if (fillUntilResultSize <= (commentsWithVote.size() + additionalMergedPostIds.size())) {
                break;
            }
            additionalMergedPostIds.add(mergedPostId);
        }

        excludeMergedPostIds.forEach(additionalMergedPostIds::remove);

        if (additionalMergedPostIds.isEmpty() || !parentIdeaIdOpt.isPresent()) {
            return commentsWithVote;
        } else {
            return Stream.concat(
                    commentsWithVote.stream(),
                    ideaStore.getIdeas(projectId, ImmutableSet.copyOf(additionalMergedPostIds)).values().stream()
                            .map(mergedIdea -> mergedPostAsComment(parentIdeaIdOpt.get(), mergedIdea)))
                    .collect(ImmutableList.toImmutableList());
        }
    }

    private CommentWithVote mergedPostAsComment(String parentIdeaId, IdeaStore.IdeaModel idea) {
        return new CommentWithVote(
                parentIdeaId,
                idea.getIdeaId(),
                null,
                idea.getChildCommentCount(),
                idea.getAuthorUserId(),
                idea.getAuthorName(),
                idea.getAuthorIsMod(),
                idea.getCreated(),
                null,
                idea.getIdeaId(),
                idea.getTitle(),
                idea.getMergedToPostTime(),
                idea.getDescriptionSanitized(sanitizer),
                idea.getVoteValue() == null ? 0L : idea.getVoteValue(),
                null);
    }
}
