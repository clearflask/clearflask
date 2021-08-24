// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
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
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.store.impl.DynamoProjectStore;
import com.smotana.clearflask.store.impl.DynamoVoteStore;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.ProjectUpgraderImpl;
import com.smotana.clearflask.util.ServerSecretTest;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import com.smotana.clearflask.web.util.WebhookServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static com.smotana.clearflask.store.VoteStore.VoteValue.*;
import static com.smotana.clearflask.testutil.HtmlUtil.textToSimpleHtml;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

@Slf4j
public class IdeaStoreIT extends AbstractIT {

    @Inject
    private IdeaStore store;
    @Inject
    private UserStore userStore;

    @Override
    protected void configure() {
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                Application.module(),
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                DynamoElasticIdeaStore.module(),
                DynamoElasticUserStore.module(),
                DynamoVoteStore.module(),
                Sanitizer.module(),
                ElasticUtil.module(),
                DefaultServerSecret.module(Names.named("cursor")),
                WebhookServiceImpl.module(),
                DynamoProjectStore.module(),
                ProjectUpgraderImpl.module(),
                IntercomUtil.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoElasticIdeaStore.Config.class, om -> {
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
                .projectId(projectId)
                .authorUserId(userId1)
                .title("aaaaaaaaaaaaaa")
                .created(Instant.now().minus(3, ChronoUnit.DAYS))
                .funded(10L)
                .build();
        IdeaModel idea2 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .authorUserId(userId2)
                .title("bbbbbbbbbbbbbb")
                .created(Instant.now().minus(2, ChronoUnit.DAYS))
                .funded(30L)
                .build();
        IdeaModel idea3 = MockModelUtil.getRandomIdea().toBuilder()
                .projectId(projectId)
                .authorUserId(userId3)
                .title("cccccccccccccc")
                .created(Instant.now().minus(1, ChronoUnit.DAYS))
                .funded(20L)
                .build();
        store.createIdea(idea1).get();
        store.createIdea(idea2).get();
        store.createIdea(idea3).get();
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
        assertEquals(Long.valueOf(5L), histogram.getHits().getValue());
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
}