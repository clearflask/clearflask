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
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.core.push.NotificationServiceImpl.AUTH_TOKEN_PARAM_NAME;

@Slf4j
@Singleton
public class EmailLogin {

    public interface Config {
        @DefaultValue("Login attempt")
        String subjectTemplate();

        @DefaultValue("If you did not make a request to login to __project_name__, please disregard. Otherwise, copy the following One Time Password (OTP) to complete logging in or click the link below:")
        String contentTemplate();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(ConfigAdmin configAdmin, String email, String token, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(email));

        String subject = config.subjectTemplate();
        String content = config.contentTemplate();

        String projectName = emailTemplates.sanitize(configAdmin.getName());
        content = content.replace("__project_name__", projectName);

        String templateHtml = emailTemplates.getLoginTemplateHtml();
        String templateText = emailTemplates.getLoginTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        templateHtml = templateHtml.replace("__TOKEN__", token);
        templateText = templateText.replace("__TOKEN__", token);

        String buttonText = "Login";
        templateHtml = templateHtml.replace("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replace("__BUTTON_TEXT__", buttonText);

        link += "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replace("__BUTTON_URL__", link);
        templateText = templateText.replace("__BUTTON_URL__", link);

        return new Email(
                email,
                subject,
                templateHtml,
                templateText,
                configAdmin.getProjectId(),
                "EMAIL_VERIFY"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(EmailLogin.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
