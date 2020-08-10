package com.smotana.clearflask.core.push.message;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.core.push.NotificationServiceImpl.AUTH_TOKEN_PARAM_NAME;

@Slf4j
@Singleton
public class OnAdminInvite {

    public interface Config {
        @DefaultValue("You are invited as a moderator of __project_name__")
        String subjectTemplate();

        @DefaultValue("You have been invited to join the __project_name__ project as a Moderator. Click the link below to setup your account.")
        String contentTemplate();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(ConfigAdmin configAdmin, UserModel user, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(user.getEmail()));

        String subject = config.subjectTemplate();
        String content = config.contentTemplate();

        String projectName = emailTemplates.sanitize(configAdmin.getName());
        subject = subject.replaceAll("__project_name__", projectName);
        content = content.replaceAll("__project_name__", projectName);

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replaceAll("__CONTENT__", content);
        templateText = templateText.replaceAll("__CONTENT__", content);

        String buttonText = "Account settings";
        templateHtml = templateHtml.replaceAll("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replaceAll("__BUTTON_TEXT__", buttonText);

        link += "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replaceAll("__BUTTON_URL__", link);
        templateText = templateText.replaceAll("__BUTTON_URL__", link);

        String unsubscribeLink = "https://" + configAdmin.getSlug() + "." + configApp.domain() + "/account?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replaceAll("__UNSUBSCRIBE_URL__", unsubscribeLink);
        templateText = templateText.replaceAll("__UNSUBSCRIBE_URL__", unsubscribeLink);

        return new Email(
                user.getEmail(),
                subject,
                templateHtml,
                templateText,
                configAdmin.getProjectId(),
                "FORGOT_PASSWORD"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnAdminInvite.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
