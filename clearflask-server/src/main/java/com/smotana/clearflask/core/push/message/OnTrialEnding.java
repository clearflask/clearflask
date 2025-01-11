// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.billing.PlanStore;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Slf4j
@Singleton
public class OnTrialEnding {

    public interface Config {
        @DefaultValue("Free Trial Ending – Subscribe Now")
        String subjectTemplate();

        @DefaultValue("<p>Hi __NAME__,</p>"
                + "<p>Your free trial of ClearFlask __PLAN_NAME__ is coming to an end on __TRIAL_END_DATE__.</p>"
                + "<p>Upgrade now to continue to use ClearFlask.</p>"
                + "<p><b>Need Assistance or considering a different ClearFlask Solution?</b> We’d love to help — reply to this email to get in touch with us.</p>"
                + "<p>ClearFlask Team</p>")
        String contentHtml();

        @DefaultValue("Hi __NAME__,"
                + "\n\nYour free trial of ClearFlask __PLAN_NAME__ is coming to an end on __TRIAL_END_DATE__."
                + "\n\nUpgrade now to continue to use ClearFlask."
                + "\n\nNeed Assistance or considering a different ClearFlask Solution? We’d love to help — reply to this email to get in touch with us."
                + "\n\nClearFlask Team")
        String contentText();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;
    @Inject
    private PlanStore planStore;

    public Email email(Account account, String link, Instant trialEnd) {

        String subject = config.subjectTemplate();
        String contentHtml = config.contentHtml();
        String contentText = config.contentText();

        String nameSanitized = emailTemplates.sanitize(account.getName());
        contentHtml = contentHtml.replace("__NAME__", nameSanitized);
        contentText = contentText.replace("__NAME__", nameSanitized);

        String planName = planStore.prettifyPlanName(account.getPlanid());
        contentHtml = contentHtml.replace("__PLAN_NAME__", planName);
        contentText = contentText.replace("__PLAN_NAME__", planName);

        String trialEndStr = trialEnd.atZone(ZoneId.of(configApp.zoneId()))
                .format(DateTimeFormatter.ofPattern("MMM d"));
        contentHtml = contentHtml.replace("__TRIAL_END_DATE__", trialEndStr);
        contentText = contentText.replace("__TRIAL_END_DATE__", trialEndStr);

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
                "TRIAL_ENDING"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnTrialEnding.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
