package com.smotana.clearflask.store.impl;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.IdeaSearchAdmin;
import com.smotana.clearflask.api.model.IdeaSearchAdmin.SortByEnum;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.LlmToolingStore;
import com.smotana.clearflask.web.security.Sanitizer;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.agent.tool.ToolSpecification;
import dev.langchain4j.agent.tool.ToolSpecifications;
import dev.langchain4j.service.tool.DefaultToolExecutor;
import dev.langchain4j.service.tool.ToolExecution;
import dev.langchain4j.service.tool.ToolExecutor;
import lombok.extern.slf4j.Slf4j;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Singleton
public class LangChainLlmToolingStore implements LlmToolingStore {

    @Inject
    private IdeaStore ideaStore;
    @Inject
    private Sanitizer sanitizer;

    private ImmutableMap<String, ToolExecutor> toolExecutorByName;
    private ImmutableList<ToolSpecification> toolSpecifications;

    @Inject
    public void setup() {
        ImmutableMap.Builder<String, ToolExecutor> toolExecutorByNameBuilder = ImmutableMap.builder();
        ImmutableList.Builder<ToolSpecification> toolSpecificationsBuilder = ImmutableList.builder();
        for (Method method : this.getClass().getDeclaredMethods()) {
            if (method.isAnnotationPresent(Tool.class)) {
                toolExecutorByNameBuilder.put(method.getName(), new DefaultToolExecutor(this, method));
                toolSpecificationsBuilder.add(ToolSpecifications.toolSpecificationFrom(method));
                log.debug("Loaded LLM tool: {}", method.getName());
            }
        }
        this.toolExecutorByName = toolExecutorByNameBuilder.build();
        this.toolSpecifications = toolSpecificationsBuilder.build();
    }

    @Override
    public ImmutableList<ToolSpecification> getTools() {
        return toolSpecifications;
    }

    @Override
    public ToolExecution runTool(String projectId, ToolExecutionRequest request) {
        String result = Optional.ofNullable(toolExecutorByName.get(request.name()))
                .orElseThrow(() -> new IllegalArgumentException("Tool not found: " + request.name()))
                .execute(request, projectId);
        return ToolExecution.builder()
                .request(request)
                .result(result)
                .build();
    }

    @Override
    public String searchPosts(String projectId, SortByEnum sortBy, String search, List<String> filterCategoryIds, String filterAuthorId, long limit) {
        IdeaStore.SearchResponse searchResponse = ideaStore.searchIdeas(projectId, IdeaSearchAdmin.builder()
                        .sortBy(sortBy)
                        .filterCategoryIds(filterCategoryIds)
                        .filterAuthorId(filterAuthorId)
                        .searchText(search)
                        .limit(limit)
                        .build(),
                false, Optional.empty());

        if (searchResponse.getIdeaIds().isEmpty()) {
            return "Empty results";
        }

        return ideaStore.getIdeas(projectId, searchResponse.getIdeaIds()).values().stream()
                .map(LangChainLlmToolingStore.this::printPost)
                .collect(Collectors.joining("\n"));
    }

    private String printPost(IdeaModel post) {
        return MoreObjects.toStringHelper(post).omitNullValues()
                .add("postId", post.getIdeaId())
                .add("created", post.getCreated())
                .add("title", post.getTitle())
                .add("content", post.getDescriptionAsText(sanitizer))
                .add("authorId", post.getAuthorUserId())
                .add("authorIsMod", post.getAuthorIsMod())
                .add("authorName", post.getExpressionsValue())
                .add("categoryId", post.getCategoryId())
                .add("statusId", post.getStatusId())
                .add("tagIds", post.getTagIds())
                .add("commentCount", post.getCommentCount())
                .add("votersCount", post.getVotersCount())
                .add("voteValue", post.getVoteValue())
                .add("response", post.getResponseAsText(sanitizer))
                .add("responseAuthorId", post.getResponseAuthorUserId())
                .add("responseAuthorName", post.getAuthorName())
                .toString();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LlmToolingStore.class).to(LangChainLlmToolingStore.class).asEagerSingleton();
            }
        };
    }
}
