// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.io.Resources;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
@Singleton
@Getter
public class EmailTemplates {

    public interface Config {
        @DefaultValue("\\p{C}")
        String sanitizeRegex();
    }

    @Inject
    private Config config;

    private final String notificationNoUnsubTemplateHtml;
    private final String notificationNoUnsubTemplateText;
    private final String notificationTemplateHtml;
    private final String notificationTemplateText;
    private final String verificationTemplateHtml;
    private final String verificationTemplateText;
    private final String loginTemplateHtml;
    private final String loginTemplateText;
    private final String digestTemplateHtml;
    private final String digestProjectTemplateHtml;
    private final String digestProjectSectionTemplateHtml;
    private final String digestProjectSectionItemTemplateHtml;
    private final String digestTemplateText;
    private final String digestProjectTemplateText;
    private final String digestProjectSectionTemplateText;
    private final String digestProjectSectionItemTemplateText;

    public EmailTemplates() throws IOException {
        this.notificationNoUnsubTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notificationNoUnsub.html"), Charsets.UTF_8);
        this.notificationNoUnsubTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notificationNoUnsub.txt"), Charsets.UTF_8);
        this.notificationTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notification.html"), Charsets.UTF_8);
        this.notificationTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/notification.txt"), Charsets.UTF_8);
        this.verificationTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailVerify.html"), Charsets.UTF_8);
        this.verificationTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailVerify.txt"), Charsets.UTF_8);
        this.loginTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailLogin.html"), Charsets.UTF_8);
        this.loginTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/emailLogin.txt"), Charsets.UTF_8);
        this.digestTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/digest.html"), Charsets.UTF_8);
        this.digestProjectTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/digest-project.html"), Charsets.UTF_8);
        this.digestProjectSectionTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/digest-project-section.html"), Charsets.UTF_8);
        this.digestProjectSectionItemTemplateHtml = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/digest-project-section-item.html"), Charsets.UTF_8);
        this.digestTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/digest.txt"), Charsets.UTF_8);
        this.digestProjectTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/digest-project.txt"), Charsets.UTF_8);
        this.digestProjectSectionTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/digest-project-section.txt"), Charsets.UTF_8);
        this.digestProjectSectionItemTemplateText = Resources.toString(Thread.currentThread().getContextClassLoader().getResource("email/digest-project-section-item.txt"), Charsets.UTF_8);
    }

    public String sanitize(String input) {
        return Strings.nullToEmpty(input).replaceAll(config.sanitizeRegex(), "");
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(EmailTemplates.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
