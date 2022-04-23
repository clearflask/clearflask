// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.NotifySubscribers;
import com.smotana.clearflask.core.push.provider.BrowserPushService.BrowserPush;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.core.push.NotificationServiceImpl.AUTH_TOKEN_PARAM_NAME;

@Slf4j
@Singleton
public class OnPostCreated {
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(NotifySubscribers notifySubscribers, ConfigAdmin configAdmin, UserModel user, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(user.getEmail()));

        String subject = emailTemplates.sanitize(notifySubscribers.getTitle());
        String content = emailTemplates.sanitize(notifySubscribers.getBody());

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        templateHtml = templateHtml.replace("__BUTTON_TEXT__", "VIEW");
        templateText = templateText.replace("__BUTTON_TEXT__", "VIEW");

        link += "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replace("__BUTTON_URL__", link);
        templateText = templateText.replace("__BUTTON_URL__", link);

        String unsubscribeLink = "https://" + ProjectStore.Project.getHostname(configAdmin, configApp) + "/account?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replace("__UNSUBSCRIBE_URL__", unsubscribeLink);
        templateText = templateText.replace("__UNSUBSCRIBE_URL__", unsubscribeLink);

        return new Email(
                user.getEmail(),
                subject,
                templateHtml,
                templateText,
                configAdmin.getProjectId(),
                "POST_CREATED"
        );
    }

    public BrowserPush browserPush(NotifySubscribers notifySubscribers, ConfigAdmin configAdmin, UserModel user, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(user.getBrowserPushToken()));

        String subject = emailTemplates.sanitize(notifySubscribers.getTitle());
        String content = emailTemplates.sanitize(notifySubscribers.getBody());

        return new BrowserPush(
                user.getBrowserPushToken(),
                subject,
                content,
                configAdmin.getProjectId(),
                user.getUserId(),
                link + "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken
        );
    }

    public String inAppDescription(NotifySubscribers notifySubscribers, ConfigAdmin configAdmin, UserModel user) {
        String subject = emailTemplates.sanitize(notifySubscribers.getTitle());

        return subject;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnPostCreated.class).asEagerSingleton();
            }
        };
    }
}
