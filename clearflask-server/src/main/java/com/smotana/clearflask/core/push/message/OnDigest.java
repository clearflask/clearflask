// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.push.NotificationService.Digest;
import com.smotana.clearflask.core.push.NotificationService.DigestItem;
import com.smotana.clearflask.core.push.NotificationService.DigestProject;
import com.smotana.clearflask.core.push.NotificationService.DigestSection;
import com.smotana.clearflask.core.push.NotificationServiceImpl;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;

import static com.smotana.clearflask.core.push.NotificationServiceImpl.AUTH_TOKEN_PARAM_NAME;

@Slf4j
@Singleton
public class OnDigest {

    public interface Config {
        @DefaultValue("Weekly Digest for __PROJECT_NAMES__: __DATE_RANGE__")
        String subjectTemplate();
    }

    @Inject
    private Config config;
    @Inject
    private NotificationServiceImpl.Config configNotificationService;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(Account account, Digest digest) {
        String subject = config.subjectTemplate()
                .replace("__PROJECT_NAMES__", digest.getProjects().stream()
                        .map(DigestProject::getName)
                        .map(emailTemplates::sanitize)
                        // Delimited by commas
                        .reduce((a, b) -> a + ", " + b)
                        // Max length otherwise ...
                        .map(projectNames -> StringUtils.abbreviate(
                                projectNames,
                                25))
                        .orElse("ClearFlask"))
                .replace("__DATE_RANGE__", digest.getFrom() + " - " + digest.getTo());

        StringBuilder projectsHtml = new StringBuilder();
        StringBuilder projectsText = new StringBuilder();
        for (DigestProject digestProject : digest.getProjects()) {
            String authToken = userStore.createToken(digestProject.getAuthor().getProjectId(), digestProject.getAuthor().getUserId(), configNotificationService.autoLoginExpiry());
            StringBuilder sectionsHtml = new StringBuilder();
            StringBuilder sectionsText = new StringBuilder();
            for (DigestSection digestSection : digestProject.getSections()) {
                StringBuilder itemsHtml = new StringBuilder();
                StringBuilder itemsText = new StringBuilder();
                for (DigestItem digestItem : digestSection.getItems()) {
                    itemsHtml.append(emailTemplates.getDigestProjectSectionItemTemplateHtml()
                            .replace("__ITEM_TEXT__", emailTemplates.sanitize(digestItem.getText()))
                            .replace("__ITEM_LINK__", digestItem.getLink() + "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken));
                    itemsText.append(emailTemplates.getDigestProjectSectionItemTemplateText()
                            .replace("__ITEM_TEXT__", emailTemplates.sanitize(digestItem.getText()))
                            .replace("__ITEM_LINK__", digestItem.getLink() + "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken));
                }
                sectionsHtml.append(emailTemplates.getDigestProjectSectionTemplateHtml()
                        .replace("__SECTION_NAME__", emailTemplates.sanitize(digestSection.getSectionName()))
                        .replace("__ITEMS__", itemsHtml.toString()));
                sectionsText.append(emailTemplates.getDigestProjectSectionTemplateText()
                        .replace("__SECTION_NAME__", emailTemplates.sanitize(digestSection.getSectionName()))
                        .replace("__ITEMS__", itemsText.toString()));
            }
            projectsHtml.append(emailTemplates.getDigestProjectTemplateHtml()
                    .replace("__PROJECT_NAME__", emailTemplates.sanitize(digestProject.getName()))
                    .replace("__PROJECT_LINK__", digestProject.getLink())
                    .replace("__SECTIONS__", sectionsHtml.toString()));
            projectsText.append(emailTemplates.getDigestProjectTemplateText()
                    .replace("__PROJECT_NAME__", emailTemplates.sanitize(digestProject.getName()))
                    .replace("__PROJECT_LINK__", digestProject.getLink())
                    .replace("__SECTIONS__", sectionsText.toString()));
        }

        String unsubscribeLink = "https://" + configApp.domain() + "/dashboard/settings/account/notifications";
        String templateHtml = emailTemplates.getDigestTemplateHtml()
                .replace("__FROM__", digest.getFrom())
                .replace("__TO__", digest.getTo())
                .replace("__PROJECTS__", projectsHtml.toString())
                .replace("__UNSUBSCRIBE_LINK__", unsubscribeLink);
        String templateText = emailTemplates.getDigestTemplateText()
                .replace("__FROM__", digest.getFrom())
                .replace("__TO__", digest.getTo())
                .replace("__PROJECTS__", projectsText.toString())
                .replace("__UNSUBSCRIBE_LINK__", unsubscribeLink);

        return new Email(
                account.getEmail(),
                subject,
                templateHtml,
                templateText,
                account.getAccountId(),
                "WEEKLY_DIGEST"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnDigest.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
