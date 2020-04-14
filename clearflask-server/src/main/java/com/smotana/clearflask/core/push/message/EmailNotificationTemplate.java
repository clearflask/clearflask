package com.smotana.clearflask.core.push.message;

import com.google.common.base.Charsets;
import com.google.common.io.Resources;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
@Singleton
public class EmailNotificationTemplate {

    private final String notificationTemplateHtml;
    private final String notificationTemplateText;

    public EmailNotificationTemplate() throws IOException {
        this.notificationTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notification.html"), Charsets.UTF_8);
        this.notificationTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notification.txt"), Charsets.UTF_8);
    }

    public String getNotificationTemplateHtml() {
        return notificationTemplateHtml;
    }

    public String getNotificationTemplateText() {
        return notificationTemplateText;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(EmailNotificationTemplate.class).asEagerSingleton();
            }
        };
    }
}
