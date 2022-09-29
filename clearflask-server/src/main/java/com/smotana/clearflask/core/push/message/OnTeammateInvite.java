// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.message;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.ProjectStore.InvitationModel;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class OnTeammateInvite {

    public interface Config {
        @DefaultValue("__invitee_name__ invited you as an admin of __project_name__")
        String subjectTemplate();

        @DefaultValue("You have been invited by __invitee_name__ to join __project_name__ project as an Administrator. Click the link below to check it out.")
        String contentTemplate();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(InvitationModel invitation, String link) {
        String subject = config.subjectTemplate();
        String content = config.contentTemplate();

        String projectName = emailTemplates.sanitize(invitation.getProjectName());
        subject = subject.replace("__project_name__", projectName);
        content = content.replace("__project_name__", projectName);

        String inviteeName = emailTemplates.sanitize(invitation.getInviteeName());
        subject = subject.replace("__invitee_name__", inviteeName);
        content = content.replace("__invitee_name__", inviteeName);

        String templateHtml = emailTemplates.getNotificationNoUnsubTemplateHtml();
        String templateText = emailTemplates.getNotificationNoUnsubTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        String buttonText = "View invitation";
        templateHtml = templateHtml.replace("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replace("__BUTTON_TEXT__", buttonText);

        templateHtml = templateHtml.replace("__BUTTON_URL__", link);
        templateText = templateText.replace("__BUTTON_URL__", link);

        return new Email(
                invitation.getInvitedEmail(),
                subject,
                templateHtml,
                templateText,
                invitation.getProjectId(),
                "INVITE_TEAMMATE"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnTeammateInvite.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
