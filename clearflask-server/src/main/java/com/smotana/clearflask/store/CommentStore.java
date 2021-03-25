package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.Comment;
import com.smotana.clearflask.api.model.CommentSearchAdmin;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.api.model.CommentWithVote;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Value;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.support.WriteResponse;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.index.reindex.BulkByScrollResponse;

import javax.annotation.Nullable;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface CommentStore {

    default String genCommentId(String content) {
        return IdUtil.contentUnique(content);
    }

    ListenableFuture<CreateIndexResponse> createIndex(String projectId);

    double computeCommentScore(int upvotes, int downvotes);

    CommentAndIndexingFuture<List<WriteResponse>> createComment(CommentModel comment);

    Optional<CommentModel> getComment(String projectId, String ideaId, String commentId);

    ImmutableMap<String, CommentModel> getComments(String projectId, String ideaId, ImmutableCollection<String> commentIds);

    SearchCommentsResponse searchComments(String projectId, CommentSearchAdmin commentSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt);

    ImmutableSet<CommentModel> listComments(String projectId, String ideaId, Optional<String> parentCommentIdOpt, ImmutableSet<String> excludeChildrenCommentIds);

    void exportAllForProject(String projectId, Consumer<CommentModel> consumer);

    CommentAndIndexingFuture<WriteResponse> updateComment(String projectId, String ideaId, String commentId, Instant updated, CommentUpdate commentUpdate);

    CommentAndIndexingFuture<WriteResponse> voteComment(String projectId, String ideaId, String commentId, String userId, VoteValue vote);

    CommentAndIndexingFuture<WriteResponse> markAsDeletedComment(String projectId, String ideaId, String commentId);

    ListenableFuture<DeleteResponse> deleteComment(String projectId, String ideaId, String commentId);

    ListenableFuture<BulkByScrollResponse> deleteCommentsForIdea(String projectId, String ideaId);

    ListenableFuture<AcknowledgedResponse> deleteAllForProject(String projectId);

    @Value
    class CommentAndIndexingFuture<T> {
        CommentModel commentModel;
        ListenableFuture<T> indexingFuture;
    }

    @Value
    class SearchCommentsResponse {
        ImmutableList<CommentModel> comments;
        Optional<String> cursorOpt;
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
         * Author name of the comment. If null, comment is deleted.
         */
        String authorName;

        Boolean authorIsMod;

        @NonNull
        Instant created;

        /**
         * If set, comment was last edited at this time.
         */
        Instant edited;

        /**
         * WARNING:Unsanitized HTML.
         *
         * If null, comment is deleted.
         */
        @Getter(AccessLevel.PRIVATE)
        String content;

        @NonNull
        int upvotes;

        @NonNull
        int downvotes;

        public boolean isDeleted() {
            return getContent() == null;
        }

        public String getContentSanitized(Sanitizer sanitizer) {
            return sanitizer.richHtml(getContent(), "comment", getCommentId(), getProjectId());
        }

        public String getContentAsText(Sanitizer sanitizer) {
            return sanitizer.richHtmlToPlaintext(getContent());
        }

        public String getContentAsUnsafeHtml() {
            return getContent();
        }

        public Comment toComment(Sanitizer sanitizer) {
            return new Comment(
                    getIdeaId(),
                    getCommentId(),
                    getParentCommentIds().isEmpty() ? null : getParentCommentIds().get(getParentCommentIds().size() - 1),
                    getChildCommentCount(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getAuthorIsMod(),
                    getCreated(),
                    getEdited(),
                    getContentSanitized(sanitizer),
                    (long) (getUpvotes() - getDownvotes()));
        }

        public CommentWithVote toCommentWithVote(@Nullable VoteOption vote, Sanitizer sanitizer) {
            return new CommentWithVote(
                    getIdeaId(),
                    getCommentId(),
                    getParentCommentIds().isEmpty() ? null : getParentCommentIds().get(getParentCommentIds().size() - 1),
                    getChildCommentCount(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getAuthorIsMod(),
                    getCreated(),
                    getEdited(),
                    sanitizer.richHtml(getContent(), "comment", getCommentId(), getProjectId()),
                    (long) (getUpvotes() - getDownvotes()),
                    vote);
        }
    }
}
