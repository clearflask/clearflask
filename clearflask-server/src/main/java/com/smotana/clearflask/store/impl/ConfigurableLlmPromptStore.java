package com.smotana.clearflask.store.impl;

import com.google.common.base.Charsets;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.io.Resources;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.samskivert.mustache.Mustache;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.LlmPromptStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.util.Extern;
import dev.langchain4j.data.message.SystemMessage;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;

import java.time.Duration;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Slf4j
@Singleton
public class ConfigurableLlmPromptStore implements LlmPromptStore {

    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private Mustache.Compiler mustache;

    private final LoadingCache<CacheKey, String> projectIdToPromptCache = CacheBuilder.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(10))
            .build(new CacheLoader<>() {
                @Override
                public String load(@NotNull CacheKey key) throws Exception {
                    return createPrompt(key.getProjectId(), key.getAccountId());
                }
            });
    private String templateStr;

    @Inject
    protected void setup() throws Exception {
        templateStr = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("llm/prompt.mustache"), Charsets.UTF_8);
    }

    @Extern
    public String getPromptExtern(String projectId) {
        String accountId = projectStore.getProject(projectId, true).orElseThrow().getAccountId();
        return getPrompt(projectId, accountId).text();
    }

    @Override
    public SystemMessage getPrompt(String projectId, String accountId) {
        return SystemMessage.from(projectIdToPromptCache.getUnchecked(new CacheKey(projectId, accountId)));
    }

    private String createPrompt(String projectId, String accountId) {
        Project project = projectStore.getProject(projectId, true).orElseThrow();
        Account account = accountStore.getAccount(accountId, true).orElseThrow();
        String prompt = mustache
                .compile(templateStr)
                .execute(new PromptContext(
                        account,
                        project.getVersionedConfigAdmin().getConfig(),
                        project));
        log.trace("Loaded prompt for project {} and account {}:\n{}", project.getName(), accountId, prompt);
        return prompt;
    }

    @Value
    private static class PromptContext {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("America/Toronto" /* fu everyone else */));
        Account account;
        ConfigAdmin config;
        Project project;
    }

    @Value
    private static class CacheKey {
        String projectId;
        String accountId;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LlmPromptStore.class).to(ConfigurableLlmPromptStore.class).asEagerSingleton();
            }
        };
    }
}
