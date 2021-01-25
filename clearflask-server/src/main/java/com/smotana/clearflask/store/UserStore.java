package com.smotana.clearflask.store;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.util.concurrent.ListenableFuture;
import com.smotana.clearflask.api.model.Balance;
import com.smotana.clearflask.api.model.NotificationMethodsOauth;
import com.smotana.clearflask.api.model.User;
import com.smotana.clearflask.api.model.UserAdmin;
import com.smotana.clearflask.api.model.UserMe;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.api.model.UserUpdateAdmin;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.web.ApiException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.ToString;
import lombok.Value;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.support.WriteResponse;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.indices.CreateIndexResponse;

import java.time.Duration;
import java.time.Instant;
import java.time.Period;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Function;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface UserStore {

    default String genUserId(Optional<String> nameOpt) {
        return nameOpt.map(IdUtil::contentUnique).orElseGet(IdUtil::randomId);
    }

    ListenableFuture<CreateIndexResponse> createIndex(String projectId);

    UserAndIndexingFuture createUser(UserModel user);

    Optional<UserModel> getUser(String projectId, String userId);

    ImmutableMap<String, UserModel> getUsers(String projectId, ImmutableCollection<String> userIds);

    Optional<UserModel> getUserByIdentifier(String projectId, IdentifierType type, String identifier);

    SearchUsersResponse searchUsers(String projectId, UserSearchAdmin userSearchAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt);

    void exportAllForProject(String projectId, Consumer<UserModel> consumer);

    UserAndIndexingFuture updateUser(String projectId, String userId, UserUpdateAdmin updatesAdmin);

    UserAndIndexingFuture updateUser(String projectId, String userId, UserUpdate updates);

    UserModel userVoteUpdateBloom(String projectId, String userId, String ideaId);

    UserModel userCommentVoteUpdateBloom(String projectId, String userId, String commentId);

    UserModel userExpressUpdateBloom(String projectId, String userId, String ideaId);

    UserAndIndexingFuture updateUserBalance(String projectId, String userId, long balanceDiff, Optional<String> updateBloomWithIdeaIdOpt);

    ListenableFuture<BulkResponse> deleteUsers(String projectId, ImmutableCollection<String> userIds);

    String createToken(String projectId, String userId, Duration ttl);

    String createToken(String projectId, String userId, Duration ttl, boolean revocable);

    Optional<UserModel> verifyToken(String token);

    /**
     * Create or return existing user IFF token is valid
     */
    Optional<UserModel> ssoCreateOrGet(String projectId, String secretKey, String token);

    /**
     * Create or return existing user IFF OAuth is valid
     */
    Optional<UserModel> oauthCreateOrGet(String projectId, NotificationMethodsOauth oauthProvider, String clientSecret, String redirectUrl, String code) throws ApiException;

    /**
     * Create or return existing user.
     */
    UserModel createOrGet(String projectId, String guid, Optional<String> emailOpt, Optional<String> nameOpt);

    default String genUserSessionId() {
        return IdUtil.randomAscId();
    }

    UserSession createSession(UserModel user, long ttlInEpochSec);

    Optional<UserSession> getSession(String sessionId);

    UserSession refreshSession(UserSession userSession, long ttlInEpochSec);

    void revokeSession(String sessionId);

    void revokeSession(UserSession userSession);

    void revokeSessions(String projectId, String userId, Optional<String> sessionToLeaveOpt);

    ListenableFuture<AcknowledgedResponse> deleteAllForProject(String projectId);

    boolean getAndSetUserActive(String projectId, String userId, String periodId, Period periodLength);

    @Value
    class SearchUsersResponse {
        ImmutableList<String> userIds;
        Optional<String> cursorOpt;
        long totalHits;
        boolean totalHitsGte;
    }

    @Value
    class UserAndIndexingFuture {
        UserModel user;
        ListenableFuture<WriteResponse> indexingFuture;
    }

    enum IdentifierType {
        EMAIL("e", false),
        IOS_PUSH("i", true),
        ANDROID_PUSH("a", true),
        BROWSER_PUSH("b", true),
        GUID("s", true);

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

        Boolean isMod;
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

        /** For SSO and OAuth */
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

        byte[] commentVoteBloom;

        public UserMe toUserMe(Function<String, String> intercomEmailToIdentity) {
            return new UserMe(
                    this.getUserId(),
                    this.getName(),
                    this.getIsMod(),
                    this.getCreated(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.getEmailVerified(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()),
                    !Strings.isNullOrEmpty(this.getPassword()),
                    getIntercomIdentity(intercomEmailToIdentity));
        }

        public UserMeWithBalance toUserMeWithBalance(Function<String, String> intercomEmailToIdentity) {
            return new UserMeWithBalance(
                    this.getUserId(),
                    this.getName(),
                    this.getIsMod(),
                    this.getCreated(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.getEmailVerified(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()),
                    !Strings.isNullOrEmpty(this.getPassword()),
                    getIntercomIdentity(intercomEmailToIdentity),
                    this.getBalance());
        }

        public UserAdmin toUserAdmin(Function<String, String> intercomEmailToIdentity) {
            return new UserAdmin(
                    this.getUserId(),
                    this.getName(),
                    this.getIsMod(),
                    this.getCreated(),
                    this.getSsoGuid() != null ? true : null,
                    this.getEmail(),
                    this.getEmailVerified(),
                    this.isEmailNotify(),
                    !Strings.isNullOrEmpty(this.getIosPushToken()),
                    !Strings.isNullOrEmpty(this.getAndroidPushToken()),
                    !Strings.isNullOrEmpty(this.getBrowserPushToken()),
                    !Strings.isNullOrEmpty(this.getPassword()),
                    getIntercomIdentity(intercomEmailToIdentity),
                    this.getBalance());
        }

        public User toUser() {
            return new User(
                    getUserId(),
                    getName(),
                    getIsMod(),
                    getCreated());
        }

        public Balance toBalance() {
            return new Balance(this.getBalance());
        }

        private String getIntercomIdentity(Function<String, String> intercomEmailToIdentity) {
            if (Strings.isNullOrEmpty(getEmail())) {
                return null;
            }
            // Don't let unverified emails be verified in Intercom, it allows impersonation
            // and snooping on existing communication with Intercom
            if (getEmailVerified() != Boolean.TRUE && Strings.isNullOrEmpty(getSsoGuid())) {
                return null;
            }

            return intercomEmailToIdentity.apply(getEmail());
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

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "userActiveForPeriod", rangeKeys = "periodId")
    class UserActive {
        @NonNull
        String projectId;

        @NonNull
        String userId;

        @NonNull
        String periodId;

        @NonNull
        long ttlInEpochSec;
    }
}
