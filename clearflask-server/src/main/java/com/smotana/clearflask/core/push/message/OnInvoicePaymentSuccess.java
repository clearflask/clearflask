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
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class OnInvoicePaymentSuccess {

    public interface Config {
        @DefaultValue("Invoice payment")
        String subjectTemplate();

        @DefaultValue("[Card expiring soon] Invoice payment")
        String subjectTemplateExpiring();

        @DefaultValue("Your payment has been received, thank you. ")
        String content();

        @DefaultValue("Your payment has been received, thank you.\n\nYour card is expiring soon, please update your billing details.")
        String contentExpiring();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(String link, String accountId, String accountEmail, boolean isCardExpiringSoon) {
        checkArgument(!Strings.isNullOrEmpty(accountEmail));

        String subject = isCardExpiringSoon ? config.subjectTemplateExpiring() : config.subjectTemplate();
        String content = isCardExpiringSoon ? config.contentExpiring() : config.content();

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        String buttonText = "See Invoice";
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
                "INVOICE_PAYMENT_SUCCESS"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnInvoicePaymentSuccess.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
