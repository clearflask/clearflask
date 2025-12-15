// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.*;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.api.model.IdeaVisibility;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.DynamoTable;
import lombok.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;

import static io.dataspray.singletable.TableType.Gsi;
import static io.dataspray.singletable.TableType.Primary;


public interface IdeaStore {

    default String genIdeaId(String title) {
        return IdUtil.contentUnique(title);
    }

    default String genDeterministicIdeaIdForGithubIssue(long issueNumber, long issueId, long repositoryId) {
        return "github-" + issueNumber + "-" + issueId + "-" + repositoryId;
    }

    default String genDeterministicIdeaIdForGithubRelease(long releaseId, long repositoryId) {
        return "github-release-" + releaseId + "-" + repositoryId;
    }

    default String genDeterministicIdeaIdForGitlabIssue(long issueIid, long issueId, long projectId) {
        return "gitlab-" + issueIid + "-" + issueId + "-" + projectId;
    }

    default String genDeterministicIdeaIdForGitlabRelease(long releaseId, long projectId) {
        return "gitlab-release-" + releaseId + "-" + projectId;
    }

    Optional<GitHubIssueMetadata> extractGitHubIssueFromIdeaId(String ideaId);

    Optional<GitLabIssueMetadata> extractGitLabIssueFromIdeaId(String ideaId);

    ListenableFuture<Void> createIndex(String projectId);

    void repopulateIndex(String projectId, boolean deleteExistingIndex, boolean repopulateElasticSearch, boolean repopulateMysql) throws Exception;

    ListenableFuture<Void> createIdea(IdeaModel idea);

    IdeaAndIndexingFuture createIdeaAndUpvote(IdeaModel idea);

    ListenableFuture<List<Void>> createIdeas(String projectId, Iterable<IdeaModel> ideas);

    Optional<IdeaModel> getIdea(String projectId, String ideaId);

    ImmutableMap<String, IdeaModel> getIdeas(String projectId, ImmutableCollection<String> ideaIds);

    LinkResponse linkIdeas(String projectId, String ideaId, String parentIdeaId, boolean undo, BiFunction<String, String, Double> categoryExpressionToWeightMapper);

    MergeResponse mergeIdeas(String projectId, String ideaId, String parentIdeaId, boolean undo, BiFunction<String, String, Double> categoryExpressionToWeightMapper);

    HistogramResponse histogram(String projectId, IdeaHistogramSearchAdmin ideaSearchAdmin);

    SearchResponse searchIdeas(String projectId, IdeaSearch ideaSearch, Optional<String> requestorUserIdOpt, ImmutableSet<String> hiddenStatusIds, Optional<String> cursorOpt);

    SearchResponse searchIdeas(String projectId, IdeaSearchAdmin ideaSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt);

    /**
     * Test-only method to search ideas with explicit control over private visibility filtering.
     * @param excludePrivate if true, private posts are excluded from results (regular user behavior); if false, all posts including private are returned (admin behavior)
     */
    SearchResponse searchIdeas(String projectId, IdeaSearchAdmin ideaSearchAdmin, boolean excludePrivate, ImmutableSet<String> hiddenStatusIds, Optional<String> cursorOpt);

    long countIdeas(String projectId);

    IdeaAggregateResponse countIdeas(String projectId, String categoryId);

    void exportAllForProject(String projectId, Consumer<IdeaModel> consumer);

    IdeaAndIndexingFuture updateIdea(String projectId, String ideaId, IdeaUpdate ideaUpdate);

    IdeaAndIndexingFuture updateIdea(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin, Optional<UserModel> responseAuthor);

    IdeaAndIndexingFuture voteIdea(String projectId, String ideaId, String userId, VoteValue vote);

    IdeaAndExpressionsAndIndexingFuture expressIdeaSet(String projectId, String ideaId, String userId, Function<String, Double> expressionToWeightMapper, Optional<String> expressionOpt);

    IdeaAndExpressionsAndIndexingFuture expressIdeaAdd(String projectId, String ideaId, String userId, Function<String, Double> expressionToWeightMapper, String expression);

    IdeaAndExpressionsAndIndexingFuture expressIdeaRemove(String projectId, String ideaId, String userId, Function<String, Double> expressionToWeightMapper, String expression);

    IdeaTransactionAndIndexingFuture fundIdea(String projectId, String ideaId, String userId, long fundDiff, String transactionType, String summary);

    /**
     * Increments total comment count. If incrementChildCount is true, also increments immediate child count too.
     */
    IdeaAndIndexingFuture incrementIdeaCommentCount(String projectId, String ideaId, boolean incrementChildCount);

    ListenableFuture<Void> deleteIdea(String projectId, String ideaId, boolean deleteMerged);

