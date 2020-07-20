package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import org.elasticsearch.action.DocWriteResponse;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.index.reindex.BulkByScrollResponse;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface CommentStore {

    default String genCommentId(String content) {
        return IdUtil.contentUnique(content);
    }

    ListenableFuture<CreateIndexResponse> createIndex(String projectId);

    double computeCommentScore(int upvotes, int downvotes);

    CommentAndIndexingFuture<List<DocWriteResponse>> createComment(CommentModel comment);

    Optional<CommentModel> getComment(String projectId, String ideaId, String commentId);

    ImmutableMap<String, CommentModel> getComments(String projectId, String ideaId, ImmutableCollection<String> commentIds);

    ImmutableSet<CommentModel> searchComments(String projectId, String ideaId, Optional<String> parentCommentIdOpt, ImmutableSet<String> excludeChildrenCommentIds);

    CommentAndIndexingFuture<UpdateResponse> updateComment(String projectId, String ideaId, String commentId, Instant updated, CommentUpdate commentUpdate);

    CommentAndIndexingFuture<UpdateResponse> voteComment(String projectId, String ideaId, String commentId, String userId, VoteValue vote);

    CommentAndIndexingFuture<UpdateResponse> markAsDeletedComment(String projectId, String ideaId, String commentId);

    ListenableFuture<DeleteResponse> deleteComment(String projectId, String ideaId, String commentId);

    ListenableFuture<BulkByScrollResponse> deleteCommentsForIdea(String projectId, String ideaId);

    ListenableFuture<AcknowledgedResponse> deleteAllForProject(String projectId);

    @Value
    class CommentAndIndexingFuture<T> {
        CommentModel commentModel;
        ListenableFuture<T> indexingFuture;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"ideaId", "projectId"}, rangePrefix = "comment", rangeKeys = "commentId")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "commentByProjectId", rangeKeys = "created")
    class CommentModel {

        @NonNull
        String projectId;

        @NonNull
        String ideaId;

        @NonNull
        String commentId;

        /**
         * Comment tree path to get to this comment excluding self.
         */
        @NonNull
        ImmutableList<String> parentCommentIds;

        /**
         * Must be equal to parentCommentIds.size()
         */
        @NonNull
        int level;

        @NonNull
        long childCommentCount;

        /**
         * Author of the comment. If null, comment is deleted.
         */
        String authorUserId;

        /**
         * Author of the comment. If null, comment is deleted.
         */
        String authorName;

        @NonNull
        Instant created;

        /**
         * If set, comment was last edited at this time.
         */
        Instant edited;

        /**
         * DraftJs format. If null, comment is deleted.
         */
        String content;

        @NonNull
        int upvotes;

        @NonNull
        int downvotes;

        public Comment toComment() {
            return new Comment(
                    getIdeaId(),
                    getCommentId(),
                    getParentCommentIds().isEmpty() ? null : getParentCommentIds().get(getParentCommentIds().size() - 1),
                    new User(getAuthorUserId(), getAuthorName()),
                    getChildCommentCount(),
                    getAuthorUserId(),
                    getCreated(),
                    getEdited(),
                    getContent(),
                    (long) (getUpvotes() - getDownvotes()));
        }

        public CommentWithVote toCommentWithVote(VoteOption vote) {
            return new CommentWithVote(
                    getIdeaId(),
                    getCommentId(),
                    getParentCommentIds().isEmpty() ? null : getParentCommentIds().get(getParentCommentIds().size() - 1),
                    new User(getAuthorUserId(), getAuthorName()),
                    getChildCommentCount(),
                    getAuthorUserId(),
                    getCreated(),
                    getEdited(),
                    getContent(),
                    (long) (getUpvotes() - getDownvotes()),
                    vote);
        }
    }
}
