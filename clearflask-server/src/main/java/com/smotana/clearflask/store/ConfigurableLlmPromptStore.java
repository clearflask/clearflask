package com.smotana.clearflask.store;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.common.io.Resources;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.util.Extern;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.model.input.PromptTemplate;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import java.io.IOException;
import java.util.Optional;

@Slf4j
@Singleton
public class ConfigurableLlmPromptStore implements LlmPromptStore {

    public static final String PROMPT_RESOURCE_PATH = "llm/prompt.txt";

    public interface Config {
        @DefaultValue("")
        String promptOverride();

        Observable<String> promptOverrideObservable();
    }

    @Inject
    private Config config;

    private PromptTemplate template;

    @Inject
    public void setup() {
        setupTemplate();
        config.promptOverrideObservable().subscribe(v -> setupTemplate());
    }

    @Extern
    public void setupTemplate() {
        String templateStr = Optional.ofNullable(Strings.emptyToNull(config.promptOverride()))
                .orElseGet(() -> {
                    try {
                        return Resources.toString(Thread.currentThread().getContextClassLoader().getResource(PROMPT_RESOURCE_PATH), Charsets.UTF_8)
                                // Remove lines that start with #, which are comments
                                .lines().filter(line -> !line.trim().startsWith("#")).reduce((a1, a2) -> a1 + "\n" + a2).orElseThrow();
                    } catch (IOException ex) {
                        throw new RuntimeException(ex);
                    }
                });
        log.trace("Loaded prompt template:\n{}", templateStr);
        this.template = PromptTemplate.from(templateStr);
    }

    @Override
    public SystemMessage getPrompt(String projectId) throws PromptNotReadyException, ProjectNotEligibleException {
        return template.apply(ImmutableMap.of()).toSystemMessage();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LlmPromptStore.class).to(ConfigurableLlmPromptStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
