// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.HistogramResponse;
import com.smotana.clearflask.api.model.HistogramResponsePoints;
import com.smotana.clearflask.api.model.IdeaAggregateResponse;
import com.smotana.clearflask.api.model.IdeaHistogramSearchAdmin;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.impl.DynamoElasticMysqlAccountStore;
import com.smotana.clearflask.store.impl.DynamoElasticMysqlIdeaStore;
import com.smotana.clearflask.store.impl.DynamoElasticMysqlUserStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.store.impl.DynamoVoteStore;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.ChatwootUtil;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.ProjectUpgraderImpl;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.concurrent.ExecutionException;

import static com.smotana.clearflask.store.VoteStore.VoteValue.*;
import static com.smotana.clearflask.testutil.HtmlUtil.textToSimpleHtml;
import static org.junit.Assert.*;

@Slf4j
@RunWith(Parameterized.class)
public class IdeaStoreIT extends AbstractIT {

    @Parameterized.Parameter(0)
    public ProjectStore.SearchEngine searchEngine;

    @Parameterized.Parameters(name = "{0}")
    public static Object[][] data() {
        return new Object[][]{
                {ProjectStore.SearchEngine.READWRITE_ELASTICSEARCH},
                {ProjectStore.SearchEngine.READWRITE_MYSQL},
        };
    }

    @Inject
    private IdeaStore store;
    @Inject
    private UserStore userStore;