    ListenableFuture<Void> deleteIdeas(String projectId, ImmutableCollection<String> ideaIds);

    ListenableFuture<Void> deleteAllForProject(String projectId);

    @Value
    class GitHubIssueMetadata {
        long issueNumber;
        long issueId;
        long repositoryId;
    }

    @Value
    class GitLabIssueMetadata {
        long issueIid;
        long issueId;
        long projectId;
    }

    @Value
    class SearchResponse {
        ImmutableList<String> ideaIds;
        Optional<String> cursorOpt;
        long totalHits;
        boolean totalHitsGte;
    }

    @Value
    class IdeaAndIndexingFuture {
        IdeaModel idea;
        ListenableFuture<Void> indexingFuture;
    }

    @Value
    class LinkResponse {
        IdeaModel idea;
        IdeaModel parentIdea;
    }

    @Value
    class MergeResponse {
        IdeaModel idea;
        IdeaModel parentIdea;
        ListenableFuture<Void> indexingFuture;
    }

    @Value
    class IdeaAndExpressionsAndIndexingFuture {
        ImmutableSet<String> expressions;
        IdeaModel idea;
        ListenableFuture<Void> indexingFuture;
    }

    @Value
    class IdeaTransactionAndIndexingFuture {
        long ideaFundAmount;
        IdeaModel idea;
        TransactionModel transaction;
        ListenableFuture<Void> indexingFuture;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class MergedPost {

        @NonNull
        String postId;

        Boolean hasComments;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"ideaId", "projectId"}, rangePrefix = "idea")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "ideaByProjectId")
    class IdeaModel {

        @NonNull
        String projectId;

        @NonNull
        String ideaId;

        @NonNull
        String authorUserId;

        String authorName;

        Boolean authorIsMod;

        String authorPic;

        String authorPicUrl;

        @NonNull
        Instant created;

        public Instant getCreated() {
            return created.truncatedTo(ChronoUnit.SECONDS);
        }

        @NonNull
        String title;

        /**
         * WARNING: Unsanitized HTML.
         */
        @Getter(AccessLevel.PRIVATE)
        String description;

        /**
         * WARNING: Unsanitized HTML.
         */
        @Getter(AccessLevel.PRIVATE)
        String response;

        String responseAuthorUserId;

        String responseAuthorName;

        String responseAuthorPic;

        String responseAuthorPicUrl;

        Instant responseEdited;

        @NonNull
        String categoryId;

        String statusId;

        @NonNull
        ImmutableSet<String> tagIds;

        @NonNull
        long commentCount;

        @NonNull
        long childCommentCount;

        Long funded;

        Long fundGoal;

        Long fundersCount;

        Long voteValue;

        Long votersCount;

        Double expressionsValue;

        /**
         * Expression counts; map of expression display to count.
         * <p>
         * NonNull: Some old entries in Dynamo may have this null,
         * but it shouldn't be null going forward.
         */
        ImmutableMap<String, Long> expressions;

        Double trendScore;

        @NonNull
        ImmutableSet<String> linkedToPostIds;

        @NonNull
        ImmutableSet<String> linkedFromPostIds;

        String mergedToPostId;

        Instant mergedToPostTime;

        @NonNull
        ImmutableSet<String> mergedPostIds;

        /**
         * Unitless order relative to other posts for displaying.
         * Created time is used by default if not present.
         */
        Double order;

        String linkedGitHubUrl;

        String coverImg;

        /**
         * Visibility of the idea. Private ideas are only visible to admins/mods.
         * If null, defaults to Public.
         */
        IdeaVisibility visibility;

        /**
         * Private notes visible only to admins and moderators.
         */
        String adminNotes;

        public String getDescriptionSanitized(Sanitizer sanitizer) {
            return sanitizer.richHtml(getDescription(), "idea", getIdeaId(), getProjectId(), false);
        }

        public String getDescriptionAsText(Sanitizer sanitizer) {
            return sanitizer.richHtmlToPlaintext(getDescription());
        }

        public String getDescriptionAsUnsafeHtml() {
            return getDescription();
        }

        public String getResponseSanitized(Sanitizer sanitizer) {
            return sanitizer.richHtml(getResponse(), "idea", getIdeaId(), getProjectId(), false);
        }

        public String getResponseAsText(Sanitizer sanitizer) {
            return sanitizer.richHtmlToPlaintext(getResponse());
        }

        public boolean hasResponse() {
            return !Strings.isNullOrEmpty(getResponse());
        }

        public String getResponseAsUnsafeHtml() {
            return getResponse();
        }

        public Idea toIdea(Sanitizer sanitizer) {
            return new Idea(
                    getIdeaId(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getAuthorIsMod(),
                    getAuthorPic(),
                    getAuthorPicUrl(),
                    getCreated(),
                    getTitle(),
                    getDescriptionSanitized(sanitizer),
                    getResponseSanitized(sanitizer),
                    getResponseAuthorUserId(),
                    getResponseAuthorName(),
                    getResponseAuthorPic(),
                    getResponseAuthorPicUrl(),
                    getResponseEdited(),
                    getCategoryId(),
                    getStatusId(),
                    getTagIds().asList(),
                    getCommentCount(),
                    getChildCommentCount(),
                    getFunded(),
                    getFundGoal(),
                    getFundersCount(),
                    getVoteValue(),
                    getExpressionsValue(),
                    (getExpressions() == null || getExpressions().isEmpty()) ? null : Maps.filterEntries(getExpressions(),
                            e -> e.getValue() != null && e.getValue() != 0L),
                    getLinkedToPostIds().asList(),
                    getLinkedFromPostIds().asList(),
                    getMergedToPostId(),
                    getMergedToPostTime(),
                    getMergedPostIds().asList(),
                    getOrder(),
                    getLinkedGitHubUrl(),
                    null, // linkedGitLabUrl - not used yet
                    null, // externalUrl - not used yet
                    sanitizer.signCoverImg(projectId, getCoverImg()).orElse(null),
                    getVisibility(),
                    null); // adminNotes - not returned for non-admin endpoints
        }

        public Idea toIdeaAdmin(Sanitizer sanitizer) {
            return new Idea(
                    getIdeaId(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getAuthorIsMod(),
                    getAuthorPic(),
                    getAuthorPicUrl(),
                    getCreated(),
                    getTitle(),
                    getDescriptionSanitized(sanitizer),
                    getResponseSanitized(sanitizer),
                    getResponseAuthorUserId(),
                    getResponseAuthorName(),
                    getResponseAuthorPic(),
                    getResponseAuthorPicUrl(),
                    getResponseEdited(),
                    getCategoryId(),
                    getStatusId(),
                    getTagIds().asList(),
                    getCommentCount(),
                    getChildCommentCount(),
                    getFunded(),
                    getFundGoal(),
                    getFundersCount(),
                    getVoteValue(),
                    getExpressionsValue(),
                    (getExpressions() == null || getExpressions().isEmpty()) ? null : Maps.filterEntries(getExpressions(),
                            e -> e.getValue() != null && e.getValue() != 0L),
                    getLinkedToPostIds().asList(),
                    getLinkedFromPostIds().asList(),
                    getMergedToPostId(),
                    getMergedToPostTime(),
                    getMergedPostIds().asList(),
                    getOrder(),
                    getLinkedGitHubUrl(),
                    null, // linkedGitLabUrl - not used yet
                    null, // externalUrl - not used yet
                    sanitizer.signCoverImg(projectId, getCoverImg()).orElse(null),
                    getVisibility(),
                    getAdminNotes());
        }

        public IdeaWithVote toIdeaWithVote(IdeaVote vote, Sanitizer sanitizer) {
            return new IdeaWithVote(
                    getIdeaId(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getAuthorIsMod(),
                    getAuthorPic(),
                    getAuthorPicUrl(),
                    getCreated(),
                    getTitle(),
                    getDescriptionSanitized(sanitizer),
                    getResponseSanitized(sanitizer),
                    getResponseAuthorUserId(),
                    getResponseAuthorName(),
                    getResponseAuthorPic(),
                    getResponseAuthorPicUrl(),
                    getResponseEdited(),
                    getCategoryId(),
                    getStatusId(),
                    getTagIds().asList(),
                    getCommentCount(),
                    getChildCommentCount(),
                    getFunded(),
                    getFundGoal(),
                    getFundersCount(),
                    getVoteValue(),
                    getExpressionsValue(),
                    (getExpressions() == null || getExpressions().isEmpty()) ? null : Maps.filterEntries(getExpressions(),
                            e -> e.getValue() != null && e.getValue() != 0L),
                    getLinkedToPostIds().asList(),
                    getLinkedFromPostIds().asList(),
                    getMergedToPostId(),
                    getMergedToPostTime(),
                    getMergedPostIds().asList(),
                    getOrder(),
                    getLinkedGitHubUrl(),
                    null, // linkedGitLabUrl - not used yet
                    null, // externalUrl - not used yet
                    sanitizer.signCoverImg(projectId, getCoverImg()).orElse(null),
                    getVisibility(),
                    null, // adminNotes - not returned for non-admin endpoints
                    vote);
        }

        public double getOrderOrDefault() {
            return getOrder() != null ? getOrder() : getCreated().toEpochMilli();
        }
    }
}
