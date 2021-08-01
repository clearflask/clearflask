// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.core.push.message;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.IdeaStatus;
import com.smotana.clearflask.core.push.provider.BrowserPushService.BrowserPush;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;

import java.util.Optional;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.core.push.NotificationServiceImpl.AUTH_TOKEN_PARAM_NAME;

@Slf4j
@Singleton
public class OnStatusOrResponseChange {

    public enum SubscriptionAction {
        FUNDED("voted on"),
        VOTED("funded"),
        EXPRESSED("reacted to");

        private final String actionString;

        SubscriptionAction(String actionString) {
            this.actionString = actionString;
        }

        public String getActionString() {
            return actionString;
        }
    }

    public interface Config {
        @DefaultValue("'__title__' marked __status__")
        String statusChangedSubjectTemplate();

        @DefaultValue("A post you __subscription_action__, __title__ is marked __status__")
        String statusChangedTemplate();

        @DefaultValue("'__title__' has a response")
        String responseSubjectTemplate();

        @DefaultValue("A post you __subscription_action__, __title__ has a new response __response__")
        String responseTemplate();

        @DefaultValue("'__title__' marked __status__ with a response")
        String statusChangeAndResponseSubjectTemplate();

        @DefaultValue("A post you __subscription_action__, __title__ is marked __status__ with a response __response__")
        String statusChangeAndResponseTemplate();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(UserModel user, IdeaModel idea, ConfigAdmin configAdmin, SubscriptionAction subscriptionAction, String link, Optional<IdeaStatus> changedStatus, Optional<String> changedResponse, String authToken) {
        checkArgument(changedStatus.isPresent() || changedResponse.isPresent());
        checkArgument(!Strings.isNullOrEmpty(user.getEmail()));

        String type;
        String subject;
        String content;
        if (!changedStatus.isPresent()) {
            content = config.responseTemplate();
            subject = config.responseSubjectTemplate();
            type = "RESPONSE_CHANGED";
        } else if (!changedResponse.isPresent()) {
            content = config.statusChangedTemplate();
            subject = config.statusChangedSubjectTemplate();
            type = "STATUS_CHANGED";
        } else {
            content = config.statusChangeAndResponseTemplate();
            subject = config.statusChangeAndResponseSubjectTemplate();
            type = "RESPONSE_AND_STATUS_CHANGED";
        }

        content = content.replace("__subscription_action__", subscriptionAction.getActionString());

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        String title = StringUtils.abbreviate(emailTemplates.sanitize(idea.getTitle()), 50);
        templateHtml = templateHtml.replace("__title__",
                "<span style=\"font-weight: bold\">" +
                        title +
                        "</span>");
        templateText = templateText.replace("__title__", title);
        title = StringUtils.abbreviate(title, 20);
        subject = subject.replace("__title__", title);

        if (changedStatus.isPresent()) {
            String statusName = StringUtils.abbreviate(emailTemplates.sanitize(changedStatus.get().getName()), 50);
            if (statusName.isEmpty()) {
                statusName = "unknown";
            }
            templateHtml = templateHtml.replace("__status__",
                    "<span style=\"color: " + changedStatus.get().getColor() + ";font-weight: bold\">" +
                            statusName +
                            "</span>");
            templateText = templateText.replace("__status__", statusName);
            statusName = StringUtils.abbreviate(statusName, 15);
            subject = subject.replace("__status__", statusName);
        }

        if (changedResponse.isPresent()) {
            String response = StringUtils.abbreviate(emailTemplates.sanitize(changedResponse.get()), 50);
            templateHtml = templateHtml.replace("__response__",
                    "<span style=\"font-weight: bold\">" +
                            response +
                            "</span>");
            templateText = templateText.replace("__response__", response);
        }

        templateHtml = templateHtml.replace("__BUTTON_TEXT__", "VIEW POST");
        templateText = templateText.replace("__BUTTON_TEXT__", "VIEW POST");

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
                type
        );
    }

    public BrowserPush browserPush(UserModel user, IdeaModel idea, ConfigAdmin configAdmin, SubscriptionAction subscriptionAction, String link, Optional<IdeaStatus> changedStatus, Optional<String> changedResponse, String authToken) {
        checkArgument(changedStatus.isPresent() || changedResponse.isPresent());
        checkArgument(!Strings.isNullOrEmpty(user.getBrowserPushToken()));

        String subject;
        if (!changedStatus.isPresent()) {
            subject = config.responseSubjectTemplate();
        } else if (!changedResponse.isPresent()) {
            subject = config.statusChangedSubjectTemplate();
        } else {
            subject = config.statusChangeAndResponseSubjectTemplate();
        }

        String content = "";
        if (changedResponse.isPresent()) {
            String response = StringUtils.abbreviate(emailTemplates.sanitize(changedResponse.get()), 65);
            content = content.replace("__response__", response);
        }

        if (changedStatus.isPresent()) {
            String statusName = StringUtils.abbreviate(emailTemplates.sanitize(changedStatus.get().getName()), 15);
            if (statusName.isEmpty()) {
                statusName = "unknown";
            }
            subject = subject.replace("__status__", statusName);
        }

        String title = StringUtils.abbreviate(emailTemplates.sanitize(idea.getTitle()), 50);
        content = content.replace("__title__", title);
        title = StringUtils.abbreviate(title, 20);
        subject = subject.replace("__title__", title);

        return new BrowserPush(
                user.getBrowserPushToken(),
                subject,
                content,
                configAdmin.getProjectId(),
                user.getUserId(),
                link + "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken
        );
    }

    public String inAppDescription(UserModel user, IdeaModel idea, ConfigAdmin configAdmin, SubscriptionAction subscriptionAction, String link, Optional<IdeaStatus> changedStatus, Optional<String> changedResponse) {
        checkArgument(changedStatus.isPresent() || changedResponse.isPresent());

        String subject;
        if (!changedStatus.isPresent()) {
            subject = config.responseSubjectTemplate();
        } else if (!changedResponse.isPresent()) {
            subject = config.statusChangedSubjectTemplate();
        } else {
            subject = config.statusChangeAndResponseSubjectTemplate();
        }

        if (changedStatus.isPresent()) {
            String statusName = StringUtils.abbreviate(emailTemplates.sanitize(changedStatus.get().getName()), 15);
            if (statusName.isEmpty()) {
                statusName = "unknown";
            }
            subject = subject.replace("__status__", statusName);
        }

        String title = StringUtils.abbreviate(emailTemplates.sanitize(idea.getTitle()), 20);
        subject = subject.replace("__title__", title);

        return subject;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnStatusOrResponseChange.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
