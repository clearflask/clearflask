package com.smotana.clearflask.core.push;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.IdeaStore;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class NotificationServiceImpl implements NotificationService {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();
    }

    @Inject
    private Config config;
    @Inject
    private MultiPushProvider pushProvider;


    @Override
    public void onStatusOrResponseChanged(IdeaStore.IdeaModel idea, boolean statusChanged, boolean responseChanged) {
        if (!config.enabled()) {
            return;
        }
        //"An idea you are subscribed to, %s, has changed status to %s"
        // TODO add subscribers to idea
        // TODO
    }

    @Override
    public void onCommentReply(IdeaStore.IdeaModel idea) {
        if (!config.enabled()) {
            return;
        }
        // TODO
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(NotificationService.class).to(NotificationServiceImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
