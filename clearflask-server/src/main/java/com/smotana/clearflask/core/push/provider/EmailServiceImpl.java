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
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.util.LogUtil;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import java.time.Duration;

@Slf4j
@Singleton
public class EmailServiceImpl implements EmailService {

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
        config.rateLimitCapacityObservable().subscribe(c -> rateLimiter = guavaRateLimiters.create(
                config.rateLimitPerSecond(),
                config.rateLimitCapacity().getSeconds(),
                Duration.ofMinutes(1).getSeconds()));
        rateLimiter = guavaRateLimiters.create(
                config.rateLimitPerSecond(),
                config.rateLimitCapacity().getSeconds(),
                Duration.ofMinutes(10).getSeconds());

        config.rateLimitPerSecondObservable().subscribe(rateLimitPerSecond -> rateLimiter.setRate(rateLimitPerSecond));
    }

    @Override
    public void send(Email email) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }

        if (!rateLimiter.tryAcquire()) {
            if (LogUtil.rateLimitAllowLog("emailpush-ratelimited")) {
                log.warn("Email service self rate limited, projectId {} toAddress {} subject {}",
                        email.getProjectId(), email.getToAddress(), email.getSubject());
            }
            return;
        }

        SendEmailResult result;
        try {
            result = ses.sendEmail(new SendEmailRequest()
                    .withDestination(new Destination()
                            .withToAddresses(email.getToAddress()))
                    .withFromEmailAddress(config.fromEmail())
                    .withEmailTags(new MessageTag().withName("projectId").withValue(email.getProjectId()),
                            new MessageTag().withName("type").withValue(email.getTypeTag()))
                    .withContent(new EmailContent().withSimple(new Message()
                            .withSubject(new Content()
                                    .withCharset(Charsets.UTF_8.name())
                                    .withData(email.getSubject()))
                            .withBody(new Body()
                                    .withHtml(new Content()
                                            .withCharset(Charsets.UTF_8.name())
                                            .withData(email.getContentHtml()))
                                    .withText(new Content()
                                            .withCharset(Charsets.UTF_8.name())
                                            .withData(email.getContentText()))))));
        } catch (TooManyRequestsException | SendingPausedException | LimitExceededException ex) {
            if (LogUtil.rateLimitAllowLog("emailpush-toomanyreqs")) {
                log.warn("Email service limited, projectId {} toAddress {} subject {}",
                        email.getProjectId(), email.getToAddress(), email.getSubject(), ex);
            }
            return;
        } catch (AccountSuspendedException ex) {
            if (LogUtil.rateLimitAllowLog("emailpush-accountsuspended")) {
                log.warn("Email service account suspended", ex);
            }
            return;
        } catch (MessageRejectedException | MailFromDomainNotVerifiedException | NotFoundException | BadRequestException ex) {
            if (LogUtil.rateLimitAllowLog("emailpush-misconfigured")) {
                log.warn("Email service misconfigured", ex);
            }
            return;
        } catch (Exception ex) {
            if (LogUtil.rateLimitAllowLog("emailpush-exception")) {
                log.warn("Email cannot be delivered", ex);
            }
            return;
        }
        log.trace("Email sent to {} projectId {} message id {} subject {}",
                email.getToAddress(), email.getProjectId(), result.getMessageId(), email.getSubject());
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(EmailService.class).to(EmailServiceImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
