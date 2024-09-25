package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.Convo;
import com.smotana.clearflask.api.model.ConvoMessage;
import com.smotana.clearflask.api.model.ConvoMessage.AuthorTypeEnum;
import com.smotana.clearflask.util.IdUtil;
import io.dataspray.singletable.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.Optional;

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

    ConvoModel createConvo(String projectId,
            String userId,
            String title);

    Optional<ConvoModel> getConvo(String projectId,
            String userId,
            String convoId);

    ImmutableList<ConvoModel> listConvos(String projectId,
            String userId);

    void deleteConvo(String projectId,
            String userId,
            String convoId);

    MessageModel putMessage(String convoId,
            AuthorTypeEnum authorType,
            String content);

    ImmutableList<MessageModel> getMessages(String convoId);

    void deleteForProject(String projectId);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "llmConvo", rangeKeys = {"convoId"})
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "llmConvoByProjectId")
    class ConvoModel {
        public String projectId;
        public String userId;
        public String convoId;
        public Instant created;
        public String title;

        public Convo toConvo() {
            return new Convo(
                    convoId,
                    created,
                    title);
        }
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"convoId"}, rangePrefix = "llmMsg", rangeKeys = {"messageId"})
    class MessageModel {
        public String convoId;
        public String messageId;
        public Instant created;
        public AuthorTypeEnum authorType;
        public String content;

        public ConvoMessage toConvoMessage() {
            return new ConvoMessage(
                    messageId,
                    created,
                    authorType,
                    content);
        }
    }
}
