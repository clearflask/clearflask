package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.api.model.IdeaSearch;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaUpdate;
import com.smotana.clearflask.api.model.IdeaUpdateAdmin;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoElasticIdeaStore;
import com.smotana.clearflask.store.impl.DynamoVoteStore;
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ServerSecretTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static com.smotana.clearflask.store.VoteStore.VoteValue.*;
import static org.junit.Assert.assertEquals;

@Slf4j
public class IdeaStoreIT extends AbstractIT {

    @Inject
    private IdeaStore store;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                DynamoElasticIdeaStore.module(),
                DynamoVoteStore.module(),
                ElasticUtil.module(),
                DefaultServerSecret.module(Names.named("cursor"))
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

    @Test(timeout = 5_000L)
    public void test() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea = getRandomIdea(projectId);
        IdeaModel idea2 = getRandomIdea(projectId);
        store.createIdea(idea).get();
        store.createIdea(idea2).get();
        assertEquals(Optional.of(idea), store.getIdea(projectId, idea.getIdeaId()));
        assertEquals(Optional.of(idea2), store.getIdea(projectId, idea2.getIdeaId()));
        assertEquals(ImmutableSet.of(idea2, idea), ImmutableSet.copyOf(store.getIdeas(projectId, ImmutableList.of(idea2.getIdeaId(), idea.getIdeaId())).values()));

        IdeaModel ideaUpdated = idea.toBuilder().title("newTitle").description("newDescription").build();
        store.updateIdea(projectId, idea.getIdeaId(), IdeaUpdate.builder()
                .title(ideaUpdated.getTitle())
                .description(ideaUpdated.getDescription())
                .build()).getIndexingFuture().get();
        assertEquals(Optional.of(ideaUpdated), store.getIdea(projectId, ideaUpdated.getIdeaId()));

        IdeaModel idea2Updated = idea2.toBuilder()
                .title("newTitle")
                .fundGoal(10L)
                .build();
        store.updateIdea(projectId, idea2.getIdeaId(), IdeaUpdateAdmin.builder()
                .title(idea2Updated.getTitle())
                .fundGoal(idea2Updated.getFundGoal())
                .build()).getIndexingFuture().get();
        assertEquals(Optional.of(idea2Updated), store.getIdea(projectId, idea2Updated.getIdeaId()));

