package com.smotana.clearflask.core.push.message;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class OnAccountSignup {

    public interface Config {
        @DefaultValue("Welcome to ClearFlask")
        String subject();

        @DefaultValue("Hello __NAME__, thank you for signing up with us. Visit the dashboard below to get started.")
        String content();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(Account account, String link) {
        checkArgument(!Strings.isNullOrEmpty(account.getEmail()));

        String subject = config.subject();
        String content = config.content();
        content = content.replaceAll("__NAME__", emailTemplates.sanitize(account.getName()));

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replaceAll("__CONTENT__", content);
        templateText = templateText.replaceAll("__CONTENT__", content);

        String buttonText = "Dashboard";
        templateHtml = templateHtml.replaceAll("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replaceAll("__BUTTON_TEXT__", buttonText);

        templateHtml = templateHtml.replaceAll("__BUTTON_URL__", link);
        templateText = templateText.replaceAll("__BUTTON_URL__", link);

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
