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
        String subjectTemplate();

        @DefaultValue("Your trial period has ended. Your billing will start now.")
        String contentNoActionTemplate();

        @DefaultValue("If you enjoyed our service, please add a payment method to continue using it.")
        String contentNoPaymentTemplate();
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

        String subject = config.subjectTemplate();
        String content = hasPaymentMethod ? config.contentNoActionTemplate() : config.contentNoPaymentTemplate();

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replaceAll("__CONTENT__", content);
        templateText = templateText.replaceAll("__CONTENT__", content);

        String buttonText = "Billing";
        templateHtml = templateHtml.replaceAll("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replaceAll("__BUTTON_TEXT__", buttonText);

        templateHtml = templateHtml.replaceAll("__BUTTON_URL__", link);
        templateText = templateText.replaceAll("__BUTTON_URL__", link);

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
