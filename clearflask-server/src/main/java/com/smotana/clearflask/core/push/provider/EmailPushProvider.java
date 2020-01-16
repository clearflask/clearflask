package com.smotana.clearflask.core.push.provider;

import com.amazonaws.services.simpleemailv2.AmazonSimpleEmailServiceV2;
import com.amazonaws.services.simpleemailv2.model.AccountSuspendedException;
import com.amazonaws.services.simpleemailv2.model.BadRequestException;
import com.amazonaws.services.simpleemailv2.model.Body;
import com.amazonaws.services.simpleemailv2.model.Content;
import com.amazonaws.services.simpleemailv2.model.Destination;
import com.amazonaws.services.simpleemailv2.model.EmailContent;
import com.amazonaws.services.simpleemailv2.model.LimitExceededException;
import com.amazonaws.services.simpleemailv2.model.MailFromDomainNotVerifiedException;
import com.amazonaws.services.simpleemailv2.model.Message;
import com.amazonaws.services.simpleemailv2.model.MessageRejectedException;
import com.amazonaws.services.simpleemailv2.model.MessageTag;
import com.amazonaws.services.simpleemailv2.model.NotFoundException;
import com.amazonaws.services.simpleemailv2.model.SendEmailRequest;
import com.amazonaws.services.simpleemailv2.model.SendEmailResult;
import com.amazonaws.services.simpleemailv2.model.SendingPausedException;
import com.amazonaws.services.simpleemailv2.model.TooManyRequestsException;
import com.google.common.base.Charsets;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.common.util.concurrent.RateLimiter;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.push.PushProvider;
import com.smotana.clearflask.util.LogUtil;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import java.time.Duration;

@Slf4j
@Singleton
public class EmailPushProvider implements PushProvider {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("noreply@clearflask.com")
        String fromEmail();

        @DefaultValue("0.1")
        double rateLimitPerSecond();

        Observable<Double> rateLimitPerSecondObservable();

        @DefaultValue("P1D")
        Duration rateLimitCapacity();

        Observable<Duration> rateLimitCapacityObservable();
    }

    @Inject
    private Config config;
    @Inject
    private AmazonSimpleEmailServiceV2 ses;
    @Inject
    private GuavaRateLimiters guavaRateLimiters;

    private RateLimiter rateLimiter;

    @Inject
    private void setup() {
        config.rateLimitPerSecondObservable().subscribe(rateLimiter::setRate);
        config.rateLimitCapacityObservable().subscribe(c -> rateLimiter = guavaRateLimiters.create(
                config.rateLimitPerSecond(),
                config.rateLimitCapacity().getSeconds(),
                Duration.ofMinutes(1).getSeconds()));
        rateLimiter = guavaRateLimiters.create(
                config.rateLimitPerSecond(),
                config.rateLimitCapacity().getSeconds(),
                Duration.ofMinutes(10).getSeconds());
    }

    @Override
    public boolean send(NotificationModel notification, String email) {
        if (!config.enabled()) {
            return false;
        }

        if (!rateLimiter.tryAcquire()) {
            if (LogUtil.rateLimitAllowLog("emailpush-ratelimited")) {
                log.warn("Email service self rate limited, projectId {} userId {}",
                        notification.getProjectId(), notification.getUserId());
            }
            return false;
        }

        SendEmailResult result;
        try {
            result = ses.sendEmail(new SendEmailRequest()
                    .withDestination(new Destination()
                            .withToAddresses(email))
                    .withFromEmailAddress(config.fromEmail())
                    .withEmailTags(new MessageTag().withName("projectId").withValue(notification.getProjectId()))
                    .withContent(new EmailContent().withSimple(new Message()
                            .withSubject(new Content()
                                    .withCharset(Charsets.UTF_8.name())
                                    .withData(notification.getTitle()))
                            .withBody(new Body().withText(new Content()
                                    .withCharset(Charsets.UTF_8.name())
                                    .withData(notification.getBody()))))));
        } catch (TooManyRequestsException | SendingPausedException | LimitExceededException ex) {
            if (LogUtil.rateLimitAllowLog("emailpush-toomanyreqs")) {
                log.warn("Email service limited, projectId {} userId {}",
                        notification.getProjectId(), notification.getUserId(), ex);
            }
            return false;
        } catch (AccountSuspendedException ex) {
            if (LogUtil.rateLimitAllowLog("emailpush-accountsuspended")) {
                log.error("Email service account suspended", ex);
            }
            return false;
        } catch (MessageRejectedException | MailFromDomainNotVerifiedException | NotFoundException | BadRequestException ex) {
            if (LogUtil.rateLimitAllowLog("emailpush-misconfigured")) {
                log.warn("Email service misconfigured", ex);
            }
            return false;
        }

        log.trace("Email sent to userId {} projectId {} with message id {}",
                notification.getUserId(), notification.getProjectId(), result.getMessageId());
        return true;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PushProvider.class).annotatedWith(Names.named("Email"))
                        .to(EmailPushProvider.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
