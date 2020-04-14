package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.CommentAdminApi;
import com.smotana.clearflask.api.CommentApi;
import com.smotana.clearflask.api.model.CommentCreate;
import com.smotana.clearflask.api.model.CommentSearch;
import com.smotana.clearflask.api.model.CommentSearchResponse;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.api.model.CommentWithAuthor;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.CommentStore;
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
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
    private NotificationService notificationService;

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 10, challengeAfter = 50)
    @Override
    public CommentWithAuthor commentCreate(String projectId, String ideaId, CommentCreate create) {
        String userId = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt).map(UserStore.UserSession::getUserId).get();
        UserModel user = userStore.getUser(projectId, userId).orElseThrow(() -> new ErrorWithMessageException(Response.Status.FORBIDDEN, "User not found"));
        ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
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
                Instant.now(),
                null,
                create.getContent(),
                0,
                0))
                .getCommentModel();
        notificationService.onCommentReply(
                configAdmin,
                idea,
                parentCommentOpt,
                commentModel,
                user);
        return commentModel.toCommentWithAuthor();
    }

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public CommentSearchResponse commentList(String projectId, String ideaId, CommentSearch commentSearch) {
        return new CommentSearchResponse(commentStore.searchComments(projectId, ideaId,
                Optional.ofNullable(Strings.emptyToNull(commentSearch.getParentCommentId())),
                commentSearch.getExcludeChildrenCommentIds() == null ? ImmutableSet.of() : ImmutableSet.copyOf(commentSearch.getExcludeChildrenCommentIds()))
                .stream()
                .map(CommentModel::toCommentWithAuthor)
                .collect(ImmutableList.toImmutableList()));
    }

    @RolesAllowed({Role.COMMENT_OWNER})
    @Limit(requiredPermits = 1, challengeAfter = 100)
    @Override
    public CommentWithAuthor commentUpdate(String projectId, String ideaId, String commentId, CommentUpdate update) {
        return commentStore.updateComment(projectId, ideaId, commentId, Instant.now(), update)
                .getCommentModel().toCommentWithAuthor();
    }

    @RolesAllowed({Role.COMMENT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public CommentWithAuthor commentDelete(String projectId, String ideaId, String commentId) {
        return commentStore.markAsDeletedComment(projectId, ideaId, commentId)
                .getCommentModel().toCommentWithAuthor();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public CommentWithAuthor commentDeleteAdmin(String projectId, String ideaId, String commentId) {
        return commentStore.markAsDeletedComment(projectId, ideaId, commentId)
                .getCommentModel().toCommentWithAuthor();
    }
}
