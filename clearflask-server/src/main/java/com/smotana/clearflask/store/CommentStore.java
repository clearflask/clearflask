// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.Comment;
import com.smotana.clearflask.api.model.CommentSearchAdmin;
import com.smotana.clearflask.api.model.CommentUpdate;
import com.smotana.clearflask.api.model.CommentWithVote;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramSearchAdmin;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.DynamoTable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NonNull;
import lombok.Value;

import javax.annotation.Nullable;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static io.dataspray.singletable.TableType.Gsi;
import static io.dataspray.singletable.TableType.Primary;

public interface
CommentStore {

    default String genCommentId(String content) {
        return IdUtil.contentUnique(content);
    }

    default String genDeterministicCommentIdForGithubIssueComment(long commentId) {
        return "github-" + commentId;
    }

    /** Returns optional empty if index already exists */
    ListenableFuture<Void> createIndex(String projectId);

    void repopulateIndex(String projectId, boolean deleteExistingIndex, boolean repopulateElasticSearch, boolean repopulateMysql) throws Exception;

    double computeCommentScore(int upvotes, int downvotes);

    CommentAndIndexingFuture<List<Void>> createCommentAndUpvote(CommentModel comment);

    Optional<CommentModel> getComment(String projectId, String ideaId, String commentId);

    ImmutableMap<String, CommentModel> getComments(String projectId, String ideaId, Collection<String> commentIds);

    HistogramResponse histogram(String projectId, HistogramSearchAdmin searchAdmin);

    SearchCommentsResponse searchComments(String projectId, CommentSearchAdmin commentSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt);

    ImmutableSet<CommentModel> getCommentsForPost(String projectId, String ideaId, ImmutableSet<String> mergedPostIds, Optional<String> parentCommentIdOpt, ImmutableSet<String> excludeChildrenCommentIds);

    void exportAllForProject(String projectId, Consumer<CommentModel> consumer);

    CommentAndIndexingFuture<Void> updateComment(String projectId, String ideaId, String commentId, Instant updated, CommentUpdate commentUpdate);

    CommentAndIndexingFuture<Void> voteComment(String projectId, String ideaId, String commentId, String userId, VoteValue vote);

    CommentAndIndexingFuture<Void> markAsDeletedComment(String projectId, String ideaId, String commentId);

    ListenableFuture<Void> deleteComment(String projectId, String ideaId, String commentId);

    ListenableFuture<Void> deleteCommentsForIdea(String projectId, String ideaId);

    ListenableFuture<Void> deleteAllForProject(String projectId);

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
            return sanitizer.richHtml(getContent(), "comment", getCommentId(), getProjectId(), false);
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
                    null,
                    null,
                    null,
                    getContentSanitized(sanitizer),
                    (long) (getUpvotes() - getDownvotes()));
        }

        public CommentWithVote toCommentWithVote(@Nullable VoteOption vote, Sanitizer sanitizer) {
            return toCommentWithVote(vote, sanitizer, Optional.empty());
        }

        public CommentWithVote toCommentWithVote(@Nullable VoteOption vote, Sanitizer sanitizer, Optional<String> overrideParentCommentIdOpt) {
            return new CommentWithVote(
                    getIdeaId(),
                    getCommentId(),
                    overrideParentCommentIdOpt.orElse(getParentCommentIds().isEmpty()
                            ? null : getParentCommentIds().get(getParentCommentIds().size() - 1)),
                    getChildCommentCount(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getAuthorIsMod(),
                    getCreated(),
                    getEdited(),
                    null,
                    null,
                    null,
                    sanitizer.richHtml(getContent(), "comment", getCommentId(), getProjectId(), false),
                    (long) (getUpvotes() - getDownvotes()),
                    vote);
        }
    }
}
