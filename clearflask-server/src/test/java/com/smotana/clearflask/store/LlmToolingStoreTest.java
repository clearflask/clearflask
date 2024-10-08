package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.inject.Inject;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.store.impl.LangChainLlmToolingStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.MustacheProvider;
import com.smotana.clearflask.web.security.Sanitizer;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@Slf4j
public class LlmToolingStoreTest extends AbstractTest {

    @Inject
    private LlmToolingStore store;

    @Inject
    private Gson gson;
    @Inject
    private IdeaStore mockIdeaStore;

    @Override
    protected void configure() {
        super.configure();

        install(LangChainLlmToolingStore.module());

        bindMock(IdeaStore.class);
        bindMock(ContentStore.class);
        install(Sanitizer.module());
        install(MustacheProvider.module());
    }

    @Test(timeout = 30_000L)
    public void test() throws Exception {
        String projectId = "smotana-xie";
        ImmutableMap<String, IdeaStore.IdeaModel> posts = ImmutableMap.of(
                "some-idea-1-fgwed", MockModelUtil.getRandomIdea().toBuilder()
                        .projectId(projectId)
                        .ideaId("some-idea-1-fgwed")
                        .authorName("John Doe")
                        .authorUserId("john-doe")
                        .authorIsMod(true)
                        .created(Instant.ofEpochMilli(123L))
                        .response("some response")
                        .commentCount(4L)
                        .voteValue(123L)
                        .votersCount(324L)
                        .responseAuthorUserId("bob-a")
                        .responseAuthorName("Bob A")
                        .categoryId("some-category-id-1")
                        .statusId("some-status-id-1")
                        .tagIds(ImmutableSet.of("tag-id-1", "tag-id-2"))
                        .build(),
                "some-idea-2-fsdaf", MockModelUtil.getRandomIdea().toBuilder()
                        .projectId(projectId)
                        .ideaId("some-idea-2-fsdaf")
                        .authorName(null)
                        .authorUserId("taylor-s")
                        .authorIsMod(null)
                        .created(Instant.ofEpochMilli(123L))
                        .response(null)
                        .responseAuthorUserId(null)
                        .responseAuthorName(null)
                        .responseEdited(null)
                        .voteValue(null)
                        .votersCount(null)
                        .categoryId("some-category-id-2")
                        .statusId(null)
                        .tagIds(ImmutableSet.of())
                        .build());
        when(this.mockIdeaStore.searchIdeas(anyString(), any(IdeaSearchAdmin.class), anyBoolean(), any(Optional.class))).thenReturn(new IdeaStore.SearchResponse(
                posts.keySet().asList(), Optional.empty(), 2L, false));
        when(this.mockIdeaStore.getIdeas(anyString(), any(ImmutableCollection.class))).thenReturn(posts);

        String resultActual = store.runTool(projectId, ToolExecutionRequest.builder()
                        .name("searchPosts")
                        .arguments(gson.toJson(ImmutableMap.of(
                                "sortBy", "TOP",
                                "limit", 10))).build())
                .result();

        assertEquals(getTestResource("searchPosts-result-expected.txt"), resultActual);
    }
}