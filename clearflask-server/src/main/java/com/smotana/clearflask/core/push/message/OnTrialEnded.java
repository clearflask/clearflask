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
public class OnTrialEnded {

    public interface Config {
        @DefaultValue("Trial ended")
        String subjectTemplateTrialEnded();

        @DefaultValue("Billing starting")
        String subjectTemplateBillingStarts();

        @DefaultValue("Your trial has ended, add a payment method to continue.")
        String contentTemplateTrialEnded();

        @DefaultValue("Your trial has ended. Your billing will start shortly.")
        String contentTemplateBillingStarts();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(String link, String accountId, String accountEmail, boolean hasPaymentMethod) {
        checkArgument(!Strings.isNullOrEmpty(accountEmail));

        String subject = config.subjectTemplateTrialEnded();
        String content = hasPaymentMethod ? config.contentTemplateBillingStarts() : config.contentTemplateTrialEnded();

        String templateHtml = emailTemplates.getNotificationNoUnsubTemplateHtml();
        String templateText = emailTemplates.getNotificationNoUnsubTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        String buttonText = hasPaymentMethod ? "Dashboard" : "Billing";
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
                "TRIAL_ENDED"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnTrialEnded.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
