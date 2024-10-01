package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.IdeaSearchAdmin.SortByEnum;
import dev.langchain4j.agent.tool.*;
import dev.langchain4j.service.tool.ToolExecution;

import java.util.List;

/**
 * Messages in "Memory" are AI and user messages used for prompt, which can be summarized, skipped.
 *
 * @see LlmHistoryStore LlmHistoryStore used for exact messages to be displayed in Thread history to the user.
 */
public interface LlmToolingStore {

    ImmutableList<ToolSpecification> getTools();

    ToolExecution runTool(String projectId, ToolExecutionRequest request);

    @Tool("Searches for posts based on criteria")
    String searchPosts(
            @ToolMemoryId String projectId,
            @P("sorting type: TRENDING (recently popular), TOP (most popular), NEW (most recent), RANDOM (random sample)") SortByEnum sortBy,
            @P(value = "search for occurrence of a term in title/description", required = false) String search,
            @P(value = "filter by category ids", required = false) List<String> filterCategoryIds,
            @P(value = "filter by user/author id", required = false) String filterAuthorId,
            @P("number of results to return between 1 an 100") long limit
    );
}
