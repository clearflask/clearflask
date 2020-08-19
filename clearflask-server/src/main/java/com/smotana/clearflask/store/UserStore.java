package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.*;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
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

    ListenableFuture<AcknowledgedResponse> deleteAllForProject(String projectId);

    @Value
    class SearchUsersResponse {
        ImmutableList<String> userIds;
        Optional<String> cursorOpt;
    }

    @Value
    class UserAndIndexingFuture<T> {
        UserModel user;
        ListenableFuture<T> indexingFuture;
    }

    enum IdentifierType {
        EMAIL("e", false),
        IOS_PUSH("i", true),
        ANDROID_PUSH("a", true),
        BROWSER_PUSH("b", true),
        SSO_GUID("s", true);

        String type;
        boolean isHashed;

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
        String sessionId;

        @NonNull
        String projectId;

        @NonNull
        String userId;

        @NonNull
        long ttlInEpochSec;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "user")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "userByProject", rangeKeys = {"created"})
    class UserModel {

        @NonNull
        String projectId;

        @NonNull
        String userId;

        String ssoGuid;

        Boolean isMod;

        String name;

        String email;

        Boolean emailVerified;

        /**
         * Used for account recovery purposes
         */
        Instant emailLastUpdated;

        @ToString.Exclude
        String password;

        /**
         * All auth tokens will be invalid prior to this date
         */
        Instant authTokenValidityStart;

        @NonNull
        boolean emailNotify;

        @NonNull
        long balance;

        String iosPushToken;

        String androidPushToken;

        String browserPushToken;

        @NonNull
        Instant created;

        byte[] expressBloom;

        byte[] fundBloom;

        byte[] voteBloom;

        public UserMe toUserMe() {
            return new UserMe(
                    this.getUserId(),
                    this.getName(),
                    this.getIsMod(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.getEmailVerified(),
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
                    this.getIsMod(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.getEmailVerified(),
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
                    this.getIsMod(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.getEmailVerified(),
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

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"identifierHash", "type", "projectId"}, rangePrefix = "userByIdentifier")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "identifierByProjectId")
    class IdentifierUser {
        @NonNull
        String type;

        @NonNull
        String identifierHash;

        @NonNull
        String projectId;

        @NonNull
        String userId;
    }
}
