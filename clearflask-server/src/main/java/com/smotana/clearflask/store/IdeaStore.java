package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.Idea;
import com.smotana.clearflask.api.model.IdeaAggregateResponse;
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.api.model.IdeaVote;
import com.smotana.clearflask.api.model.IdeaWithVote;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
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
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.support.WriteResponse;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Function;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;


public interface IdeaStore {

    default String genIdeaId(String title) {
        return IdUtil.contentUnique(title);
    }

    ListenableFuture<CreateIndexResponse> createIndex(String projectId);

    ListenableFuture<IndexResponse> createIdea(IdeaModel idea);

    IdeaAndIndexingFuture createIdeaAndUpvote(IdeaModel idea);

    ListenableFuture<List<BulkResponse>> createIdeas(Iterable<IdeaModel> ideas);

    Optional<IdeaModel> getIdea(String projectId, String ideaId);

    ImmutableMap<String, IdeaModel> getIdeas(String projectId, ImmutableCollection<String> ideaIds);

    SearchResponse searchIdeas(String projectId, IdeaSearch ideaSearch, Optional<String> requestorUserIdOpt, Optional<String> cursorOpt);

    SearchResponse searchIdeas(String projectId, IdeaSearchAdmin ideaSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt);

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

    ListenableFuture<DeleteResponse> deleteIdea(String projectId, String ideaId);

    ListenableFuture<BulkResponse> deleteIdeas(String projectId, ImmutableCollection<String> ideaIds);

    ListenableFuture<AcknowledgedResponse> deleteAllForProject(String projectId);

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
        ListenableFuture<? extends WriteResponse> indexingFuture;
    }

    @Value
    class IdeaAndExpressionsAndIndexingFuture {
        ImmutableSet<String> expressions;
        IdeaModel idea;
        ListenableFuture<? extends WriteResponse> indexingFuture;
    }

    @Value
    class IdeaTransactionAndIndexingFuture {
        long ideaFundAmount;
        IdeaModel idea;
        TransactionModel transaction;
        ListenableFuture<? extends WriteResponse> indexingFuture;
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

        @NonNull
        Instant created;

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
         */
        ImmutableMap<String, Long> expressions;

        Double trendScore;

        public String getDescriptionSanitized(Sanitizer sanitizer) {
            return sanitizer.richHtml(getDescription(), "idea", getIdeaId(), getProjectId());
        }

        public String getDescriptionAsText(Sanitizer sanitizer) {
            return sanitizer.richHtmlToPlaintext(getDescription());
        }

        public String getDescriptionAsUnsafeHtml() {
            return getDescription();
        }

        public String getResponseSanitized(Sanitizer sanitizer) {
            return sanitizer.richHtml(getResponse(), "idea", getIdeaId(), getProjectId());
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
                    getCreated(),
                    getTitle(),
                    getDescriptionSanitized(sanitizer),
                    getResponseSanitized(sanitizer),
                    getResponseAuthorUserId(),
                    getResponseAuthorName(),
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
                    getExpressions());
        }

        public IdeaWithVote toIdeaWithVote(IdeaVote vote, Sanitizer sanitizer) {
            return new IdeaWithVote(
                    getIdeaId(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getAuthorIsMod(),
                    getCreated(),
                    getTitle(),
                    getDescriptionSanitized(sanitizer),
                    getResponseSanitized(sanitizer),
                    getResponseAuthorUserId(),
                    getResponseAuthorName(),
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
                    getExpressions() == null ? null : getExpressions().entrySet().stream()
                            .filter(e -> e.getValue() != null && e.getValue() != 0L)
                            .collect(ImmutableMap.toImmutableMap(Map.Entry::getKey, Map.Entry::getValue)),
                    vote);
        }
    }
}
