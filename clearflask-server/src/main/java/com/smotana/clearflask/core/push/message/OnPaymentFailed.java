// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class OnPaymentFailed {

    public interface Config {
        @DefaultValue("Payment failure")
        String subjectTemplate();

        @DefaultValue("Your payment of $__AMOUNT__ has failed. ")
        String content();

        @DefaultValue("Please update your billing details")
        String generalFailure();

        @DefaultValue("You are asked for additional information from your provider")
        String actionRequired();

        @DefaultValue("Please add a payment method.")
        String noPaymentMethod();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(String link, String accountId, String accountEmail, long amount, boolean requiresAction, boolean hasPaymentMethod) {
        checkArgument(!Strings.isNullOrEmpty(accountEmail));

        String subject = config.subjectTemplate();
        String content = config.content();
        if (!hasPaymentMethod) {
            content += config.noPaymentMethod();
        } else if (requiresAction) {
            content += config.actionRequired();
        } else {
            content += config.generalFailure();
        }
        content = content.replace("__AMOUNT__", Long.toString(amount));

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        String buttonText = "Billing";
        templateHtml = templateHtml.replace("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replace("__BUTTON_TEXT__", buttonText);

        templateHtml = templateHtml.replace("__BUTTON_URL__", link);
        templateText = templateText.replace("__BUTTON_URL__", link);

        return new Email(
                accountEmail,
                subject,
                templateHtml,
                templateText,
                accountId,
                "PAYMENT_FAILURE"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnPaymentFailed.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
