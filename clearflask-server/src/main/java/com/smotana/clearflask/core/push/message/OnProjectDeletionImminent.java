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

@Slf4j
@Singleton
public class OnProjectDeletionImminent {

    public interface Config {
        @DefaultValue("Account deletion imminent")
        String subjectTemplate();

        @DefaultValue("<p>Hi __NAME__,</p>"
                + "<p>We are sad to see you go and we just wanted to let you know we will be deleting your projects soon unless you take action.</p>"
                + "<p>Please complete setting up your billing if you wish to continue to use ClearFlask.</p>"
                + "<p><b>Need Assistance or considering a different ClearFlask Solution?</b> We’d love to help — reply to this email to get in touch with us.</p>"
                + "<p>ClearFlask Team</p>")
        String contentHtml();

        @DefaultValue("Hi __NAME__,"
                + "<p>We are sad to see you go and we just wanted to let you know we will be deleting your projects soon unless you take action.</p>"
                + "<p>Please complete setting up your billing if you wish to continue to use ClearFlask.</p>"
                + "\n\nNeed Assistance or considering a different ClearFlask Solution? We’d love to help — reply to this email to get in touch with us."
                + "\n\nClearFlask Team")
        String contentText();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(Account account, String link) {

        String subject = config.subjectTemplate();
        String contentHtml = config.contentHtml();
        String contentText = config.contentText();

        String nameSanitized = emailTemplates.sanitize(account.getName());
        contentHtml = contentHtml.replace("__NAME__", nameSanitized);
        contentText = contentText.replace("__NAME__", nameSanitized);

        String templateHtml = emailTemplates.getNotificationNoUnsubLargeTemplateHtml();
        String templateText = emailTemplates.getNotificationNoUnsubTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", contentHtml);
        templateText = templateText.replace("__CONTENT__", contentText);

        String buttonText = "Billing";
        templateHtml = templateHtml.replace("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replace("__BUTTON_TEXT__", buttonText);

        templateHtml = templateHtml.replace("__BUTTON_URL__", link);
        templateText = templateText.replace("__BUTTON_URL__", link);

        return new Email(
                account.getEmail(),
                subject,
                templateHtml,
                templateText,
                account.getAccountId(),
                "PROJECT_DELETION_IMMINENT"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnProjectDeletionImminent.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
