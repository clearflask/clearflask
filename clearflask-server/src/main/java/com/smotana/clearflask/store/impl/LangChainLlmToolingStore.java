package com.smotana.clearflask.store.impl;

import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableCollection;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.io.Resources;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.samskivert.mustache.Mustache;
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
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;

@Slf4j
@Singleton
public class LangChainLlmToolingStore implements LlmToolingStore {

    @Inject
    private IdeaStore ideaStore;
    @Inject
    private Sanitizer sanitizer;
    @Inject
    private Mustache.Compiler mustache;

    private String templateStrToolSearchPosts;
    private ImmutableMap<String, ToolExecutor> toolExecutorByName;
    private ImmutableList<ToolSpecification> toolSpecifications;

    @Inject
    public void setup() throws Exception {
        templateStrToolSearchPosts = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("llm/toolSearchPosts.mustache"), Charsets.UTF_8);
        ImmutableMap.Builder<String, ToolExecutor> toolExecutorByNameBuilder = ImmutableMap.builder();
        ImmutableList.Builder<ToolSpecification> toolSpecificationsBuilder = ImmutableList.builder();
        for (Method method : LlmToolingStore.class.getDeclaredMethods()) {
            if (method.isAnnotationPresent(Tool.class)) {
                toolExecutorByNameBuilder.put(method.getName(), new DefaultToolExecutor(this, method));
                ToolSpecification toolSpecification = ToolSpecifications.toolSpecificationFrom(method);
                toolSpecificationsBuilder.add(toolSpecification);
                log.info("Loaded LLM tool: {}", toolSpecification);
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
        if (result.isBlank()) {
            // ToolExecution cannot have blank result
            result = "empty result";
        }
        log.info("Executed tool {} args {} result {}", request.name(), request.arguments(), result);
        return ToolExecution.builder()
                .request(request)
                .result(result)
                .build();
    }

    @Override
    public String searchPosts(String projectId, SortByEnum sortBy, String search, List<String> filterCategoryIds, String filterAuthorId, Long limit) {
        ImmutableCollection<IdeaModel> posts = ideaStore.getIdeas(projectId, ideaStore.searchIdeas(projectId, IdeaSearchAdmin.builder()
                                        .sortBy(sortBy)
                                        .filterCategoryIds(filterCategoryIds)
                                        .filterAuthorId(filterAuthorId)
                                        .searchText(search)
                                        .limit(limit)
                                        .build(),
                                false, Optional.empty())
                        .getIdeaIds())
                .values();
        log.info("Tool searchPosts found {} posts", posts.size());
        String result = mustache
                .compile(templateStrToolSearchPosts)
                .execute(new PostsContext(
                        posts.stream()
                                .map(PostContext::new)
                                .collect(ImmutableList.toImmutableList())));
        log.trace("Tool searchPosts results:\n{}", result);
        return result;
    }

    @Value
    private static class PostsContext {
        List<PostContext> posts;
    }

    @Value
    private class PostContext {
        IdeaModel post;

        String getDescriptionAsText() {
            return post.getDescriptionAsText(sanitizer);
        }
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
