package com.smotana.clearflask.store;

import com.smotana.clearflask.api.model.CreateMessageResponse;
import com.smotana.clearflask.store.LlmHistoryStore.MessageModel;

public interface LlmAgentStore {

    /**
     * Ask a question to AI
     *
     * @return Message ID of the response. Use {@link #awaitAnswer} to retrieve it.
     */
    CreateMessageResponse ask(String projectId,
            String accountId,
            String convoId,
            String question);

    /**
     * Will asynchronously stream messages, otherwise will synchronously reply; always assume asynchronous.
     */
    void awaitAnswer(String projectId, String convoId, String messageId, AnswerSubscriber subscriber);

    /**
     * Similar to the LangChain StreamingResponseHandler, but differs in that the completed message may be an AI message
     * or an error message.
     */
    interface AnswerSubscriber {

        void onNext(String nextToken);

        /**
         * At least once guarantee to be called. May contain an AI message or a System message on error.
         */
        void onComplete(MessageModel message);
    }
}
