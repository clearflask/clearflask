package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.*;
import com.google.common.hash.Funnels;
import com.smotana.clearflask.api.CommentAdminApi;
import com.smotana.clearflask.api.CommentApi;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.*;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.util.BloomFilters;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.validation.Valid;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class CommentResource extends AbstractResource implements CommentAdminApi, CommentApi {

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

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 10, challengeAfter = 50)
    @Override
    public CommentWithVote commentCreate(String projectId, String ideaId, CommentCreate create) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt).map(UserStore.UserSession::getUserId).get();
        UserModel user = userStore.getUser(projectId, userId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.FORBIDDEN, "User not found"));
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
                commentStore.genCommentId(create.getContent()),
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
        billing.recordUsage(Billing.UsageType.COMMENT, project.getAccountId(), projectId, user.getUserId());
        return commentModel.toCommentWithVote(VoteOption.UPVOTE);
    }

    @RolesAllowed({Role.PROJECT_ANON, Role.PROJECT_USER})
    @Limit(requiredPermits = 10)
    @Override
    public CommentListResponse commentList(String projectId, String ideaId, CommentList commentList) {
        ImmutableSet<CommentModel> comments = commentStore.listComments(projectId, ideaId,
                Optional.ofNullable(Strings.emptyToNull(commentList.getParentCommentId())),
                commentList.getExcludeChildrenCommentIds() == null ? ImmutableSet.of() : ImmutableSet.copyOf(commentList.getExcludeChildrenCommentIds()));
        return new CommentListResponse(toCommentWithVotes(projectId, comments));
    }

    @RolesAllowed({Role.COMMENT_OWNER})
    @Limit(requiredPermits = 1, challengeAfter = 100)
    @Override
    public Comment commentUpdate(String projectId, String ideaId, String commentId, CommentUpdate update) {
        return commentStore.updateComment(projectId, ideaId, commentId, Instant.now(), update)
                .getCommentModel().toComment();
    }

    @RolesAllowed({Role.COMMENT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentDelete(String projectId, String ideaId, String commentId) {
        return commentStore.markAsDeletedComment(projectId, ideaId, commentId)
                .getCommentModel().toComment();
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public Comment commentDeleteAdmin(String projectId, String ideaId, String commentId) {
        return commentStore.markAsDeletedComment(projectId, ideaId, commentId)
                .getCommentModel().toComment();
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public CommentSearchResponse commentSearchAdmin(String projectId, @Valid CommentSearchAdmin commentSearchAdmin, String cursor) {
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

    private ImmutableList<CommentWithVote> toCommentWithVotes(String projectId, ImmutableCollection<CommentModel> comments) {
        Optional<UserModel> userOpt = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserStore.UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));
        ImmutableMap<String, VoteOption> voteResults = userOpt.map(UserModel::getVoteBloom)
                .map(bytes -> BloomFilters.fromByteArray(bytes, Funnels.stringFunnel(Charsets.UTF_8)))
                .map(bloomFilter -> comments.stream()
                        .map(CommentModel::getCommentId)
                        .filter(bloomFilter::mightContain)
                        .collect(ImmutableSet.toImmutableSet()))
                .map(commentIds -> voteStore.voteSearch(projectId, userOpt.get().getUserId(), commentIds))
                .map(m -> Maps.transformValues(m, v -> VoteValue.fromValue(v.getVote()).toVoteOption()))
                .map(ImmutableMap::copyOf)
                .orElse(ImmutableMap.of());
        return comments.stream()
                .map(comment -> comment.toCommentWithVote(voteResults.get(comment.getCommentId())))
                .collect(ImmutableList.toImmutableList());
    }
}
