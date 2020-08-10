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
public class EmailTemplates {

    private final String notificationTemplateHtml;
    private final String notificationTemplateText;
    private final String verificationTemplateHtml;
    private final String verificationTemplateText;

    public EmailTemplates() throws IOException {
        this.notificationTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notification.html"), Charsets.UTF_8);
        this.notificationTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notification.txt"), Charsets.UTF_8);
        this.verificationTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailVerify.html"), Charsets.UTF_8);
        this.verificationTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailVerify.txt"), Charsets.UTF_8);
    }

    public String getNotificationTemplateHtml() {
        return notificationTemplateHtml;
    }

    public String getNotificationTemplateText() {
        return notificationTemplateText;
    }

    public String getVerificationTemplateHtml() {
        return verificationTemplateHtml;
    }

    public String getVerificationTemplateText() {
        return verificationTemplateText;
    }

    public String sanitize(String input) {
        return input.replaceAll("[^A-Za-z0-9 ]+", "");
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(EmailTemplates.class).asEagerSingleton();
            }
        };
    }
}
