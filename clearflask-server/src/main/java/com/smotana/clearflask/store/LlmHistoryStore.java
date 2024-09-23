package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.util.IdUtil;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;

import static io.dataspray.singletable.TableType.Gsi;
import static io.dataspray.singletable.TableType.Primary;

/**
 * History of messages written between AI and user.
 *
 * @see LlmMemoryStore LlmMemoryStore for storing messages used for prompt.
 */
public interface LlmHistoryStore {

    default String genConvoId() {
        return IdUtil.randomAscId();
    }

    default String genMessageId() {
        return IdUtil.randomAscId();
    }

    Convo createConvo(String projectId,
            String userId,
            String title);

    ImmutableList<Convo> getConvos(String projectId,
            String userId);

    void deleteConvo(String projectId,
            String userId,
            String convoId);

    Message putMessage(String convoId,
            AuthorType authorType,
            String content);

    ImmutableList<Message> getMessages(String convoId);

    void deleteForProject(String projectId);

    enum AuthorType {
        USER,
        AI
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "llmConvo", rangeKeys = {"convoId"})
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "llmConvoByProjectId")
    class Convo {
        public String projectId;
        public String userId;
        public String convoId;
        public Instant created;
        public String title;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"convoId"}, rangePrefix = "llmMsg", rangeKeys = {"messageId"})
    class Message {
        public String convoId;
        public String messageId;
        public Instant created;
        public AuthorType authorType;
        public String content;
    }
}
