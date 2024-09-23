package com.smotana.clearflask.store;

import dev.langchain4j.store.memory.chat.ChatMemoryStore;

/**
 * Messages in "Memory" are AI and user messages used for prompt, which can be summarized, skipped.
 *
 * @see LlmHistoryStore LlmHistoryStore used for exact messages to be displayed in Thread history to the user.
 */
public interface LlmMemoryStore extends ChatMemoryStore {
}
