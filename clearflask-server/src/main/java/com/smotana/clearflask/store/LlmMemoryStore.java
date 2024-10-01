package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.ChatMessageDeserializer;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.util.List;

import static io.dataspray.singletable.TableType.Primary;

/**
 * Messages in "Memory" are AI and user messages used for prompt, which can be summarized, skipped.
 *
 * @see LlmHistoryStore LlmHistoryStore used for exact messages to be displayed in Thread history to the user.
 */
public interface LlmMemoryStore {

    List<ChatMessage> messages(String convoId);

    void add(String convoId, ChatMessage message);

    void addAll(String convoId, List<ChatMessage> messages);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"convoId"}, rangePrefix = "llmMemoryConvo")
    class MessagesModel {
        @NonNull
        String convoId;

        @NonNull
        ImmutableList<String> messagesJson;

        public ImmutableList<ChatMessage> getMessages() {
            return getMessagesJson().stream()
                    .map(ChatMessageDeserializer::messageFromJson)
                    .collect(ImmutableList.toImmutableList());
        }
    }
}
