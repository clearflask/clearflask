package com.smotana.clearflask.core.push.provider;

import com.google.common.collect.Queues;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import java.util.concurrent.BlockingQueue;

@Slf4j
@Singleton
public class MockEmailService implements EmailService {

    public final BlockingQueue<Email> sent = Queues.newLinkedBlockingDeque();

    @Override
    public void send(Email email) {
        log.info("Send {}", email);
        this.sent.add(email);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(EmailService.class).to(MockEmailService.class).asEagerSingleton();
            }
        };
    }
}
