package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.UserAdmin;
import com.smotana.clearflask.api.model.UserMe;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.ToString;
import lombok.Value;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface UserStore {

    default String genUserId() {
        return IdUtil.randomId();
    }

    ListenableFuture<CreateIndexResponse> createIndex(String projectId);

    UserAndIndexingFuture<IndexResponse> createUser(UserModel user);

    Optional<UserModel> getUser(String projectId, String userId);

    ImmutableMap<String, UserModel> getUsers(String projectId, ImmutableCollection<String> userIds);

    Optional<UserModel> getUserByIdentifier(String projectId, IdentifierType type, String identifier);

    SearchUsersResponse searchUsers(String projectId, UserSearchAdmin userSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt);

    UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdate updates);

    UserAndIndexingFuture<UpdateResponse> updateUserBalance(String projectId, String userId, BigDecimal balanceDiff);

    ListenableFuture<BulkResponse> deleteUsers(String projectId, ImmutableCollection<String> userIds);

    default String genUserSessionId() {
        return IdUtil.randomAscId();
    }

    UserSession createSession(String projectId, String userId, long ttlInEpochSec);

    Optional<UserSession> getSession(String sessionId);

    UserSession refreshSession(UserSession userSession, long ttlInEpochSec);

    void revokeSession(UserSession userSession);

    void revokeSessions(String projectId, String userId, Optional<String> sessionToLeaveOpt);

    @Value
    class SearchUsersResponse {
        private final ImmutableList<String> userIds;
        private final Optional<String> cursorOpt;
    }

    @Value
    class UserAndIndexingFuture<T> {
        private final UserModel user;
        private final ListenableFuture<T> indexingFuture;
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
    @DynamoTable(type = Primary, partitionKeys = "sessionId", sortStaticName = "userSessionById")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "userId", sortStaticName = "userSessionByUser")
    class UserSession {
        @NonNull
        private final String sessionId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String userId;

        @NonNull
        private final long ttlInEpochSec;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, sortStaticName = "user")
    class UserModel {

        @NonNull
        private final String projectId;

        @NonNull
        private final String userId;

        private final String name;

        private final String email;

        @ToString.Exclude
        private final String password;

        @NonNull
        private final boolean emailNotify;

        private final BigDecimal balance;

        private final String iosPushToken;

        private final String androidPushToken;

        private final String browserPushToken;

        private final Instant created;

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
                    this.getBrowserPushToken(),
                    this.getCreated());
        }
    }
}
