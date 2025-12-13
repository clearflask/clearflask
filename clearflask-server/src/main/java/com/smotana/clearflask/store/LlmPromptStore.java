package com.smotana.clearflask.store;

import dev.langchain4j.data.message.SystemMessage;

public interface LlmPromptStore {

    SystemMessage getPrompt(String projectId, String accountId);
}
