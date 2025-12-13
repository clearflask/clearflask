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

@Slf4j
@Singleton
public class OnTrialEnded {

    public interface Config {
        @DefaultValue("Free Trial Ended – Subscribe Now")
        String subjectTemplateTrialEnded();

        @DefaultValue("<p>Hi __NAME__,</p>"
                + "<p>Your free trial of ClearFlask __PLAN_NAME__ has ended. Please enter payment information to continue your plan.</p>"
                + "<p><b>Need Assistance or considering a different ClearFlask Solution?</b> We’d love to help — reply to this email to get in touch with us.</p>"
                + "<p>ClearFlask Team</p>")
        String contentTemplateTrialEndedHtml();

        @DefaultValue("Hi __NAME__,"
                + "\n\nYour free trial of ClearFlask __PLAN_NAME__ has ended. Please enter payment information to continue your plan."
                + "\n\nNeed Assistance or considering a different ClearFlask Solution? We’d love to help — reply to this email to get in touch with us."
                + "\n\nThanks and we hope you’ll continue!"
                + "\n\nClearFlask Team")
        String contentTemplateTrialEndedText();

        @DefaultValue("Billing starting - Thank you")
        String subjectTemplateBillingStarts();

        @DefaultValue("<p>Hi __NAME__,</p>"
                + "<p>Your trial has ended. Your billing will start shortly.</p>"
                + "<p><b>Need Assistance?</b> We’d love to help — reply to this email to get in touch with us.</p>"
                + "<p>Thanks and we hope it’s going well!</p>"
                + "<p>ClearFlask Team</p>")
        String contentTemplateBillingStartsHtml();

        @DefaultValue("Hi __NAME__,"
                + "\n\nYour trial has ended. Your billing will start shortly."
                + "\n\nNeed Assistance? We’d love to help — reply to this email to get in touch with us."
                + "\n\nThanks and we hope it’s going well!"
                + "\n\nClearFlask Team")
        String contentTemplateBillingStartsText();
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

    public Email email(Account account, String link, boolean hasPaymentMethod) {

        String subject = config.subjectTemplateTrialEnded();
        String contentHtml = hasPaymentMethod
                ? config.contentTemplateBillingStartsHtml()
                : config.contentTemplateTrialEndedHtml();
        String contentText = hasPaymentMethod
                ? config.contentTemplateBillingStartsText()
                : config.contentTemplateTrialEndedText();

        String nameSanitized = emailTemplates.sanitize(account.getName());
        contentHtml = contentHtml.replace("__NAME__", nameSanitized);
        contentText = contentText.replace("__NAME__", nameSanitized);

        String planName = planStore.prettifyPlanName(account.getPlanid());
        contentHtml = contentHtml.replace("__PLAN_NAME__", planName);
        contentText = contentText.replace("__PLAN_NAME__", planName);

        String templateHtml = emailTemplates.getNotificationNoUnsubLargeTemplateHtml();
        String templateText = emailTemplates.getNotificationNoUnsubTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", contentHtml);
        templateText = templateText.replace("__CONTENT__", contentText);

        String buttonText = hasPaymentMethod
                ? "Dashboard"
                : "Billing";
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
