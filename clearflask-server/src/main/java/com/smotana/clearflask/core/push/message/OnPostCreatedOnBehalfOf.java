// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.core.push.provider.BrowserPushService.BrowserPush;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.util.ProjectUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.core.push.NotificationServiceImpl.AUTH_TOKEN_PARAM_NAME;

@Slf4j
@Singleton
public class OnPostCreatedOnBehalfOf {

    public interface Config {
        @DefaultValue("A post has been created for you in __project_name__")
        String subjectTemplate();

        @DefaultValue("A post titled '__title__' has been created on your behalf in __project_name__.")
        String contentTemplate();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailTemplates emailTemplates;
    @Inject
    private ProjectUtil projectUtil;

    private String replaceTemplateVariables(String template, ConfigAdmin configAdmin, IdeaModel idea, int titleLength) {
        String projectName = emailTemplates.sanitize(projectUtil.getProjectName(configAdmin));
        String title = StringUtils.abbreviate(emailTemplates.sanitize(idea.getTitle()), titleLength);
        return template.replace("__project_name__", projectName)
                .replace("__title__", title);
    }

    public Email email(ConfigAdmin configAdmin, UserModel author, IdeaModel idea, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(author.getEmail()));

        String subject = replaceTemplateVariables(config.subjectTemplate(), configAdmin, idea, 50);

        // For email content, we need to wrap the title in bold HTML tags
        String projectName = emailTemplates.sanitize(projectUtil.getProjectName(configAdmin));
        String title = StringUtils.abbreviate(emailTemplates.sanitize(idea.getTitle()), 50);
        String content = config.contentTemplate()
                .replace("__project_name__", projectName)
                .replace("__title__", "<span style=\"font-weight: bold\">" + title + "</span>");

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content.replace("<span style=\"font-weight: bold\">", "").replace("</span>", ""));

        templateHtml = templateHtml.replace("__BUTTON_TEXT__", "VIEW POST");
        templateText = templateText.replace("__BUTTON_TEXT__", "VIEW POST");

        link += "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replace("__BUTTON_URL__", link);
        templateText = templateText.replace("__BUTTON_URL__", link);

        String unsubscribeLink = "https://" + ProjectStore.Project.getHostname(configAdmin, configApp) + "/account?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replace("__UNSUBSCRIBE_URL__", unsubscribeLink);
        templateText = templateText.replace("__UNSUBSCRIBE_URL__", unsubscribeLink);

        return new Email(
                author.getEmail(),
                subject,
                templateHtml,
                templateText,
                configAdmin.getProjectId(),
                "POST_CREATED_ON_BEHALF"
        );
    }

    public BrowserPush browserPush(ConfigAdmin configAdmin, UserModel author, IdeaModel idea, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(author.getBrowserPushToken()));

        String subject = replaceTemplateVariables(config.subjectTemplate(), configAdmin, idea, 50);
        String content = replaceTemplateVariables(config.contentTemplate(), configAdmin, idea, 50);

        return new BrowserPush(
                author.getBrowserPushToken(),
                subject,
                content,
                configAdmin.getProjectId(),
                author.getUserId(),
                link + "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken
        );
    }

    public String inAppDescription(ConfigAdmin configAdmin, IdeaModel idea) {
        // In-app notifications use a shorter title (20 chars) due to UI constraints
        return replaceTemplateVariables(config.subjectTemplate(), configAdmin, idea, 20);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnPostCreatedOnBehalfOf.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