    @Override
    protected void configure() {
        overrideSearchEngine = searchEngine;
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module(),
                DynamoElasticMysqlIdeaStore.module(),
                DynamoElasticMysqlAccountStore.module(),
                DynamoElasticMysqlUserStore.module(),
                DynamoVoteStore.module(),
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
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoElasticMysqlIdeaStore.Config.class, om -> {
                    om.override(om.id().elasticForceRefresh()).withValue(true);
                }));
            }
        }));
    }

    @Test(timeout = 30_000L)
    public void test() throws Exception {
        String projectId = IdUtil.randomId();
        UserStore.UserModel moderator = MockModelUtil.getRandomUser().toBuilder().isMod(true).build();
        store.createIndex(projectId).get();
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId).build();
        IdeaModel idea2 = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId).build();
        store.createIdea(idea).get();
        store.createIdea(idea2).get();
        assertEquals(Optional.of(idea), store.getIdea(projectId, idea.getIdeaId()));
        assertEquals(Optional.of(idea2), store.getIdea(projectId, idea2.getIdeaId()));
        assertEquals(ImmutableSet.of(idea2, idea), ImmutableSet.copyOf(store.getIdeas(projectId, ImmutableList.of(idea2.getIdeaId(), idea.getIdeaId())).values()));

        IdeaModel ideaUpdated = idea.toBuilder().title("newTitle").description(textToSimpleHtml("newDescription")).build();
        store.updateIdea(projectId, idea.getIdeaId(), IdeaUpdate.builder()
                .title(ideaUpdated.getTitle())
                .description(ideaUpdated.getDescriptionAsUnsafeHtml())
                .build()).getIndexingFuture().get();
        assertEquals(Optional.of(ideaUpdated), store.getIdea(projectId, ideaUpdated.getIdeaId()));

        IdeaModel idea2Updated = idea2.toBuilder()
                .title("newTitle")
                .response(textToSimpleHtml("newDescription"))
                .responseAuthorName(moderator.getName())
                .responseAuthorUserId(moderator.getUserId())
                .fundGoal(10L)
                .build();
        store.updateIdea(projectId, idea2.getIdeaId(), IdeaUpdateAdmin.builder()
                .title(idea2Updated.getTitle())
                .response(textToSimpleHtml("newDescription"))
                .fundGoal(idea2Updated.getFundGoal())
                .build(), Optional.of(moderator)).getIndexingFuture().get();
        Optional<IdeaModel> idea2UpdatedActual = store.getIdea(projectId, idea2Updated.getIdeaId());
        assertNotEquals(
                Optional.of(idea2Updated.getResponseEdited()),
                idea2UpdatedActual.map(IdeaModel::getResponseEdited));
        assertEquals(
                Optional.of(idea2Updated.toBuilder().responseEdited(idea2UpdatedActual.map(IdeaModel::getResponseEdited).orElse(null)).build()),
                idea2UpdatedActual);

        store.deleteIdea(projectId, ideaUpdated.getIdeaId(), true).get();
        assertEquals(Optional.empty(), store.getIdea(projectId, ideaUpdated.getIdeaId()));
        store.deleteIdeas(projectId, ImmutableSet.of(idea2Updated.getIdeaId())).get();
        assertEquals(Optional.empty(), store.getIdea(projectId, idea2Updated.getIdeaId()));
    }

    @Test(timeout = 30_000L)
    public void testSearch() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        userStore.createIndex(projectId);
        String userId1 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        String userId2 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        String userId3 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        IdeaModel idea1 = MockModelUtil.getRandomIdea().toBuilder()
                .ideaId("idea1")
                .projectId(projectId)
                .authorUserId(userId1)
                .title("aaa aaaa aaaaa aa")
                .description("aaaa aaa aa aaaaa")
                .categoryId("cat1")
                .statusId("status1")
                .created(Instant.now().minus(3, ChronoUnit.DAYS))
                .voteValue(10L)
                .build();
        IdeaModel idea2 = MockModelUtil.getRandomIdea().toBuilder()
                .ideaId("idea2")
                .projectId(projectId)
                .authorUserId(userId2)
                .title("aaa aaaa aa aaaaaaa")
                .description("aaa aa aaaa aaaa aaa")
                .categoryId("cat1")
                .statusId("status2")
                .created(Instant.now().minus(2, ChronoUnit.DAYS))
                .voteValue(30L)
                .build();
        IdeaModel idea3 = MockModelUtil.getRandomIdea().toBuilder()
                .ideaId("idea3")
                .projectId(projectId)
                .authorUserId(userId3)
                .title("ccccc cccccc cccccc cc ccc")
                .description("cccc ccccc cccc cccc ccc")
                .categoryId("cat2")
                .statusId("status3")
                .created(Instant.now().minus(1, ChronoUnit.DAYS))
                .voteValue(-20L)
                .build();
        store.createIdea(idea1).get();
        store.createIdea(idea2).get();
        store.createIdea(idea3).get();

        assertSearchResult(projectId, IdeaSearchAdmin.builder().build(),
                ImmutableSet.of(idea1.getIdeaId(), idea2.getIdeaId(), idea3.getIdeaId()));

        // Test sort
        assertSearchResult(projectId, IdeaSearchAdmin.builder()
                        .sortBy(IdeaSearchAdmin.SortByEnum.NEW).build(),
                ImmutableList.of(idea3.getIdeaId(), idea2.getIdeaId(), idea1.getIdeaId()));
        assertSearchResult(projectId, IdeaSearchAdmin.builder()
                        .sortBy(IdeaSearchAdmin.SortByEnum.TOP).build(),
                ImmutableList.of(idea2.getIdeaId(), idea1.getIdeaId(), idea3.getIdeaId()));

        // Test limit
        assertSearchResult(projectId, IdeaSearchAdmin.builder()
                        .sortBy(IdeaSearchAdmin.SortByEnum.NEW)
                        .limit(1L).build(),
                ImmutableSet.of(idea3.getIdeaId()));

        // Test similar
        assertSearchResult(projectId, IdeaSearchAdmin.builder()
                        .similarToIdeaId(idea1.getIdeaId()).build(),
                ImmutableSet.of(idea2.getIdeaId()));

        // Test category
        assertSearchResult(projectId, IdeaSearchAdmin.builder()
                        .filterCategoryIds(ImmutableList.of("cat1")).build(),
                ImmutableSet.of(idea1.getIdeaId(), idea2.getIdeaId()));
        assertSearchResult(projectId, IdeaSearchAdmin.builder()
                        .filterCategoryIds(ImmutableList.of("cat1"))
                        .invertCategory(true).build(),
                ImmutableSet.of(idea3.getIdeaId()));

        // Test status
        assertSearchResult(projectId, IdeaSearchAdmin.builder()
                        .filterStatusIds(ImmutableList.of("status1")).build(),
                ImmutableSet.of(idea1.getIdeaId()));
        assertSearchResult(projectId, IdeaSearchAdmin.builder()
                        .filterStatusIds(ImmutableList.of("status1"))
                        .invertStatus(true).build(),
                ImmutableSet.of(idea2.getIdeaId(), idea3.getIdeaId()));
    }

    @Test(timeout = 30_000L)
    public void testDragNDrop() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        userStore.createIndex(projectId);
        String userId1 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        String userId2 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        String userId3 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        IdeaModel idea1 = MockModelUtil.getRandomIdea().toBuilder()
                .ideaId("idea1")
                .projectId(projectId)
                .authorUserId(userId1)
                .created(Instant.now().minus(3, ChronoUnit.DAYS))
                .build();
        IdeaModel idea2 = MockModelUtil.getRandomIdea().toBuilder()
                .ideaId("idea2")
                .projectId(projectId)
                .authorUserId(userId2)
                .created(Instant.now().minus(2, ChronoUnit.DAYS))
                .build();
        IdeaModel idea3 = MockModelUtil.getRandomIdea().toBuilder()
                .ideaId("idea3")
                .projectId(projectId)
                .authorUserId(userId3)
                .created(Instant.now().minus(1, ChronoUnit.DAYS))
                .build();
        store.createIdea(idea1).get();
        store.createIdea(idea2).get();
        store.createIdea(idea3).get();

        assertSearchResult(projectId, IdeaSearchAdmin.builder().sortBy(IdeaSearchAdmin.SortByEnum.DRAGANDDROP).build(), ImmutableSet.of(
                idea1.getIdeaId(),
                idea2.getIdeaId(),
                idea3.getIdeaId()));

        idea1 = dropIdea(projectId, idea1.getIdeaId(),
                Optional.of(idea3),
                Optional.empty());
        assertSearchResult(projectId, IdeaSearchAdmin.builder().sortBy(IdeaSearchAdmin.SortByEnum.DRAGANDDROP).build(), ImmutableSet.of(
                idea2.getIdeaId(),
                idea3.getIdeaId(),
                idea1.getIdeaId()));

        idea2 = dropIdea(projectId, idea2.getIdeaId(),
                Optional.of(idea3),
                Optional.of(idea1));
        assertSearchResult(projectId, IdeaSearchAdmin.builder().sortBy(IdeaSearchAdmin.SortByEnum.DRAGANDDROP).build(), ImmutableSet.of(
                idea3.getIdeaId(),
                idea2.getIdeaId(),
                idea1.getIdeaId()));

        idea1 = dropIdea(projectId, idea1.getIdeaId(),
                Optional.empty(),
                Optional.of(idea3));
        assertSearchResult(projectId, IdeaSearchAdmin.builder().sortBy(IdeaSearchAdmin.SortByEnum.DRAGANDDROP).build(), ImmutableSet.of(
                idea1.getIdeaId(),
                idea3.getIdeaId(),
                idea2.getIdeaId()));

        idea3 = dropIdea(projectId, idea3.getIdeaId(),
                Optional.of(idea1),
                Optional.of(idea2));
        assertSearchResult(projectId, IdeaSearchAdmin.builder().sortBy(IdeaSearchAdmin.SortByEnum.DRAGANDDROP).build(), ImmutableSet.of(
                idea1.getIdeaId(),
                idea3.getIdeaId(),
                idea2.getIdeaId()));
    }

    IdeaModel dropIdea(String projectId, String postId, Optional<IdeaModel> afterPostOpt, Optional<IdeaModel> beforePostOpt) throws ExecutionException, InterruptedException {
        // This logic determines what the order should be based on other posts in the same list
        // This is implemented in dashboardDndActionHandler.ts, if changed there, change here too
        double order;
        if (afterPostOpt.isPresent() && beforePostOpt.isPresent()) {
            order = (afterPostOpt.get().getOrderOrDefault() + beforePostOpt.get().getOrderOrDefault()) / 2d;
        } else if (afterPostOpt.isPresent()) {
            order = afterPostOpt.get().getOrderOrDefault() + 1;
        } else if (beforePostOpt.isPresent()) {
            order = beforePostOpt.get().getOrderOrDefault() - 1;
        } else {
            // Nothing to do, just return the post
            return store.getIdea(projectId, postId).get();
        }
        IdeaStore.IdeaAndIndexingFuture ideaAndIndexingFuture = store.updateIdea(projectId, postId, IdeaUpdateAdmin.builder()
                .order(order).build(), Optional.empty());
        ideaAndIndexingFuture.getIndexingFuture().get();
        return ideaAndIndexingFuture.getIdea();
    }

    /** Assert presence with specific order */
    void assertSearchResult(String projectId, IdeaSearchAdmin search, ImmutableList<String> expectedPostIds) {
        assertEquals(expectedPostIds, store.searchIdeas(
                        projectId, search, false, Optional.empty())
                .getIdeaIds());
    }

    /** Assert presence without ordering */
    void assertSearchResult(String projectId, IdeaSearchAdmin search, ImmutableSet<String> expectedPostIds) {
        assertEquals(expectedPostIds, ImmutableSet.copyOf(store.searchIdeas(
                        projectId, search, false, Optional.empty())
                .getIdeaIds()));
    }

    @Test(timeout = 30_000L)
    public void testHistogram() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        Instant now = Instant.now();
        IdeaModel idea0 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId("c1").statusId("s1").tagIds(ImmutableSet.of("t1"))
                .created(now)
                .build();
        IdeaModel idea1 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId("c1").statusId("s1").tagIds(ImmutableSet.of("t1"))
                .created(now.minus(1, ChronoUnit.DAYS))
                .build();
        IdeaModel idea2 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId("c1").statusId("s1").tagIds(ImmutableSet.of("t1"))
                .created(now.minus(3, ChronoUnit.DAYS))
                .build();
        IdeaModel idea3 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId("c1").statusId("s1").tagIds(ImmutableSet.of("t1"))
                .created(now.minus(3, ChronoUnit.DAYS))
                .build();
        IdeaModel idea4 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId("c1").statusId("s1").tagIds(ImmutableSet.of("t1"))
                .created(now.minus(4, ChronoUnit.DAYS))
                .build();
        IdeaModel idea5 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId("c2").statusId("s1").tagIds(ImmutableSet.of("t1"))
                .created(now.minus(1, ChronoUnit.DAYS))
                .build();
        IdeaModel idea6 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId("c1").statusId("s2").tagIds(ImmutableSet.of("t1"))
                .created(now.minus(1, ChronoUnit.DAYS))
                .build();
        IdeaModel idea7 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .categoryId("c1").statusId("s1").tagIds(ImmutableSet.of("t2"))
                .created(now.minus(1, ChronoUnit.DAYS))
                .build();
        store.createIdea(idea0).get();
        store.createIdea(idea1).get();
        store.createIdea(idea2).get();
        store.createIdea(idea3).get();
        store.createIdea(idea4).get();
        store.createIdea(idea5).get();
        store.createIdea(idea6).get();
        store.createIdea(idea7).get();

        LocalDate nowDate = LocalDate.ofInstant(now, ZoneOffset.UTC);
        // Should match idea[1-3] only
        HistogramResponse histogram = store.histogram(projectId, IdeaHistogramSearchAdmin.builder()
                .filterCategoryIds(ImmutableList.of("c1"))
                .filterStatusIds(ImmutableList.of("s1"))
                .filterTagIds(ImmutableList.of("t1"))
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

    @Test(timeout = 30_000L)
    public void testCount() throws Exception {
        String projectId = IdUtil.randomId();
        String categoryId1 = IdUtil.randomId();
        String categoryId2 = IdUtil.randomId();
        String tagId1 = IdUtil.randomId();
        String tagId2 = IdUtil.randomId();
        String tagId3 = IdUtil.randomId();
        String statusId1 = IdUtil.randomId();
        String statusId2 = IdUtil.randomId();
        String statusId3 = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea1 = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId)
                .categoryId(categoryId1)
                .tagIds(ImmutableSet.of(tagId1))
                .statusId(statusId1)
                .build();
        IdeaModel idea2 = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId)
                .categoryId(categoryId1)
                .tagIds(ImmutableSet.of(tagId1, tagId2))
                .statusId(statusId2)
                .build();
        IdeaModel idea3 = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId)
                .categoryId(categoryId1)
                .tagIds(ImmutableSet.of(tagId2, tagId1, tagId3))
                .statusId(statusId2)
                .build();
        IdeaModel idea4 = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId)
                .categoryId(categoryId1)
                .tagIds(ImmutableSet.of())
                .statusId(null)
                .build();
        IdeaModel idea5 = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId)
                .categoryId(categoryId2)
                .tagIds(ImmutableSet.of(tagId1, tagId2, tagId3))
                .statusId(statusId3)
                .build();
        store.createIdea(idea1).get();
        store.createIdea(idea2).get();
        store.createIdea(idea3).get();
        store.createIdea(idea4).get();
        store.createIdea(idea5).get();

        IdeaAggregateResponse response = store.countIdeas(projectId, categoryId1);
        assertEquals(IdeaAggregateResponse.builder()
                .total(4L)
                .statuses(ImmutableMap.of(
                        statusId1, 1L,
                        statusId2, 2L))
                .tags(ImmutableMap.of(
                        tagId1, 3L,
                        tagId2, 2L,
                        tagId3, 1L))
                .build(), response);
    }

    @Test(timeout = 30_000L)
    public void testCreateUpvoted() throws Exception {
        String projectId = IdUtil.randomId();

        userStore.createIndex(projectId);
        String userId1 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        String userId2 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();

        store.createIndex(projectId).get();
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder()
                .authorUserId(userId2)
                .projectId(projectId).build();
        store.createIdeaAndUpvote(idea).getIndexingFuture().get();

        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId1, Upvote).getIndexingFuture().get();
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId2, Upvote).getIndexingFuture().get();
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());
    }

    @Test(timeout = 30_000L)
    public void testVote() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId).build();
        store.createIdea(idea).get();
        userStore.createIndex(projectId);
        String userId1 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        String userId2 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();

        assertEquals(Long.valueOf(0L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(0L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId1, Upvote).getIndexingFuture().get();
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId2, Upvote).getIndexingFuture().get();
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId2, Upvote).getIndexingFuture().get();
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId1, Downvote).getIndexingFuture().get();
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(0L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId1, None).getIndexingFuture().get();
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId1, None).getIndexingFuture().get();
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());

        store.voteIdea(projectId, idea.getIdeaId(), userId2, Downvote).getIndexingFuture().get();
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getVotersCount());
        assertEquals(Long.valueOf(-1L), store.getIdea(projectId, idea.getIdeaId()).get().getVoteValue());
    }

    @Test(timeout = 30_000L)
    public void testExpress() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId).build();
        store.createIdea(idea).get();
        userStore.createIndex(projectId);
        String userId1 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();
        String userId2 = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();

        assertEquals(ImmutableMap.<String, Long>of(), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(0d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaAdd(projectId, idea.getIdeaId(), userId1, e -> 1d, "👀").getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 1L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(1d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaAdd(projectId, idea.getIdeaId(), userId1, e -> 0.5d, "🤪").getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 1L, "🤪", 1L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(1.5d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaAdd(projectId, idea.getIdeaId(), userId2, e -> -3d, "🤪").getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 1L, "🤪", 2L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(-1.5d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaAdd(projectId, idea.getIdeaId(), userId2, e -> -3d, "🤪").getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 1L, "🤪", 2L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(-1.5d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaRemove(projectId, idea.getIdeaId(), userId1, e -> 1d, "👀").getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 0L, "🤪", 2L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(-2.5d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaRemove(projectId, idea.getIdeaId(), userId1, e -> 1d, "👀").getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 0L, "🤪", 2L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(-2.5d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaSet(projectId, idea.getIdeaId(), userId1, e -> e.equals("👀") ? 2d : 1d, Optional.of("👀")).getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 1L, "🤪", 1L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(-1.5d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaSet(projectId, idea.getIdeaId(), userId1, e -> 1d, Optional.of("👀")).getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 1L, "🤪", 1L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(-1.5d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);

        store.expressIdeaSet(projectId, idea.getIdeaId(), userId2, e -> 1d, Optional.of("👀")).getIndexingFuture().get();
        assertEquals(ImmutableMap.of("👀", 2L, "🤪", 0L), store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());
        assertEquals(-1.5d, store.getIdea(projectId, idea.getIdeaId()).get().getExpressionsValue(), 0.001);
    }

    @Test(timeout = 30_000L)
    public void testFund() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder().projectId(projectId).build();
        store.createIdea(idea).get();
        String userId1 = IdUtil.randomId();
        String userId2 = IdUtil.randomId();

        assertEquals(Long.valueOf(0L), store.getIdea(projectId, idea.getIdeaId()).get().getFundersCount());
        assertEquals(Long.valueOf(0L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());

        store.fundIdea(projectId, idea.getIdeaId(), userId1, 10L, "transactionType", "summary").getIndexingFuture().get();
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getFundersCount());
        assertEquals(Long.valueOf(10L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());

        store.fundIdea(projectId, idea.getIdeaId(), userId1, -5L, "transactionType", "summary").getIndexingFuture().get();
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getFundersCount());
        assertEquals(Long.valueOf(5L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());

        store.fundIdea(projectId, idea.getIdeaId(), userId2, 7L, "transactionType", "summary").getIndexingFuture().get();
        assertEquals(Long.valueOf(2L), store.getIdea(projectId, idea.getIdeaId()).get().getFundersCount());
        assertEquals(Long.valueOf(12L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());

        store.fundIdea(projectId, idea.getIdeaId(), userId1, -5L, "transactionType", "summary").getIndexingFuture().get();
        assertEquals(Long.valueOf(1L), store.getIdea(projectId, idea.getIdeaId()).get().getFundersCount());
        assertEquals(Long.valueOf(7L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());
    }


    @Test(timeout = 30_000L)
    public void testExpressionsNullAutoFill() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                // In the past, some posts were created with empty expressions
                // which causes expressions to fail when updating non existent expressions map
                // Test that it gets created
                .expressions(null)
                .build();
        store.createIdea(idea).get();
        userStore.createIndex(projectId);
        String userId = userStore.createUser(MockModelUtil.getRandomUser().toBuilder().projectId(projectId).build()).getUser().getUserId();

        assertNotNull(store.getIdea(projectId, idea.getIdeaId()).get().getExpressions());

        store.expressIdeaSet(projectId, idea.getIdeaId(), userId, e -> e.equals("👀") ? 2d : 1d, Optional.of("👀")).getIndexingFuture().get();
    }
}