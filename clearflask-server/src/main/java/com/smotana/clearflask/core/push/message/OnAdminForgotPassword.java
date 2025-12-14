// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@Singleton
public class OnAdminForgotPassword {

    public interface Config {
        @DefaultValue("Reset your password")
        String subjectTemplate();

        @DefaultValue("<p>Hi __NAME__,</p>"
                + "<p>We received a request to reset your ClearFlask password.</p>"
                + "<p>Click the button below to reset your password. This link will expire in 15 minutes.</p>"
                + "<p>If you didn't request this, you can safely ignore this email.</p>"
                + "<p>ClearFlask Team</p>")
        String contentHtml();

        @DefaultValue("Hi __NAME__,"
                + "\n\nWe received a request to reset your ClearFlask password."
                + "\n\nClick the link below to reset your password. This link will expire in 15 minutes."
                + "\n\nIf you didn't request this, you can safely ignore this email."
                + "\n\nClearFlask Team")
        String contentText();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(Account account, String link, String resetToken) {

        String subject = config.subjectTemplate();
        String contentHtml = config.contentHtml();
        String contentText = config.contentText();

        String nameSanitized = emailTemplates.sanitize(account.getName());
        contentHtml = contentHtml.replace("__NAME__", nameSanitized);
        contentText = contentText.replace("__NAME__", nameSanitized);

        String templateHtml = emailTemplates.getNotificationNoUnsubTemplateHtml();
        String templateText = emailTemplates.getNotificationNoUnsubTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", contentHtml);
        templateText = templateText.replace("__CONTENT__", contentText);

        String buttonText = "Reset Password";
        templateHtml = templateHtml.replace("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replace("__BUTTON_TEXT__", buttonText);

        String fullLink = link + "?token=" + URLEncoder.encode(resetToken, StandardCharsets.UTF_8);
        templateHtml = templateHtml.replace("__BUTTON_URL__", fullLink);
        templateText = templateText.replace("__BUTTON_URL__", fullLink);

        return new Email(
                account.getEmail(),
                subject,
                templateHtml,
                templateText,
                account.getAccountId(),
                "ADMIN_FORGOT_PASSWORD"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnAdminForgotPassword.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
