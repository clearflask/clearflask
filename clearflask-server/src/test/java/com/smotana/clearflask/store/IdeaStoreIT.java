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
import com.smotana.clearflask.testutil.AbstractIT;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.ElasticUtil;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ServerSecretTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

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
                ElasticUtil.module()
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
        store.createIdea(idea).getIndexingFuture().get();
        store.createIdea(idea2).getIndexingFuture().get();
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
                .categoryId(IdUtil.randomId())
                .title("newTitle")
                .fundGoal(BigDecimal.TEN)
                .build();
        store.updateIdea(projectId, idea2.getIdeaId(), IdeaUpdateAdmin.builder()
                .categoryId(idea2Updated.getCategoryId())
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
                .funded(BigDecimal.valueOf(10L))
                .build();
        IdeaModel idea2 = getRandomIdea(projectId).toBuilder()
                .title("bbbbbbbbbbbbbb")
                .created(Instant.now().minus(2, ChronoUnit.DAYS))
                .funded(BigDecimal.valueOf(30L))
                .build();
        IdeaModel idea3 = getRandomIdea(projectId).toBuilder()
                .title("cccccccccccccc")
                .created(Instant.now().minus(1, ChronoUnit.DAYS))
                .funded(BigDecimal.valueOf(20L))
                .build();
        store.createIdea(idea1).getIndexingFuture().get();
        store.createIdea(idea2).getIndexingFuture().get();
        store.createIdea(idea3).getIndexingFuture().get();

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
                .limit(1)
                .build(), false, Optional.empty()).getIdeaIds().size());
        assertEquals(2, store.searchIdeas(projectId, IdeaSearchAdmin.builder()
                .limit(2)
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
    }

    private IdeaModel getRandomIdea(String projectId) {
        return new IdeaModel(
                projectId,
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
                BigDecimal.ZERO,
                BigDecimal.valueOf(100),
                ImmutableSet.of(),
                0L,
                0L,
                BigDecimal.ZERO,
                ImmutableMap.of());
    }
}