package com.smotana.clearflask.store;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.Lists;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConvoMessage;
import com.smotana.clearflask.api.model.CreateMessageResponse;
import com.smotana.clearflask.store.LlmHistoryStore.MessageModel;
import com.smotana.clearflask.util.LogUtil;
import dev.langchain4j.data.message.*;
import dev.langchain4j.model.StreamingResponseHandler;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import dev.langchain4j.model.output.Response;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class LangChainLlmAgentStore implements LlmAgentStore {

    public interface Config {

        @DefaultValue("gpt-4o")
        String openAiModelName();

        Observable<String> openAiModelNameObservable();

        @DefaultValue("none")
        String openAiApiKey();

        Observable<String> openAiApiKeyObservable();

        @DefaultValue("https://api.openai.com/v1")
        String openAiBaseUrl();

        Observable<String> openAiBaseUrlObservable();

        @DefaultValue("0.7")
        Double temperature();

        Observable<Double> temperatureObservable();

        @DefaultValue("true")
        Boolean debugLogging();

        Observable<Boolean> debugLoggingObservable();

        @DefaultValue("PT1M")
        Duration timeout();

        Observable<Duration> timeoutObservable();
    }

    @Inject
    private Config config;
    @Inject
    private LlmPromptStore llmPromptStore;
    @Inject
    private LlmMemoryStore llmMemoryStore;
    @Inject
    private LlmHistoryStore llmHistoryStore;
    @Inject
    private LlmToolingStore llmToolingStore;

    private final Cache<String, AnswerSubscriber> messageIdToSubscriber = CacheBuilder.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(15))
            .build();
    private volatile OpenAiStreamingChatModel model;

    @Inject
    public void setup() {
        Stream.of(
                        config.openAiModelNameObservable(),
                        config.openAiApiKeyObservable(),
                        config.openAiBaseUrlObservable(),
                        config.temperatureObservable(),
                        config.debugLoggingObservable(),
                        config.timeoutObservable()
                )
                .forEach(o -> o.subscribe(v -> setupModel()));
        setupModel();
    }

    private void setupModel() {
        this.model = OpenAiStreamingChatModel.builder()
                .apiKey(config.openAiApiKey())
                .baseUrl(config.openAiBaseUrl())
                .modelName(config.openAiModelName())
                .logRequests(config.debugLogging())
                .logResponses(config.debugLogging())
                .temperature(config.temperature())
                .timeout(config.timeout())
                .build();
    }

    @Override
    public CreateMessageResponse ask(String projectId, String convoId, String question) {
        SystemMessage prompt = llmPromptStore.getPrompt(projectId);
        List<ChatMessage> memoryMessages = llmMemoryStore.messages(convoId);
        UserMessage newMessage = UserMessage.from(question);

        List<ChatMessage> messages = Lists.newArrayList();
        messages.add(prompt);
        messages.addAll(memoryMessages);
        messages.add(newMessage);

        String responseMessageId = llmHistoryStore.genMessageId();
        StringBuilder pendingTokens = new StringBuilder();

        AtomicLong recursionCounter = new AtomicLong(0);

        this.model.generate(messages, llmToolingStore.getTools(), new StreamingResponseHandler<>() {
            @Override
            public void onNext(String token) {
                try {
                    Optional<AnswerSubscriber> subscriberOpt = Optional.ofNullable(LangChainLlmAgentStore.this.messageIdToSubscriber.getIfPresent(responseMessageId));

                    if (!subscriberOpt.isPresent()) {
                        pendingTokens.append(token);
                    } else {
                        final String fullToken;
                        if (pendingTokens.length() > 0) {
                            fullToken = pendingTokens.append(token).toString();
                            pendingTokens.setLength(0);
                        } else {
                            fullToken = token;
                        }
                        subscriberOpt.get().onNext(fullToken);
                    }
                } catch (Exception ex) {
                    if (LogUtil.rateLimitAllowLog("LangChainLlmAgentStore-onNext-fail")) {
                        log.warn("Error handling next token write", ex);
                    }
                }
            }

            @Override
            public void onError(Throwable th) {
                if (LogUtil.rateLimitAllowLog("LangChainLlmAgentStore-onError")) {
                    log.warn("Failed to produce llm message", th);
                }
                try {
                    MessageModel messageModel = llmHistoryStore.putMessage(responseMessageId, convoId, ConvoMessage.AuthorTypeEnum.ALERT, "Failed to ask AI, please try again later.");
                    Optional.ofNullable(LangChainLlmAgentStore.this.messageIdToSubscriber.getIfPresent(responseMessageId))
                            .ifPresent(subscriber -> subscriber.onComplete(messageModel));
                } catch (Exception ex) {
                    if (LogUtil.rateLimitAllowLog("LangChainLlmAgentStore-onError-fail")) {
                        log.warn("Error handling error message write", ex);
                    }
                }
            }

            @Override
            public void onComplete(Response<AiMessage> response) {
                try {
                    log.info("AI message completed due to {} with tokens: {} = {} in + {} out",
                            response.finishReason(),
                            response.tokenUsage().totalTokenCount(),
                            response.tokenUsage().outputTokenCount(),
                            response.tokenUsage().inputTokenCount());
                    log.debug("AI message response: {}", response.content().text());

                    // Handle tool execution requests
                    if (response.content().hasToolExecutionRequests()) {

                        // Recursion safeguard
                        if (recursionCounter.getAndAdd(1) > Math.min(10, llmToolingStore.getTools().size())) {
                            if (LogUtil.rateLimitAllowLog("LangChainLlmAgentStore-recursion-limit")) {
                                log.warn("Recursion limit reached, stopping execution");
                            }
                            MessageModel messageModel = llmHistoryStore.putMessage(responseMessageId, convoId, ConvoMessage.AuthorTypeEnum.ALERT, "AI fell into recursion, please try again later.");
                            Optional.ofNullable(LangChainLlmAgentStore.this.messageIdToSubscriber.getIfPresent(responseMessageId))
                                    .ifPresent(subscriber -> subscriber.onComplete(messageModel));
                            return;
                        }

                        // Fetch data
                        ImmutableList<ToolExecutionResultMessage> toolResponseMessages = response.content().toolExecutionRequests().parallelStream()
                                .map(toolExecutionRequest -> llmToolingStore.runTool(projectId, toolExecutionRequest))
                                .map(toolExecution -> ToolExecutionResultMessage.from(toolExecution.request(), toolExecution.result()))
                                .collect(ImmutableList.toImmutableList());
                        messages.add(response.content());
                        messages.addAll(toolResponseMessages);

                        // Re-run the model with the results
                        LangChainLlmAgentStore.this.model.generate(messages, llmToolingStore.getTools(), this);
                        llmMemoryStore.add(convoId, response.content());
                        return;
                    }

                    // Send the final message
                    MessageModel messageModel = llmHistoryStore.putMessage(responseMessageId, convoId, ConvoMessage.AuthorTypeEnum.AI, response.content().text());
                    Optional.ofNullable(LangChainLlmAgentStore.this.messageIdToSubscriber.getIfPresent(responseMessageId))
                            .ifPresent(subscriber -> subscriber.onComplete(messageModel));
                    llmMemoryStore.add(convoId, response.content());
                } catch (Exception ex) {
                    if (LogUtil.rateLimitAllowLog("LangChainLlmAgentStore-onError-fail")) {
                        log.warn("Error handling completed message write", ex);
                    }
                }
            }
        });

        MessageModel questionMessageMode = llmHistoryStore.putMessage(llmHistoryStore.genMessageId(), convoId, ConvoMessage.AuthorTypeEnum.USER, question);
        llmMemoryStore.add(convoId, newMessage);

        return new CreateMessageResponse(
                convoId,
                questionMessageMode.toConvoMessage(),
                responseMessageId);
    }

    @Override
    public void awaitAnswer(String projectId, String convoId, String messageId, AnswerSubscriber subscriber) {

        // First subscribe to the message, if the message is still in progress, the asynchronous process will stream
        // tokens and then call onComplete when the message is complete.
        this.messageIdToSubscriber.put(messageId, subscriber);

        // If this message is already complete, we need to call onComplete ourselves.
        // This here is why we have an at-least-once guarantee for the onComplete call.
        this.llmHistoryStore.getMessage(convoId, messageId)
                .ifPresent(subscriber::onComplete);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LlmAgentStore.class).to(LangChainLlmAgentStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(LangChainLlmAgentStore.Config.class));
            }
        };
    }
}
