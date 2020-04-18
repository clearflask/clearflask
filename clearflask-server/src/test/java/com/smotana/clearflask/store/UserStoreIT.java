package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.util.StringableSecretKey;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.update.UpdateResponse;
import org.junit.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static io.jsonwebtoken.SignatureAlgorithm.HS512;
import static org.junit.Assert.*;

@Slf4j
public class UserStoreIT extends AbstractIT {

    @Inject
    private UserStore store;

    @Override
    protected void configure() {
        super.configure();


        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                DynamoElasticUserStore.module(),
                ElasticUtil.module(),
                DefaultServerSecret.module(Names.named("cursor"))
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                StringableSecretKey privKey = new StringableSecretKey(Keys.secretKeyFor(HS512));
                log.trace("Using generated priv key: {}", privKey);
                install(ConfigSystem.overrideModule(DynamoElasticUserStore.Config.class, om -> {
                    om.override(om.id().tokenSignerPrivKey()).withValue(privKey);
                    om.override(om.id().elasticForceRefresh()).withValue(true);
                }));
            }
        }));
    }

    @Test(timeout = 5_000L)
    public void testUser() throws Exception {
        UserModel user = new UserModel(
                IdUtil.randomId(),
                store.genUserId(),
                false,
                "john",
                "john.doe@example.com",
                "password",
                null,
                true,
                1L,
                "myIosPushToken",
                "myAndroidPushToken",
                "myBrowserPushToken",
                Instant.now(),
                null,
                null,
                null);

        store.createIndex(user.getProjectId()).get();
        store.createUser(user).getIndexingFuture().get();
        assertTrue(store.getUser(user.getProjectId(), user.getUserId()).isPresent());
        assertEquals(user, store.getUser(user.getProjectId(), user.getUserId()).get());
        assertTrue(store.getUserByIdentifier(user.getProjectId(), UserStore.IdentifierType.EMAIL, user.getEmail()).isPresent());
        assertEquals(user, store.getUserByIdentifier(user.getProjectId(), UserStore.IdentifierType.EMAIL, user.getEmail()).get());
        assertTrue(store.getUserByIdentifier(user.getProjectId(), UserStore.IdentifierType.ANDROID_PUSH, user.getAndroidPushToken()).isPresent());
        assertEquals(user, store.getUserByIdentifier(user.getProjectId(), UserStore.IdentifierType.ANDROID_PUSH, user.getAndroidPushToken()).get());
        assertTrue(store.getUserByIdentifier(user.getProjectId(), UserStore.IdentifierType.BROWSER_PUSH, user.getBrowserPushToken()).isPresent());
        assertEquals(user, store.getUserByIdentifier(user.getProjectId(), UserStore.IdentifierType.BROWSER_PUSH, user.getBrowserPushToken()).get());
        assertTrue(store.getUserByIdentifier(user.getProjectId(), UserStore.IdentifierType.IOS_PUSH, user.getIosPushToken()).isPresent());
        assertEquals(user, store.getUserByIdentifier(user.getProjectId(), UserStore.IdentifierType.IOS_PUSH, user.getIosPushToken()).get());

        assertEquals(ImmutableSet.of(user), store.getUsers(user.getProjectId(), ImmutableList.of(user.getUserId())).values());

        UserModel userUpdated = user.toBuilder()
                .name("joe")
                .email("joe.doe@example.com")
                .password("password2")
                .emailNotify(false)
                .iosPushToken("myIosPushToken2")
                .androidPushToken("myAndroidPushToken2")
                .browserPushToken("myBrowserPushToken2")
                .build();
        UserStore.UserAndIndexingFuture<UpdateResponse> updateResult = store.updateUser(user.getProjectId(), user.getUserId(), UserUpdate.builder()
                .name(userUpdated.getName())
                .email(userUpdated.getEmail())
                .password(userUpdated.getPassword())
                .emailNotify(userUpdated.isEmailNotify())
                .iosPushToken(userUpdated.getIosPushToken())
                .androidPushToken(userUpdated.getAndroidPushToken())
                .browserPushToken(userUpdated.getBrowserPushToken())
                .build());
        updateResult.getIndexingFuture().get();
        UserModel userUpdatedWithToken = userUpdated.toBuilder().authTokenValidityStart(updateResult.getUser().getAuthTokenValidityStart()).build();
        assertEquals(userUpdatedWithToken, updateResult.getUser());
        assertEquals(userUpdatedWithToken, store.getUser(userUpdatedWithToken.getProjectId(), userUpdatedWithToken.getUserId()).get());

        store.deleteUsers(userUpdatedWithToken.getProjectId(), ImmutableList.of(userUpdatedWithToken.getUserId())).get();
        assertEquals(Optional.empty(), store.getUser(userUpdatedWithToken.getProjectId(), userUpdatedWithToken.getUserId()));
    }

    @Test(timeout = 5_000L)
    public void testSearchUsers() throws Exception {
        String projectId = IdUtil.randomId();
        UserModel user1 = new UserModel(
                projectId,
                store.genUserId(),
                false,
                "john",
                "john.doe@example.com",
                "password",
                null,
                true,
                1L,
                "myIosPushToken1",
                "myAndroidPushToken1",
                "myBrowserPushToken1",
                Instant.now(),
                null,
                null,
                null);
        UserModel user2 = new UserModel(
                projectId,
                store.genUserId(),
                false,
                "matt",
                "matt@example.com",
                "jilasjdklad",
                null,
                true,
                1L,
                "myIosPushToken2",
                "myAndroidPushToken2",
                "myBrowserPushToken2",
                Instant.now().minus(1, ChronoUnit.DAYS),
                null,
                null,
                null);
        UserModel user3 = new UserModel(
                projectId,
                store.genUserId(),
                false,
                "Bobby",
                "bobby@example.com",
                "fawferfva",
                null,
                true,
                1L,
                "myIosPushToken3",
                "myAndroidPushToken3",
                "myBrowserPushToken3",
                Instant.now().minus(2, ChronoUnit.DAYS),
                null,
                null,
                null);

        store.createIndex(projectId).get().index();
        store.createUser(user1).getIndexingFuture().get();
        store.createUser(user2).getIndexingFuture().get();
        store.createUser(user3).getIndexingFuture().get();
        assertEquals(1, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("john").build(), false, Optional.empty(), Optional.empty()).getUserIds().size());
        assertEquals(3, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("example.com").build(), true, Optional.empty(), Optional.empty()).getUserIds().size());
        assertEquals(2, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("bobby matt").build(), false, Optional.empty(), Optional.empty()).getUserIds().size());
        assertEquals(1, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("Bobbby").build(), true, Optional.empty(), Optional.empty()).getUserIds().size());
        store.updateUser(projectId, user1.getUserId(), UserUpdate.builder()
                .name("bubbby").build())
                .getIndexingFuture().get();
        assertEquals(2, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("Bobbby").build(), false, Optional.empty(), Optional.empty()).getUserIds().size());

        {
            configSet(ElasticUtil.ConfigSearch.class, "pageSizeDefault", "2", "user");
            UserStore.SearchUsersResponse searchResponse = store.searchUsers(projectId, UserSearchAdmin.builder().searchText("example.com").build(), false, Optional.empty(), Optional.of(2));
            assertEquals(2, searchResponse.getUserIds().size());
            assertTrue(searchResponse.getCursorOpt().isPresent());
            UserStore.SearchUsersResponse searchResponse2 = store.searchUsers(projectId, UserSearchAdmin.builder().searchText("example.com").build(), false, searchResponse.getCursorOpt(), Optional.of(2));
            assertEquals(1, searchResponse2.getUserIds().size());
            assertFalse(searchResponse2.getCursorOpt().isPresent());
        }

        {
            configSet(ElasticUtil.ConfigSearch.class, "scrollSizeDefault", "2", "user");
            UserStore.SearchUsersResponse searchResponse = store.searchUsers(projectId, UserSearchAdmin.builder().searchText("example.com").build(), true, Optional.empty(), Optional.of(2));
            assertEquals(2, searchResponse.getUserIds().size());
            assertTrue(searchResponse.getCursorOpt().isPresent());
            UserStore.SearchUsersResponse searchResponse2 = store.searchUsers(projectId, UserSearchAdmin.builder().searchText("example.com").build(), true, searchResponse.getCursorOpt(), Optional.of(2));
            assertEquals(1, searchResponse2.getUserIds().size());
            assertFalse(searchResponse2.getCursorOpt().isPresent());
        }
    }

    @Test(timeout = 5_000L)
    public void testUserToken() throws Exception {
        UserModel user = new UserModel(
                IdUtil.randomId(),
                store.genUserId(),
                false,
                "john",
                "john.doe@example.com",
                "password",
                null,
                true,
                1L,
                "myIosPushToken",
                "myAndroidPushToken",
                "myBrowserPushToken",
                Instant.now(),
                null,
                null,
                null);

        store.createIndex(user.getProjectId()).get();
        store.createUser(user).getIndexingFuture().get();

        String token = store.createToken(user.getProjectId(), user.getUserId(), Duration.ofDays(1));

        assertEquals(Optional.of(user), store.verifyToken(token));

        store.updateUser(user.getProjectId(), user.getUserId(), UserUpdate.builder()
                .password("newPassword").build());

        assertEquals(Optional.empty(), store.verifyToken(token));
    }

    @Test(timeout = 5_000L)
    public void testUserSession() throws Exception {
        UserModel user = new UserModel(
                IdUtil.randomId(),
                store.genUserId(),
                false,
                "john",
                "john.doe@example.com",
                "password",
                null,
                true,
                1L,
                "myIosPushToken",
                "myAndroidPushToken",
                "myBrowserPushToken",
                Instant.now(),
                null,
                null,
                null);

        store.createIndex(user.getProjectId()).get();
        store.createUser(user).getIndexingFuture().get();

        UserSession session1 = store.createSession(user.getProjectId(), user.getUserId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 1 {}", session1);
        assertTrue(store.getSession(session1.getSessionId()).isPresent());
        assertEquals(session1, store.getSession(session1.getSessionId()).get());

        UserSession session2 = store.createSession(user.getProjectId(), user.getUserId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 2 {}", session2);
        assertTrue(store.getSession(session2.getSessionId()).isPresent());
        assertEquals(session2, store.getSession(session2.getSessionId()).get());
        assertTrue(store.getSession(session1.getSessionId()).isPresent());

        store.revokeSession(session1);
        assertFalse(store.getSession(session1.getSessionId()).isPresent());
        assertTrue(store.getSession(session2.getSessionId()).isPresent());

        UserSession session3 = store.createSession(user.getProjectId(), user.getUserId(), Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        assertTrue(store.getSession(session3.getSessionId()).isPresent());
        assertEquals(session3, store.getSession(session3.getSessionId()).get());
        assertTrue(store.getSession(session2.getSessionId()).isPresent());

        store.revokeSessions(user.getProjectId(), user.getUserId(), Optional.of(session3.getSessionId()));
        assertFalse(store.getSession(session2.getSessionId()).isPresent());
        assertTrue(store.getSession(session3.getSessionId()).isPresent());

        long refreshedExpiry = Instant.ofEpochMilli(System.currentTimeMillis()).plus(2, ChronoUnit.DAYS).getEpochSecond();
        store.refreshSession(session3, refreshedExpiry);
        assertTrue(store.getSession(session3.getSessionId()).isPresent());
        assertEquals(refreshedExpiry, store.getSession(session3.getSessionId()).get().getTtlInEpochSec());

        store.revokeSessions(user.getProjectId(), user.getUserId(), Optional.empty());
        assertFalse(store.getSession(session3.getSessionId()).isPresent());
    }
}