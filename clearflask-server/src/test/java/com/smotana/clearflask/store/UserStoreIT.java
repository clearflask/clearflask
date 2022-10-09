// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramResponsePoints;
import com.smotana.clearflask.api.model.HistogramSearchAdmin;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.impl.DynamoElasticAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.ChatwootUtil;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.ProjectUpgraderImpl;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.util.StringableSecretKey;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static io.jsonwebtoken.SignatureAlgorithm.HS512;
import static org.junit.Assert.*;

@Slf4j
@RunWith(Parameterized.class)
public class UserStoreIT extends AbstractIT {

    @Parameterized.Parameter(0)
    public ProjectStore.SearchEngine searchEngine;

    @Parameterized.Parameters(name = "{0}")
    public static Object[][] data() {
        return new Object[][]{
                {SearchEngine.READWRITE_ELASTICSEARCH},
                {ProjectStore.SearchEngine.READWRITE_MYSQL},
        };
    }

    @Inject
    private UserStore store;

    @Override
    protected void configure() {
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                Application.module(),
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                DynamoElasticUserStore.module(),
                DynamoElasticAccountStore.module(),
                Sanitizer.module(),
                MysqlUtil.module(),
                ElasticUtil.module(),
                DefaultServerSecret.module(Names.named("cursor")),
                WebhookServiceImpl.module(),
                DynamoProjectStore.module(),
                ProjectUpgraderImpl.module(),
                IntercomUtil.module(),
                ChatwootUtil.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(Application.Config.class, om -> {
                    om.override(om.id().defaultSearchEngine()).withValue(searchEngine);
                }));
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

    @Test(timeout = 10_000L)
    public void testUser() throws Exception {
        UserModel user = new UserModel(
                IdUtil.randomId(),
                store.genUserId(Optional.empty()),
                null,
                false,
                "john",
                "john.doe@example.com",
                null,
                null,
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
                null,
                null,
                null,
                ImmutableSet.of());

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
        UserStore.UserAndIndexingFuture updateResult = store.updateUser(user.getProjectId(), user.getUserId(), UserUpdate.builder()
                .name(userUpdated.getName())
                .email(userUpdated.getEmail())
                .password(userUpdated.getPassword())
                .emailNotify(userUpdated.isEmailNotify())
                .iosPushToken(userUpdated.getIosPushToken())
                .androidPushToken(userUpdated.getAndroidPushToken())
                .browserPushToken(userUpdated.getBrowserPushToken())
                .build());
        updateResult.getIndexingFuture().get();
        UserModel userUpdatedWithToken = userUpdated.toBuilder()
                .authTokenValidityStart(updateResult.getUser().getAuthTokenValidityStart())
                .emailLastUpdated(updateResult.getUser().getEmailLastUpdated())
                .build();
        assertEquals(userUpdatedWithToken, updateResult.getUser());
        assertEquals(userUpdatedWithToken, store.getUser(userUpdatedWithToken.getProjectId(), userUpdatedWithToken.getUserId()).get());

        store.deleteUsers(userUpdatedWithToken.getProjectId(), ImmutableList.of(userUpdatedWithToken.getUserId())).get();
        assertEquals(Optional.empty(), store.getUser(userUpdatedWithToken.getProjectId(), userUpdatedWithToken.getUserId()));
    }

