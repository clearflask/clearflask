// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.common.base.Charsets;
import com.google.common.io.Resources;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
@Singleton
@Getter
public class EmailTemplates {

    private final String notificationNoUnsubTemplateHtml;
    private final String notificationNoUnsubTemplateText;
    private final String notificationTemplateHtml;
    private final String notificationTemplateText;
    private final String verificationTemplateHtml;
    private final String verificationTemplateText;
    private final String loginTemplateHtml;
    private final String loginTemplateText;

    public EmailTemplates() throws IOException {
        this.notificationNoUnsubTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notificationNoUnsub.html"), Charsets.UTF_8);
        this.notificationNoUnsubTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notificationNoUnsub.txt"), Charsets.UTF_8);
        this.notificationTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notification.html"), Charsets.UTF_8);
        this.notificationTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notification.txt"), Charsets.UTF_8);
        this.verificationTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailVerify.html"), Charsets.UTF_8);
        this.verificationTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailVerify.txt"), Charsets.UTF_8);
        this.loginTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailLogin.html"), Charsets.UTF_8);
        this.loginTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailLogin.txt"), Charsets.UTF_8);
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
