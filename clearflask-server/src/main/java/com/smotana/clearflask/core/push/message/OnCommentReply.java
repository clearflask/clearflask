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
import com.smotana.clearflask.store.CommentStore.CommentModel;
import com.smotana.clearflask.store.IdeaStore.IdeaModel;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Singleton
public class OnCommentReply {

    public enum AuthorType {
        IDEA_REPLY("commented on your post"),
        COMMENT_REPLY("replied to your comment in");

        private final String replyString;

        AuthorType(String replyString) {
            this.replyString = replyString;
        }

        public String getReplyString() {
            return replyString;
        }
    }

    public interface Config {
        @DefaultValue("__sender__ __reply_type__ '__title__'")
        String subjectTemplate();

        @DefaultValue("__sender__ __reply_type__ __title__ with __reply__")
        String template();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private EmailNotificationTemplate emailNotificationTemplate;

    public Email email(UserModel user, AuthorType userAuthorType, UserModel sender, IdeaModel idea, CommentModel comment, ConfigAdmin configAdmin, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(user.getEmail()));

        String subject = config.subjectTemplate();
        String content = config.template();

        subject = subject.replaceAll("__reply_type__", userAuthorType.getReplyString());
        content = content.replaceAll("__reply_type__", userAuthorType.getReplyString());

        String templateHtml = emailNotificationTemplate.getNotificationTemplateHtml();
        String templateText = emailNotificationTemplate.getNotificationTemplateText();

        templateHtml = templateHtml.replaceAll("__CONTENT__", content);
        templateText = templateText.replaceAll("__CONTENT__", content);

        String title = StringUtils.abbreviate(idea.getTitle().replaceAll("[^A-Za-z0-9 ]+", ""), 50);
        templateHtml = templateHtml.replaceAll("__title__",
                "<span style=\"font-weight: bold\">" +
                        title +
                        "</span>");
        templateText = templateText.replaceAll("__title__", title);
        title = StringUtils.abbreviate(title, 20);
        subject = subject.replaceAll("__title__", title);

        String reply = StringUtils.abbreviate(comment.getContent().replaceAll("[^A-Za-z0-9 ]+", ""), 50);
        templateHtml = templateHtml.replaceAll("__reply__",
                "<span style=\"font-weight: bold\">" +
                        reply +
                        "</span>");
        templateText = templateText.replaceAll("__reply__", reply);

        String senderName = StringUtils.abbreviate((sender.getName() == null ? "" : sender.getName()).replaceAll("[^A-Za-z0-9 ]+", ""), 10);
        if (senderName.isEmpty()) {
            senderName = "Someone";
        }
        subject = subject.replaceAll("__sender__", senderName);
        templateText = templateText.replaceAll("__sender__", senderName);
        templateHtml = templateHtml.replaceAll("__sender__",
                "<span style=\"font-weight: bold\">" +
                        senderName +
                        "</span>");

        templateHtml = templateHtml.replaceAll("__BUTTON_TEXT__", "VIEW REPLY");
        templateText = templateText.replaceAll("__BUTTON_TEXT__", "VIEW REPLY");

        link += "?authToken=" + authToken;
        templateHtml = templateHtml.replaceAll("__BUTTON_URL__", link);
        templateText = templateText.replaceAll("__BUTTON_URL__", link);

        String unsubscribeLink = "https://" + configAdmin.getSlug() + "." + configApp.domain() + "/account?authToken=" + authToken;
        templateHtml = templateHtml.replaceAll("__UNSUBSCRIBE_URL__", unsubscribeLink);
        templateText = templateText.replaceAll("__UNSUBSCRIBE_URL__", unsubscribeLink);

        return new Email(
                user.getEmail(),
                subject,
                templateHtml,
                templateText,
                configAdmin.getProjectId(),
                "COMMENT_REPLY"
        );
    }

    public BrowserPush browserPush(UserModel user, AuthorType userAuthorType, UserModel sender, IdeaModel idea, CommentModel comment, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(user.getBrowserPushToken()));

        String subject = config.subjectTemplate();

        subject = subject.replaceAll("__reply_type__", userAuthorType.getReplyString());

        String senderName = StringUtils.abbreviate((sender.getName() == null ? "" : sender.getName()).replaceAll("[^A-Za-z0-9 ]+", ""), 10);
        if (senderName.isEmpty()) {
            senderName = "Someone";
        }
        subject = subject.replaceAll("__sender__", senderName);

        String title = StringUtils.abbreviate(idea.getTitle().replaceAll("[^A-Za-z0-9 ]+", ""), 20);
        subject = subject.replaceAll("__title__", title);

        String content = StringUtils.abbreviate(comment.getContent().replaceAll("[^A-Za-z0-9 ]+", ""), 50);

        return new BrowserPush(
                user.getBrowserPushToken(),
                subject,
                content,
                idea.getProjectId(),
                user.getUserId(),
                link + "?authToken=" + authToken
        );
    }

    public String inAppDescription(UserModel user, AuthorType userAuthorType, UserModel sender, IdeaModel idea, CommentModel comment, String link) {
        checkArgument(!Strings.isNullOrEmpty(user.getBrowserPushToken()));

        String subject = config.subjectTemplate();

        subject = subject.replaceAll("__reply_type__", userAuthorType.getReplyString());

        String senderName = StringUtils.abbreviate((sender.getName() == null ? "" : sender.getName()).replaceAll("[^A-Za-z0-9 ]+", ""), 10);
        if (senderName.isEmpty()) {
            senderName = "Someone";
        }
        subject = subject.replaceAll("__sender__", senderName);

        String title = StringUtils.abbreviate(idea.getTitle().replaceAll("[^A-Za-z0-9 ]+", ""), 20);
        subject = subject.replaceAll("__title__", title);

        return subject;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnCommentReply.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}