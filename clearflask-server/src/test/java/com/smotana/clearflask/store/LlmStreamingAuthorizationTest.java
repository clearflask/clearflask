package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.smotana.clearflask.api.model.ConvoMessage;
import com.smotana.clearflask.store.impl.LangChainLlmAgentStore;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.model.StreamingResponseHandler;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import org.junit.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class LlmStreamingAuthorizationTest {

    @Test
    public void knownMessageIdCannotInterceptAnotherProjectOrConversationsTokens() throws Exception {
        LangChainLlmAgentStore store = new LangChainLlmAgentStore();
        LangChainLlmAgentStore.Config config = mock(LangChainLlmAgentStore.Config.class);
        when(config.openAiApiKey()).thenReturn("test-key");
        LlmHistoryStore history = mock(LlmHistoryStore.class);
        when(history.genMessageId()).thenReturn("question", "response");
        LlmHistoryStore.MessageModel question = mock(LlmHistoryStore.MessageModel.class);
        when(question.toConvoMessage()).thenReturn(mock(ConvoMessage.class));
        when(history.putMessage("question", "conversation", ConvoMessage.AuthorTypeEnum.USER, "hello"))
                .thenReturn(question);
        LlmPromptStore prompts = mock(LlmPromptStore.class);
        when(prompts.getPrompt("project", "account")).thenReturn(SystemMessage.from("system"));
        LlmMemoryStore memory = mock(LlmMemoryStore.class);
        when(memory.messages("conversation")).thenReturn(ImmutableList.of());
        LlmToolingStore tooling = mock(LlmToolingStore.class);
        when(tooling.getTools()).thenReturn(ImmutableList.of());
        OpenAiStreamingChatModel model = mock(OpenAiStreamingChatModel.class);
        inject(store, "config", config);
        inject(store, "llmHistoryStore", history);
        inject(store, "llmPromptStore", prompts);
        inject(store, "llmMemoryStore", memory);
        inject(store, "llmToolingStore", tooling);
        inject(store, "model", model);

        store.ask("project", "account", "conversation", "hello", Optional.empty());
        ArgumentCaptor<StreamingResponseHandler> handler = ArgumentCaptor.forClass(StreamingResponseHandler.class);
        verify(model).generate(anyList(), anyList(), handler.capture());
        LlmAgentStore.AnswerSubscriber owner = mock(LlmAgentStore.AnswerSubscriber.class);
        LlmAgentStore.AnswerSubscriber otherProject = mock(LlmAgentStore.AnswerSubscriber.class);
        LlmAgentStore.AnswerSubscriber otherConversation = mock(LlmAgentStore.AnswerSubscriber.class);
        store.awaitAnswer("project", "conversation", "response", owner);
        store.awaitAnswer("other-project", "conversation", "response", otherProject);
        store.awaitAnswer("project", "other-conversation", "response", otherConversation);

        handler.getValue().onNext("private response");

        verify(owner).onNext("private response");
        verifyNoInteractions(otherProject, otherConversation);
    }

    private static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
