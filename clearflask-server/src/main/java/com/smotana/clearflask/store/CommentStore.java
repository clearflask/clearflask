package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.Comment;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.api.model.CommentWithAuthor;
import com.smotana.clearflask.api.model.User;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import org.elasticsearch.action.DocWriteResponse;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.index.reindex.BulkByScrollResponse;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CommentStore {

    default String genCommentId() {
        return IdUtil.randomAscId();
    }

    ListenableFuture<CreateIndexResponse> createIndex(String projectId);

    double computeCommentScore(int upvotes, int downvotes);

    CommentAndIndexingFuture<List<DocWriteResponse>> createComment(CommentModel comment);

    Optional<CommentModel> getComment(String projectId, String ideaId, String commentId);

    ImmutableMap<String, CommentModel> getComments(String projectId, String ideaId, ImmutableCollection<String> commentIds);

    ImmutableSet<CommentModel> searchComments(String projectId, String ideaId, Optional<String> parentCommentIdOpt, ImmutableSet<String> excludeChildrenCommentIds);

    CommentAndIndexingFuture<UpdateResponse> updateComment(String projectId, String ideaId, String commentId, Instant updated, CommentUpdate commentUpdate);

    CommentAndIndexingFuture<UpdateResponse> voteComment(String projectId, String ideaId, String commentId, Vote votePrev, Vote vote);

    CommentAndIndexingFuture<UpdateResponse> markAsDeletedComment(String projectId, String ideaId, String commentId);

    ListenableFuture<DeleteResponse> deleteComment(String projectId, String ideaId, String commentId);

    ListenableFuture<BulkByScrollResponse> deleteCommentsForIdea(String projectId, String ideaId);

    enum Vote {
        Upvote,
        None,
        Downvote
    }

    @Value
    class CommentAndIndexingFuture<T> {
        private final CommentModel commentModel;
        private final ListenableFuture<T> indexingFuture;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(partitionKeys = {"ideaId", "projectId"}, sortKeys = "commentId")
    class CommentModel {

        @NonNull
        private final String projectId;

        @NonNull
        private final String ideaId;

        @NonNull
        private final String commentId;

        /**
         * Comment tree path to get to this comment excluding self.
         */
        @NonNull
        private final ImmutableList<String> parentCommentIds;

        /** Must be equal to parentCommentIds.size() */
        @NonNull
        private final int level;

        @NonNull
        private final int childCommentCount;

        /**
         * Author of the comment. If null, comment is deleted.
         */
        private final String authorUserId;

        /**
         * Author of the comment. If null, comment is deleted.
         */
        private final String authorName;

        @NonNull
        private final Instant created;

        /**
         * If set, comment was last edited at this time.
         */
        private final Instant edited;

        /**
         * If null, comment is deleted.
         */
        private final String content;

        @NonNull
        private final int upvotes;

        @NonNull
        private final int downvotes;

        public Comment toComment() {
            return new Comment(
                    getIdeaId(),
                    getCommentId(),
                    getParentCommentIds().isEmpty() ? null : getParentCommentIds().get(getParentCommentIds().size() - 1),
                    getChildCommentCount(),
                    getAuthorUserId(),
                    getCreated(),
                    getEdited(),
                    getContent());
        }

        public CommentWithAuthor toCommentWithAuthor() {
            return new CommentWithAuthor(
                    getIdeaId(),
                    getCommentId(),
                    getParentCommentIds().isEmpty() ? null : getParentCommentIds().get(getParentCommentIds().size() - 1),
                    getChildCommentCount(),
                    getAuthorUserId(),
                    getCreated(),
                    getEdited(),
                    getContent(),
                    new User(getAuthorUserId(), getAuthorName()));
        }
    }
}
