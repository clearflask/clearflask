package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;

import java.time.Instant;
import java.util.Optional;
import java.util.function.Function;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;


public interface IdeaStore {

    default String genIdeaId(String title) {
        return IdUtil.contentUnique(title);
    }

    ListenableFuture<CreateIndexResponse> createIndex(String projectId);

    ListenableFuture<IndexResponse> createIdea(IdeaModel idea);

    Optional<IdeaModel> getIdea(String projectId, String ideaId);

    ImmutableMap<String, IdeaModel> getIdeas(String projectId, ImmutableCollection<String> ideaIds);

    SearchResponse searchIdeas(String projectId, IdeaSearch ideaSearch, Optional<String> requestorUserIdOpt, Optional<String> cursorOpt);

    SearchResponse searchIdeas(String projectId, IdeaSearchAdmin ideaSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt);

    IdeaAndIndexingFuture updateIdea(String projectId, String ideaId, IdeaUpdate ideaUpdate);

    IdeaAndIndexingFuture updateIdea(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin, Optional<> responseAuthor);

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
    }

    @Value
    class IdeaAndIndexingFuture {
        IdeaModel idea;
        ListenableFuture<UpdateResponse> indexingFuture;
    }

    @Value
    class IdeaAndExpressionsAndIndexingFuture {
        ImmutableSet<String> expressions;
        IdeaModel idea;
        ListenableFuture<UpdateResponse> indexingFuture;
    }

    @Value
    class IdeaTransactionAndIndexingFuture {
        long ideaFundAmount;
        IdeaModel idea;
        TransactionModel transaction;
        ListenableFuture<UpdateResponse> indexingFuture;
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

        String authorIsMod;

        @NonNull
        Instant created;

        @NonNull
        String title;

        /**
         * DraftJs format.
         */
        String description;

        /**
         * DraftJs format.
         */
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

        public Idea toIdea() {
            return new Idea(
                    getIdeaId(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getCreated(),
                    getTitle(),
                    getDescription(),
                    getResponse(),
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

        public IdeaWithVote toIdeaWithVote(IdeaVote vote) {
            return new IdeaWithVote(
                    getIdeaId(),
                    getAuthorUserId(),
                    getAuthorName(),
                    getCreated(),
                    getTitle(),
                    getDescription(),
                    getResponse(),
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
                    getExpressions(),
                    vote);
        }
    }
}