    @Test(timeout = 10_000L)
    public void testSearchUsers() throws Exception {
        String projectId = IdUtil.randomId();
        UserModel user1 = new UserModel(
                projectId,
                store.genUserId(Optional.empty()),
                null,
                false,
                "john",
                "john.doe@example.com",
                null,
                null,
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
                null,
                null,
                null,
                ImmutableSet.of());
        UserModel user2 = new UserModel(
                projectId,
                store.genUserId(Optional.empty()),
                null,
                false,
                "matt",
                "matt@example.com",
                null,
                null,
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
                null,
                null,
                null,
                ImmutableSet.of());
        UserModel user3 = new UserModel(
                projectId,
                store.genUserId(Optional.empty()),
                null,
                false,
                "Bobby",
                "bobby@example.com",
                null,
                null,
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
                null,
                null,
                null,
                ImmutableSet.of());

        store.createIndex(projectId).get();
        store.createUser(user1).getIndexingFuture().get();
        store.createUser(user2).getIndexingFuture().get();
        store.createUser(user3).getIndexingFuture().get();
        assertEquals(1, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("john").build(), false, Optional.empty(), Optional.empty()).getUserIds().size());
        assertEquals(3, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("example.com").build(), true, Optional.empty(), Optional.empty()).getUserIds().size());
        if (searchEngine.isReadElastic()) {
            assertEquals(2, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("bobby matt").build(), false, Optional.empty(), Optional.empty()).getUserIds().size());
            assertEquals(1, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("Bobbby").build(), true, Optional.empty(), Optional.empty()).getUserIds().size());
        }
        store.updateUser(projectId, user1.getUserId(), UserUpdate.builder()
                        .name("bubbby").build())
                .getIndexingFuture().get();
        if (searchEngine.isReadElastic()) {
            assertEquals(2, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("Bobbby").build(), false, Optional.empty(), Optional.empty()).getUserIds().size());
        } else {
            assertEquals(1, store.searchUsers(projectId, UserSearchAdmin.builder().searchText("bubbby").build(), false, Optional.empty(), Optional.empty()).getUserIds().size());
        }

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

    @Test(timeout = 30_000L)
    public void testHistogram() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        Instant now = Instant.now();
        UserStore.UserModel user0 = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .created(now)
                .build();
        UserStore.UserModel user1 = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .created(now.minus(1, ChronoUnit.DAYS))
                .build();
        UserStore.UserModel user2 = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .created(now.minus(3, ChronoUnit.DAYS))
                .build();
        UserStore.UserModel user3 = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .created(now.minus(3, ChronoUnit.DAYS))
                .build();
        UserStore.UserModel user4 = MockModelUtil.getRandomUser().toBuilder()
                .projectId(projectId)
                .created(now.minus(4, ChronoUnit.DAYS))
                .build();
        store.createUser(user0).getIndexingFuture().get();
        store.createUser(user1).getIndexingFuture().get();
        store.createUser(user2).getIndexingFuture().get();
        store.createUser(user3).getIndexingFuture().get();
        store.createUser(user4).getIndexingFuture().get();

        LocalDate nowDate = LocalDate.ofInstant(now, ZoneOffset.UTC);
        HistogramResponse histogram = store.histogram(projectId, HistogramSearchAdmin.builder()
                .filterCreatedStart(nowDate.minus(3, ChronoUnit.DAYS))
                .filterCreatedEnd(nowDate.minus(1, ChronoUnit.DAYS))
                .build());
        assertEquals(
                ImmutableList.of(
                        new HistogramResponsePoints(nowDate.minusDays(3), 2L),
                        new HistogramResponsePoints(nowDate.minusDays(1), 1L)),
                histogram.getPoints());
        if (Boolean.TRUE.equals(histogram.getHits().getIsGte())) {
            assertTrue(5 >= histogram.getHits().getValue());
        } else {
            assertEquals(Long.valueOf(5L), histogram.getHits().getValue());
        }
    }

    @Test(timeout = 10_000L)
    public void testUserToken() throws Exception {
        UserModel user = new UserModel(
                IdUtil.randomId(),
                store.genUserId(Optional.empty()),
                null,
                false,
                "john",
                "john.doe@example.com",
                null,
                null,
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
                null,
                null,
                null,
                ImmutableSet.of());

        store.createIndex(user.getProjectId()).get();
        store.createUser(user).getIndexingFuture().get();

        String token = store.createToken(user.getProjectId(), user.getUserId(), Duration.ofDays(1));

        assertEquals(Optional.of(user), store.verifyToken(token));

        store.updateUser(user.getProjectId(), user.getUserId(), UserUpdate.builder()
                .password("newPassword").build());

        assertEquals(Optional.empty(), store.verifyToken(token));
    }

    @Test(timeout = 10_000L)
    public void testUserSession() throws Exception {
        UserModel user = new UserModel(
                IdUtil.randomId(),
                store.genUserId(Optional.empty()),
                null,
                false,
                "john",
                "john.doe@example.com",
                null,
                null,
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
                null,
                null,
                null,
                ImmutableSet.of());

        store.createIndex(user.getProjectId()).get();
        store.createUser(user).getIndexingFuture().get();

        UserSession session1 = store.createSession(user, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 1 {}", session1);
        assertTrue(store.getSession(session1.getSessionId()).isPresent());
        assertEquals(session1, store.getSession(session1.getSessionId()).get());

        UserSession session2 = store.createSession(user, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
        log.info("Created session 2 {}", session2);
        assertTrue(store.getSession(session2.getSessionId()).isPresent());
        assertEquals(session2, store.getSession(session2.getSessionId()).get());
        assertTrue(store.getSession(session1.getSessionId()).isPresent());

        store.revokeSession(session1);
        assertFalse(store.getSession(session1.getSessionId()).isPresent());
        assertTrue(store.getSession(session2.getSessionId()).isPresent());

        UserSession session3 = store.createSession(user, Instant.ofEpochMilli(System.currentTimeMillis()).plus(1, ChronoUnit.DAYS).getEpochSecond());
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