        store.deleteIdea(projectId, ideaUpdated.getIdeaId()).get();
        assertEquals(Optional.empty(), store.getIdea(projectId, ideaUpdated.getIdeaId()));
        store.deleteIdeas(projectId, ImmutableSet.of(idea2Updated.getIdeaId())).get();
        assertEquals(Optional.empty(), store.getIdea(projectId, idea2Updated.getIdeaId()));
    }

    @Test(timeout = 5_000L)
    public void testSearch() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea1 = getRandomIdea(projectId).toBuilder()
                .title("aaaaaaaaaaaaaa")
                .created(Instant.now().minus(3, ChronoUnit.DAYS))
                .funded(10L)
                .build();
        IdeaModel idea2 = getRandomIdea(projectId).toBuilder()
                .title("bbbbbbbbbbbbbb")
                .created(Instant.now().minus(2, ChronoUnit.DAYS))
                .funded(30L)
                .build();
        IdeaModel idea3 = getRandomIdea(projectId).toBuilder()
                .title("cccccccccccccc")
                .created(Instant.now().minus(1, ChronoUnit.DAYS))
                .funded(20L)
                .build();
        store.createIdea(idea1).get();
        store.createIdea(idea2).get();
        store.createIdea(idea3).get();

        // Idea Search
        assertEquals(ImmutableList.of(idea1.getIdeaId(), idea2.getIdeaId(), idea3.getIdeaId()), store.searchIdeas(projectId, IdeaSearch.builder()
                .build(), Optional.empty(), Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea1.getIdeaId()), store.searchIdeas(projectId, IdeaSearch.builder()
                .fundedByMeAndActive(true)
                .build(), Optional.of(idea1.getAuthorUserId()), Optional.empty()).getIdeaIds());

        // Idea Search Admin
        assertEquals(ImmutableList.of(idea1.getIdeaId(), idea2.getIdeaId(), idea3.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea2.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterCategoryIds(ImmutableList.of(idea2.getCategoryId()))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea2.getIdeaId(), idea3.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterStatusIds(ImmutableList.of(idea2.getStatusId(), idea3.getStatusId()))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea1.getIdeaId(), idea2.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterTagIds(ImmutableList.of(idea1.getTagIds().iterator().next(), idea2.getTagIds().iterator().next()))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea1.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .searchText("aaaaaaaaaaaaaa")
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(1, store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .limit(1L)
                .build(), false, Optional.empty()).getIdeaIds().size());
        assertEquals(2, store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .limit(2L)
                .build(), false, Optional.empty()).getIdeaIds().size());
        assertEquals(ImmutableList.of(idea2.getIdeaId(), idea3.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterCreatedStart(idea1.getCreated().plus(1, ChronoUnit.HOURS))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea1.getIdeaId(), idea2.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterCreatedEnd(idea3.getCreated().minus(1, ChronoUnit.HOURS))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea2.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterCreatedStart(idea1.getCreated().plus(1, ChronoUnit.HOURS))
                .filterCreatedEnd(idea3.getCreated().minus(1, ChronoUnit.HOURS))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea2.getIdeaId(), idea3.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterLastActivityStart(idea1.getCreated().plus(1, ChronoUnit.HOURS))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea1.getIdeaId(), idea2.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterLastActivityEnd(idea3.getCreated().minus(1, ChronoUnit.HOURS))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(idea2.getIdeaId()), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .filterLastActivityStart(idea1.getCreated().plus(1, ChronoUnit.HOURS))
                .filterLastActivityEnd(idea3.getCreated().minus(1, ChronoUnit.HOURS))
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(
                idea3.getIdeaId(),
                idea2.getIdeaId(),
                idea1.getIdeaId()
        ), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .sortBy(IdeaSearchAdmin.SortByEnum.NEW)
                .build(), false, Optional.empty()).getIdeaIds());
        assertEquals(ImmutableList.of(
                idea2.getIdeaId(),
                idea3.getIdeaId(),
                idea1.getIdeaId()
        ), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .sortBy(IdeaSearchAdmin.SortByEnum.TOP)
                .build(), false, Optional.empty()).getIdeaIds());
        // Use expressions to trigger TRENDING order
        store.expressIdeaAdd(projectId, idea1.getIdeaId(), idea1.getAuthorUserId(), e -> 1d, "👀").getIndexingFuture().get();
        store.expressIdeaAdd(projectId, idea1.getIdeaId(), idea1.getAuthorUserId(), e -> 1d, "🤪").getIndexingFuture().get();
        store.expressIdeaAdd(projectId, idea1.getIdeaId(), idea1.getAuthorUserId(), e -> 1d, "❤️").getIndexingFuture().get();
        store.expressIdeaAdd(projectId, idea3.getIdeaId(), idea1.getAuthorUserId(), e -> 1d, "😇").getIndexingFuture().get();
        store.expressIdeaAdd(projectId, idea3.getIdeaId(), idea1.getAuthorUserId(), e -> 1d, "😎").getIndexingFuture().get();
        assertEquals(ImmutableList.of(
                idea1.getIdeaId(),
                idea3.getIdeaId(),
                idea2.getIdeaId()
        ), store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .sortBy(IdeaSearchAdmin.SortByEnum.TRENDING)
                .build(), false, Optional.empty()).getIdeaIds());
    }

    @Test(timeout = 5_000L)
    public void testVote() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea = getRandomIdea(projectId);
        store.createIdea(idea).get();
        String userId1 = IdUtil.randomId();
        String userId2 = IdUtil.randomId();

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

    @Test(timeout = 5_000L)
    public void testExpress() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea = getRandomIdea(projectId);
        store.createIdea(idea).get();
        String userId1 = IdUtil.randomId();
        String userId2 = IdUtil.randomId();

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

    @Test(timeout = 5_000L)
    public void testFund() throws Exception {
        String projectId = IdUtil.randomId();
        store.createIndex(projectId).get();
        IdeaModel idea = getRandomIdea(projectId);
        store.createIdea(idea).get();
        String userId1 = IdUtil.randomId();
        String userId2 = IdUtil.randomId();

        assertEquals(ImmutableSet.of(), store.getIdea(projectId, idea.getIdeaId()).get().getFunderUserIds());
        assertEquals(Long.valueOf(0L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());

        store.fundIdea(projectId, idea.getIdeaId(), userId1, 10L, "transactionType", "summary").getIndexingFuture().get();
        assertEquals(ImmutableSet.of(userId1), store.getIdea(projectId, idea.getIdeaId()).get().getFunderUserIds());
        assertEquals(Long.valueOf(10L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());

        store.fundIdea(projectId, idea.getIdeaId(), userId1, -5L, "transactionType", "summary").getIndexingFuture().get();
        assertEquals(ImmutableSet.of(userId1), store.getIdea(projectId, idea.getIdeaId()).get().getFunderUserIds());
        assertEquals(Long.valueOf(5L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());

        store.fundIdea(projectId, idea.getIdeaId(), userId2, 7L, "transactionType", "summary").getIndexingFuture().get();
        assertEquals(ImmutableSet.of(userId1, userId2), store.getIdea(projectId, idea.getIdeaId()).get().getFunderUserIds());
        assertEquals(Long.valueOf(12L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());

        store.fundIdea(projectId, idea.getIdeaId(), userId1, -5L, "transactionType", "summary").getIndexingFuture().get();
        assertEquals(ImmutableSet.of(userId2), store.getIdea(projectId, idea.getIdeaId()).get().getFunderUserIds());
        assertEquals(Long.valueOf(7L), store.getIdea(projectId, idea.getIdeaId()).get().getFunded());
    }

    private IdeaModel getRandomIdea(String projectId) {
        return new IdeaModel(
                projectId,
                store.genIdeaId(" this !@#$%^&*()is my title 9032 "),
                IdUtil.randomId(),
                IdUtil.randomId(),
                Instant.now(),
                "title",
                "description",
                "response",
                IdUtil.randomId(),
                IdUtil.randomId(),
                ImmutableSet.of(IdUtil.randomId(), IdUtil.randomId()),
                0L,
                0L,
                0L,
                100L,
                ImmutableSet.of(),
                0L,
                0L,
                0d,
                ImmutableMap.of());
    }
}