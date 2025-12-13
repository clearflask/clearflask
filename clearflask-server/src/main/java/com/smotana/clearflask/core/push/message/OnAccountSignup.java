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
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.AccountStore.Account;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class OnAccountSignup {

    public interface Config {
        @DefaultValue("__NAME__ welcome to ClearFlask")
        String subject();

        @DefaultValue("<p>Hello __NAME__,</p>"
                + "<p>Thank you for signing up for the __PLAN_NAME__!</p>"
                + "<p>Here’s some helpful tips to help you get the most out of ClearFlask:</p>"
                + "<ul>"
                + "<li>Share a link to ClearFlask with your users and watch the new ideas roll in!</li>"
                + "<li>Start setting up your Product Roadmap and let your users see what you're up to.</li>"
                + "<li>Turn on email notifications so you don’t miss important feedback, or wait for the weekly summary digest email.</li>"
                + "</ul>"
                + "<p>If you have any questions or need assistance at any time, simply reply to this email to get in touch.</p>")
        String contentHtml();

        @DefaultValue("Hello __NAME__,\n\n"
                + "Thank you for signing up for the __PLAN_NAME__!\n"
                + "Here’s some helpful tips to help you get the most out of ClearFlask:\n\n"
                + " - Share a link to ClearFlask with your users and watch the new ideas roll in!\n"
                + " - Start setting up your Product Roadmap and let your users see what you're up to.\n"
                + " - Turn on email notifications so you don’t miss important feedback, or wait for the weekly summary digest email.\n"
                + "\nIf you have any questions or need assistance at any time, simply reply to this email to get in touch.")
        String contentText();
    }

    @Inject
    private Config config;
    @Inject
    private EmailTemplates emailTemplates;
    @Inject
    private PlanStore planStore;

    public Email email(Account account, String link) {
        checkArgument(!Strings.isNullOrEmpty(account.getEmail()));

        String subject = config.subject();
        String contentHtml = config.contentHtml();
        String contentText = config.contentText();
        String nameSanitized = emailTemplates.sanitize(account.getName());
        String planName = planStore.prettifyPlanName(account.getPlanid());
        subject = subject.replace("__NAME__", nameSanitized);
        contentHtml = contentHtml.replace("__NAME__", nameSanitized)
                .replace("__PLAN_NAME__", planName);
        contentText = contentText.replace("__NAME__", nameSanitized)
                .replace("__PLAN_NAME__", planName);

        String templateHtml = emailTemplates.getNotificationNoUnsubLargeTemplateHtml();
        String templateText = emailTemplates.getNotificationNoUnsubTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", contentHtml);
        templateText = templateText.replace("__CONTENT__", contentText);

        String buttonText = "Dashboard";
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
                "ACCOUNT_SIGNUP"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnAccountSignup.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
