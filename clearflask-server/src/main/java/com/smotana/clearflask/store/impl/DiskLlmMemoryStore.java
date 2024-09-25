package com.smotana.clearflask.store.impl;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.LlmMemoryStore;
import dev.langchain4j.data.message.ChatMessage;
import org.mapdb.DB;
import org.mapdb.DBMaker;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static dev.langchain4j.data.message.ChatMessageDeserializer.messagesFromJson;
import static dev.langchain4j.data.message.ChatMessageSerializer.messagesToJson;
import static org.mapdb.Serializer.INTEGER;
import static org.mapdb.Serializer.STRING;

/**
 * A local drive based implementation of {@link LlmMemoryStore}.
 * <p>
 * Warning: must be re-implemented when having multiple server instances to e.g. S3. This implementation
 * can continue to be used in Self-Host deployments.
 */
public class DiskLlmMemoryStore implements LlmMemoryStore {

    public interface Config {
        @DefaultValue("true")
        boolean persistent();

        @DefaultValue("/opt/clearflask/db")
        String dbFileLocation();

        @DefaultValue("clearflask-llm-memory-store.db")
        String dbFileName();
    }

    @Inject
    private Config config;

    private DB db;
    private Map<Integer, String> map;

    @Inject
    private void setup() {
        db = (config.persistent()
                ? DBMaker.fileDB(Path.of(config.dbFileLocation(), config.dbFileName()).toFile())
                : DBMaker.memoryDB())
                .transactionEnable()
                .make();
        map = db.hashMap("messages", INTEGER, STRING).createOrOpen();
    }

    @Override
    public List<ChatMessage> getMessages(Object memoryId) {
        String json = map.get((int) memoryId);
        return messagesFromJson(json);
    }

    @Override
    public void updateMessages(Object memoryId, List<ChatMessage> messages) {
        String json = messagesToJson(messages);
        map.put((int) memoryId, json);
        db.commit();
    }

    @Override
    public void deleteMessages(Object memoryId) {
        map.remove((int) memoryId);
        db.commit();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(LlmMemoryStore.class).to(DiskLlmMemoryStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(DiskLlmMemoryStore.Config.class));
            }
        };
    }
}
