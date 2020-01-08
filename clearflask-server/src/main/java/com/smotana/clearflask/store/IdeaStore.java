package com.smotana.clearflask.store;

import com.smotana.clearflask.store.dynamo.mapper.CompoundPrimaryKey;
import com.smotana.clearflask.web.NotImplementedException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import org.elasticsearch.action.index.IndexResponse;

import java.util.concurrent.Future;


public interface IdeaStore {

    IdeaAndIndexingFuture<IndexResponse> createIdea(Idea idea);
// TODO
//    Optional<User> getUser(String projectId, String userId);
//
//    ImmutableList<User> getUsers(String projectId, String... userIds);
//
//    Optional<User> getUserByIdentifier(String projectId, IdentifierType type, String identifier);
//
//    Future<List<DeleteResponse>> deleteUsers(String projectId, String... userIds);
//
//    UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdate updates);
//
//    ImmutableList<User> searchUsers(String projectId, UserSearchAdmin parameters);
//
//    UserSession createSession(String projectId, String userId, Instant expiry);
//
//    Optional<UserSession> getSession(String projectId, String userId, String sessionId);
//
//    UserSession refreshSession(String projectId, String userId, String sessionId, Instant expiry);
//
//    void revokeSession(String projectId, String userId, String sessionId);
//
//    void revokeSessions(String projectId, String userId);
//
//    void revokeSessions(String projectId, String userId, String sessionToLeave);

    @Value
    class IdeaAndIndexingFuture<T> {
        private final Idea idea;
        private final Future<T> indexingFuture;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @CompoundPrimaryKey(key = "id", primaryKeys = {"projectId", "ideaId"})
    class Idea {

        @NonNull
        private final String projectId;

        @NonNull
        private final String ideaId;

        // TODO

        public com.smotana.clearflask.api.model.Idea toIdeaModel() {
            throw new NotImplementedException();
        }
    }
}
