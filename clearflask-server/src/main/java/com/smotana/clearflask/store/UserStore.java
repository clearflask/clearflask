package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.UserAdmin;
import com.smotana.clearflask.api.model.UserMe;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.store.dynamo.mapper.CompoundPrimaryKey;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import org.elasticsearch.action.delete.DeleteResponse;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.update.UpdateResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Future;

public interface UserStore {

    Optional<User> getUser(String projectId, String userId);

    ImmutableList<User> getUsers(String projectId, String... userIds);

    Optional<User> getUserByIdentifier(String projectId, IdentifierType type, String identifier);

    UserAndIndexingFuture<IndexResponse> createUser(User user);

    Future<List<DeleteResponse>> deleteUsers(String projectId, String... userIds);

    UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdate updates);

    ImmutableList<User> searchUsers(String projectId, UserSearchAdmin parameters);

    UserSession createSession(String projectId, String userId, Instant expiry);

    Optional<UserSession> getSession(String projectId, String userId, String sessionId);

    UserSession refreshSession(String projectId, String userId, String sessionId, Instant expiry);

    void revokeSession(String projectId, String userId, String sessionId);

    void revokeSessions(String projectId, String userId);

    void revokeSessions(String projectId, String userId, String sessionToLeave);

    @Value
    class UserAndIndexingFuture<T> {
        private final User user;
        private final Future<T> indexingFuture;
    }

    enum IdentifierType {
        EMAIL("e"),
        IOS_PUSH("i"),
        ANDROID_PUSH("a"),
        BROWSER_PUSH("b");

        private final String type;

        IdentifierType(String type) {
            this.type = type;
        }

        public String getType() {
            return type;
        }
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @CompoundPrimaryKey(key = "id", primaryKeys = {"projectId", "userId"})
    class UserSession {

        @NonNull
        private final String projectId;

        @NonNull
        private final String userId;

        @NonNull
        private final String sessionId;

        @NonNull
        private final Instant expiry;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @CompoundPrimaryKey(key = "id", primaryKeys = {"projectId", "userId"})
    class User {

        @NonNull
        private final String projectId;

        @NonNull
        private final transient String userId;

        private final String name;

        private final String email;

        private final transient String password;

        @NonNull
        private final boolean emailNotify;

        private final BigDecimal balance;

        private final transient String iosPushToken;

        private final transient String androidPushToken;

        private final transient String browserPushToken;

        public UserMe toUserMe() {
            return new UserMe(
                    this.getUserId(),
                    this.getName(),
                    this.getEmail(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()));
        }

        public UserMeWithBalance toUserMeWithBalance() {
            return new UserMeWithBalance(
                    this.getUserId(),
                    this.getName(),
                    this.getEmail(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()),
                    this.getBalance());
        }

        public UserAdmin toUserAdmin() {
            return new UserAdmin(
                    this.getUserId(),
                    this.getName(),
                    this.getEmail(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()),
                    this.getBalance(),
                    this.getIosPushToken(),
                    this.getAndroidPushToken(),
                    this.getBrowserPushToken());
        }
    }
}
