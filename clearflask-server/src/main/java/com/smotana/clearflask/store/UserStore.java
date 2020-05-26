package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.Balance;
import com.smotana.clearflask.api.model.UserAdmin;
import com.smotana.clearflask.api.model.UserMe;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.api.model.UserUpdateAdmin;
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

import java.time.Duration;
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

    UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdateAdmin updatesAdmin);

    UserAndIndexingFuture<UpdateResponse> updateUser(String projectId, String userId, UserUpdate updates);

    UserModel userVoteUpdateBloom(String projectId, String userId, String ideaId);

    UserModel userExpressUpdateBloom(String projectId, String userId, String ideaId);

    UserAndIndexingFuture<UpdateResponse> updateUserBalance(String projectId, String userId, long balanceDiff, Optional<String> ideaIdOpt);

    ListenableFuture<BulkResponse> deleteUsers(String projectId, ImmutableCollection<String> userIds);

    String createToken(String projectId, String userId, Duration ttl);

    String createToken(String projectId, String userId, Duration ttl, boolean revocable);

    Optional<UserModel> verifyToken(String token);

    Optional<UserModel> ssoCreateOrGet(String projectId, String secretKey, String token);

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
        EMAIL("e", false),
        IOS_PUSH("i", true),
        ANDROID_PUSH("a", true),
        BROWSER_PUSH("b", true),
        SSO_GUID("s", true);

        private final String type;
        private final boolean isHashed;

        IdentifierType(String type, boolean isHashed) {
            this.type = type;
            this.isHashed = isHashed;
        }

        public String getType() {
            return type;
        }

        public boolean isHashed() {
            return isHashed;
        }
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "sessionId", rangePrefix = "userSessionById")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = "userId", rangePrefix = "userSessionByUser")
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
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "user")
    class UserModel {

        @NonNull
        private final String projectId;

        @NonNull
        private final String userId;

        private final String ssoGuid;

        private final Boolean isAdmin;

        private final String name;

        private final String email;

        /** Used for account recovery purposes */
        private final Instant emailLastUpdated;

        @ToString.Exclude
        private final String password;

        /** All auth tokens will be invalid prior to this date */
        private final Instant authTokenValidityStart;

        @NonNull
        private final boolean emailNotify;

        @NonNull
        private final long balance;

        private final String iosPushToken;

        private final String androidPushToken;

        private final String browserPushToken;

        @NonNull
        private final Instant created;

        private final byte[] expressBloom;

        private final byte[] fundBloom;

        private final byte[] voteBloom;

        public UserMe toUserMe() {
            return new UserMe(
                    this.getUserId(),
                    this.getName(),
                    this.getIsAdmin(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()),
                    !Strings.isNullOrEmpty(this.getPassword()));
        }

        public UserMeWithBalance toUserMeWithBalance() {
            return new UserMeWithBalance(
                    this.getUserId(),
                    this.getName(),
                    this.getIsAdmin(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()),
                    !Strings.isNullOrEmpty(this.getPassword()),
                    this.getBalance());
        }

        public UserAdmin toUserAdmin() {
            return new UserAdmin(
                    this.getUserId(),
                    this.getName(),
                    this.getIsAdmin(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()),
                    !Strings.isNullOrEmpty(this.getPassword()),
                    this.getBalance(),
                    this.getCreated());
        }

        public Balance toBalance() {
            return new Balance(this.getBalance());
        }
    }
}
