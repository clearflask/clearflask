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
import com.smotana.clearflask.util.ProjectUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class EmailVerify {

    public interface Config {
        @DefaultValue("Verify your email")
        String subjectTemplate();

        @DefaultValue("If you did not make a request to create an account on __project_name__, please disregard. Otherwise, copy the following One Time Password (OTP) to complete signing up your account:")
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

    public Email email(ConfigAdmin configAdmin, String email, String token) {
        checkArgument(!Strings.isNullOrEmpty(email));

        String subject = config.subjectTemplate();
        String content = config.contentTemplate();

        String projectName = emailTemplates.sanitize(projectUtil.getProjectName(configAdmin));
        content = content.replace("__project_name__", projectName);

        String templateHtml = emailTemplates.getVerificationTemplateHtml();
        String templateText = emailTemplates.getVerificationTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        templateHtml = templateHtml.replace("__TOKEN__", token);
        templateText = templateText.replace("__TOKEN__", token);

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
                bind(EmailVerify.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
