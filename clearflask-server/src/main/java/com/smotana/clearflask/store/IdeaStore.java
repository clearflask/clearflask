package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.Idea;
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.api.model.IdeaWithAuthorAndVote;
import com.smotana.clearflask.store.dynamo.mapper.CompoundPrimaryKey;
import com.smotana.clearflask.web.NotImplementedException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;


public interface IdeaStore {

    ListenableFuture<CreateIndexResponse> createIndex(String projectId);

    IdeaAndIndexingFuture<IndexResponse> createIdea(IdeaModel idea);

    Optional<IdeaModel> getIdea(String projectId, String ideaId);

    ImmutableList<IdeaModel> getIdeas(String projectId, ImmutableList<String> ideaIds);

    SearchResponse searchIdeas(String projectId, IdeaSearch ideaSearch, Optional<String> requestorUserIdOpt, Optional<String> cursorOpt);

    SearchResponse searchIdeas(String projectId, IdeaSearchAdmin ideaSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt);

    IdeaAndIndexingFuture<UpdateResponse> updateIdea(String projectId, String ideaId, IdeaUpdate ideaUpdate);

    IdeaAndIndexingFuture<UpdateResponse> updateIdea(String projectId, String ideaId, IdeaUpdateAdmin ideaUpdateAdmin);

    ListenableFuture<DeleteResponse> deleteIdea(String projectId, String ideaId);

    ListenableFuture<BulkResponse> deleteIdeas(String projectId, ImmutableList<String> ideaIds);

    @Value
    class SearchResponse {
        private final ImmutableList<String> ideaIds;
        private final Optional<String> cursorOpt;
    }

    @Value
    class IdeaAndIndexingFuture<T> {
        private final IdeaModel idea;
        private final ListenableFuture<T> indexingFuture;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @CompoundPrimaryKey(key = "id", primaryKeys = {"projectId", "ideaId"})
    class IdeaModel {

        @NonNull
        private final String projectId;

        @NonNull
        private final String ideaId;

        @NonNull
        private final String authorUserId;

        @NonNull
        private final Instant created;

        @NonNull
        private final String title;

        private final String description;

        @NonNull
        private final String categoryId;

        private final String statusId;

        @NonNull
        private final ImmutableList<String> tagIds;

        @NonNull
        private final long commentCount;

        private final BigDecimal funded;

        private final BigDecimal fundGoal;

        private final ImmutableSet<String> funderUserIds;

        private final long voteValue;

        private final long votersCount;

        private final BigDecimal expressionsValue;

        /** Expression counts; map of expression display to count. */
        private final ImmutableMap<String, Long> expressions;

        public Idea toIdea() {
            throw new NotImplementedException();
        }

        public IdeaWithAuthorAndVote toIdeaWithAuthorAndVote() {
            throw new NotImplementedException();
        }
    }
}
