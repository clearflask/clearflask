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

        @DefaultValue("Hello __NAME__, thank you for signing up on the __PLAN_NAME__.")
        String content();
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
        String content = config.content();
        String nameSanitized = emailTemplates.sanitize(account.getName());
        String planName = planStore.prettifyPlanName(account.getPlanid());
        subject = subject.replace("__NAME__", nameSanitized);
        content = content.replace("__NAME__", nameSanitized)
                .replace("__PLAN_NAME__", planName);

        String templateHtml = emailTemplates.getNotificationNoUnsubTemplateHtml();
        String templateText = emailTemplates.getNotificationNoUnsubTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

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
