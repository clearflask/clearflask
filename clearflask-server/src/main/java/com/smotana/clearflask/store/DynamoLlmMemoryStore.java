package com.smotana.clearflask.store;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import dev.langchain4j.data.message.*;
import dev.langchain4j.model.Tokenizer;
import dev.langchain4j.model.openai.OpenAiTokenizer;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Singleton
public class DynamoLlmMemoryStore implements LlmMemoryStore {

    public interface Config {
        @DefaultValue("10000")
        Integer memoryMaxTokens();
    }

    @Inject
    private Config config;
    @Inject
    private LangChainLlmAgentStore.Config configAgentStore;
    @Inject
    private SingleTable singleTable;

    private TableSchema<MessagesModel> messagesSchema;
    private volatile Tokenizer tokenizer;

    @Inject
    private void setup() {
        messagesSchema = singleTable.parseTableSchema(MessagesModel.class);

        setupTokenizer();
        configAgentStore.openAiModelNameObservable().subscribe(v -> setupTokenizer());
    }

    private void setupTokenizer() {
        tokenizer = new OpenAiTokenizer(configAgentStore.openAiModelName());
    }

    LoadingCache<String, MessagesModel> messagesModelCache = CacheBuilder.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10L))
            .build(new CacheLoader<>() {
                @Override
                public MessagesModel load(@NotNull String convoId) throws Exception {
                    return fetchMessagesModel(convoId);
                }
            });

    @Override
    public List<ChatMessage> messages(String convoId) {
        return messagesModelCache.getUnchecked(convoId).getMessages();
    }

    @Override
    public void add(String convoId, ChatMessage message) {
        addAll(convoId, ImmutableList.of(message));
    }

    @Override
    public void addAll(String convoId, List<ChatMessage> newMessages) {
        MessagesModel messagesModel = messagesModelCache.getUnchecked(convoId);
        ImmutableList<ChatMessage> messages = messagesModel.getMessages();
        messages = ImmutableList.<ChatMessage>builderWithExpectedSize(messages.size() + 1)
                .addAll(messages)
                .addAll(newMessages)
                .build();
        messages = ensureCapacity(
                messages,
                config.memoryMaxTokens(),
                tokenizer);
        messagesModel = messagesModel.toBuilder()
                .messagesJson(messages.stream()
                        .map(ChatMessageSerializer::messageToJson)
                        .collect(ImmutableList.toImmutableList()))
                .build();
        messagesSchema.table().putItem(messagesSchema.toItem(messagesModel));
        this.messagesModelCache.put(convoId, messagesModel);
    }

    private MessagesModel fetchMessagesModel(String convoId) {
        return Optional.ofNullable(messagesSchema.fromItem(messagesSchema.table().getItem(messagesSchema.primaryKey(Map.of(
                        "convoId", convoId)))))
                .orElseGet(() -> new MessagesModel(convoId, ImmutableList.of()));
    }

    /**
     * Trims down messages to fit in memory.
     * <p/>
     * <ul>
     *     <li>Ensures total count of tokens fits into maxTokens </li>
     *     <li>Removes orphaned {@link ToolExecutionResultMessage} messages</li>
     *     <li>Ensures only last {@link SystemMessage} is retained</li>
     * </ul>
     * Based on {@link dev.langchain4j.memory.chat.TokenWindowChatMemory#ensureCapacity}.
     */
    private ImmutableList<ChatMessage> ensureCapacity(ImmutableList<ChatMessage> messages, int maxTokens, Tokenizer tokenizer) {

        ImmutableList.Builder<ChatMessage> trimmedMessagesBuilder = ImmutableList.builder();
        boolean evictOrphanedToolExecutionResultMessages = false;
        long currentTokenCount = tokenizer.estimateTokenCountInMessages(messages);
        log.trace("Ensuring capacity for {} messages up to {} tokens, currently at {}", messages.size(), maxTokens, currentTokenCount);

        // Find and remove system messages first, retaining only the most recent one
        long removeSystemMessageCount = 0;
        boolean seenSystemMessage = false;
        // Iterate through messages from most recent to oldest
        for (ChatMessage message : messages.reverse()) {
            if (message instanceof SystemMessage) {
                if (!seenSystemMessage) {
                    // Retain the latest system message
                    seenSystemMessage = true;
                } else {
                    // Evict all other system messages
                    // Remove tokens for these messages now so we have a chance to keep other messages later
                    currentTokenCount -= tokenizer.estimateTokenCountInMessage(message);
                    removeSystemMessageCount++;
                }
            }
        }

        for (ChatMessage message : messages) {

            // Evict tool result messages if requested
            if (evictOrphanedToolExecutionResultMessages) {
                if (message instanceof ToolExecutionResultMessage) {
                    currentTokenCount -= tokenizer.estimateTokenCountInMessage(message);
                    log.trace("Evicting tool result message: {}", message.text());
                    continue; // Message evicted
                } else {
                    evictOrphanedToolExecutionResultMessages = false;
                }
            }

            // Keep all but one system message
            if (message instanceof SystemMessage) {
                if (removeSystemMessageCount > 0) {
                    // Don't count tokens here, already subtracted above
                    log.trace("Evicting system message: {}", message.text());
                    removeSystemMessageCount--;
                    continue; // Message evicted
                } else {
                    trimmedMessagesBuilder.add(message);
                    continue; // Message retained
                }
            }

            // Retain message if it fits
            if (currentTokenCount <= maxTokens) {
                trimmedMessagesBuilder.add(message);
                continue; // Message retained
            }

            // Message evicted
            log.trace("Evicting message that doesn't fit: {}", message.text());
            currentTokenCount -= tokenizer.estimateTokenCountInMessage(message);
            // Some LLMs (e.g. OpenAI) prohibit ToolExecutionResultMessage(s) without corresponding AiMessage,
            // so we have to automatically evict orphan ToolExecutionResultMessage(s) if AiMessage was evicted
            if (message instanceof AiMessage && ((AiMessage) message).hasToolExecutionRequests()) {
                evictOrphanedToolExecutionResultMessages = true;
            }
        }

        return trimmedMessagesBuilder.build();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LlmMemoryStore.class).to(DynamoLlmMemoryStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
