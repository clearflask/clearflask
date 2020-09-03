package com.smotana.clearflask.core.push.message;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.core.push.provider.BrowserPushService.BrowserPush;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.util.CreditViewUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.core.push.NotificationServiceImpl.AUTH_TOKEN_PARAM_NAME;

@Slf4j
@Singleton
public class OnCreditChange {

    public interface Config {
        @DefaultValue("You were __action_type__ __amount__'")
        String subjectTemplate();

        @DefaultValue("Your account balance was __action_type__ __amount__ with description: \"__summary__\"")
        String template();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(ConfigAdmin configAdmin, UserModel user, TransactionModel transaction, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(user.getEmail()));

        String subject = config.subjectTemplate();
        String content = config.template();

        subject = subject.replaceAll("__action_type__", transaction.getAmount() >= 0 ? "credited" : "debited");
        content = content.replaceAll("__action_type__", transaction.getAmount() >= 0 ? "credited" : "debited");

        String amountFormatted = emailTemplates.sanitize(CreditViewUtil.creditView(transaction.getAmount(), configAdmin.getUsers().getCredits()));
        subject = subject.replaceAll("__amount__", amountFormatted);
        content = content.replaceAll("__amount__", amountFormatted);

        content = content.replaceAll("__summary__", emailTemplates.sanitize(transaction.getSummary()));

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replaceAll("__CONTENT__", content);
        templateText = templateText.replaceAll("__CONTENT__", content);

        templateHtml = templateHtml.replaceAll("__BUTTON_TEXT__", "VIEW BALANCE");
        templateText = templateText.replaceAll("__BUTTON_TEXT__", "VIEW BALANCE");

        link += "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replaceAll("__BUTTON_URL__", link);
        templateText = templateText.replaceAll("__BUTTON_URL__", link);

        String unsubscribeLink = "https://" + configAdmin.getSlug() + "." + configApp.domain() + "/account?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replaceAll("__UNSUBSCRIBE_URL__", unsubscribeLink);
        templateText = templateText.replaceAll("__UNSUBSCRIBE_URL__", unsubscribeLink);

        return new Email(
                user.getEmail(),
                subject,
                templateHtml,
                templateText,
                configAdmin.getProjectId(),
                "CREDIT_CHANGE"
        );
    }

    public BrowserPush browserPush(ConfigAdmin configAdmin, UserModel user, TransactionModel transaction, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(user.getBrowserPushToken()));

        String subject = config.subjectTemplate();
        String content = config.template();

        subject = subject.replaceAll("__action_type__", transaction.getAmount() >= 0 ? "credited" : "debited");
        content = content.replaceAll("__action_type__", transaction.getAmount() >= 0 ? "credited" : "debited");

        String amountFormatted = emailTemplates.sanitize(CreditViewUtil.creditView(transaction.getAmount(), configAdmin.getUsers().getCredits()));
        subject = subject.replaceAll("__amount__", amountFormatted);
        content = content.replaceAll("__amount__", amountFormatted);

        content = content.replaceAll("__summary__", emailTemplates.sanitize(transaction.getSummary()));

        return new BrowserPush(
                user.getBrowserPushToken(),
                subject,
                content,
                transaction.getProjectId(),
                user.getUserId(),
                link + "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken
        );
    }

    public String inAppDescription(ConfigAdmin configAdmin, UserModel user, TransactionModel transaction) {
        String subject = config.subjectTemplate();

        subject = subject.replaceAll("__action_type__", transaction.getAmount() >= 0 ? "credited" : "debited");

        String amountFormatted = CreditViewUtil.creditView(transaction.getAmount(), configAdmin.getUsers().getCredits());
        subject = subject.replaceAll("__amount__", amountFormatted + "");

        return subject;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnCreditChange.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
