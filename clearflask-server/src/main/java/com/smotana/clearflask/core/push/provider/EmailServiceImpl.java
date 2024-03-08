// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.provider;

import com.amazonaws.services.simpleemailv2.AmazonSimpleEmailServiceV2;
import com.amazonaws.services.simpleemailv2.model.*;
import com.google.common.base.Charsets;
import com.google.common.base.Enums;
import com.google.common.base.Strings;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.common.util.concurrent.RateLimiter;
import com.google.inject.Module;
import com.google.inject.*;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.simplejavamail.email.EmailBuilder;
import org.simplejavamail.email.EmailPopulatingBuilder;
import org.simplejavamail.mailer.Mailer;
import org.simplejavamail.mailer.MailerBuilder;
import org.simplejavamail.mailer.config.TransportStrategy;
import rx.Observable;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Singleton
public class EmailServiceImpl implements EmailService {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        /**
         * Valid options: ses smtp
         */
        @DefaultValue("ses")
        String useService();

        @DefaultValue("noreply")
        String fromEmailLocalPart();

        @DefaultValue("")
        String fromEmailDomainOverride();

        @DefaultValue("ClearFlask")
        String emailDisplayName();

        @DefaultValue("0.1")
        double rateLimitPerSecond();

        Observable<Double> rateLimitPerSecondObservable();

        @DefaultValue("P1D")
        Duration rateLimitCapacity();

        Observable<Duration> rateLimitCapacityObservable();

        @DefaultValue(value = "TRIAL_ENDED,ACCOUNT_SIGNUP,INVOICE_PAYMENT_SUCCESS,WEEKLY_DIGEST", innerType = String.class)
        List<String> bccOnTagTypes();

        @DefaultValue(value = "events@clearflask.com", innerType = String.class)
        List<String> bccEmails();

        /**
         * Valid options: TransportStrategy
         */
        @DefaultValue("SMTP_TLS")
        String smtpStrategy();

        @DefaultValue("localhost")
        String smtpHost();

        @DefaultValue("587")
        int smtpPort();

        @DefaultValue("")
        String smtpUser();

        @DefaultValue("")
        String smtpPassword();

        @DefaultValue("TLSv1.2")
        String smtpTlsProtocols();

        Observable<String> smtpHostObservable();

        Observable<Integer> smtpPortObservable();

        Observable<String> smtpUserObservable();

        Observable<String> smtpPasswordObservable();

        Observable<String> smtpStrategyObservable();

        Observable<String> smtpTlsProtocolsObservable();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Provider<AmazonSimpleEmailServiceV2> sesProvider;
    @Inject
    private GuavaRateLimiters guavaRateLimiters;

    private RateLimiter rateLimiter;
    private volatile Optional<Mailer> smtpOpt = Optional.empty();

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

        config.smtpHostObservable().subscribe(host -> smtpOpt = Optional.empty());
        config.smtpPortObservable().subscribe(port -> smtpOpt = Optional.empty());
        config.smtpUserObservable().subscribe(user -> smtpOpt = Optional.empty());
        config.smtpPasswordObservable().subscribe(pass -> smtpOpt = Optional.empty());
        config.smtpStrategyObservable().subscribe(strategy -> smtpOpt = Optional.empty());
        config.smtpTlsProtocolsObservable().subscribe(protos -> smtpOpt = Optional.empty());
    }

    @Override
    public void send(Email email) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }

        if (!rateLimiter.tryAcquire()) {
            if (LogUtil.rateLimitAllowLog("emailpush-ratelimited")) {
                log.warn("Email service self rate limited, project/account id {} toAddress {} subject {}",
                        email.getProjectOrAccountId(), email.getToAddress(), email.getSubject());
            }
            return;
        }

        String fromEmailAddress = config.fromEmailLocalPart()
                + "@"
                + Optional.ofNullable(Strings.emptyToNull(config.fromEmailDomainOverride()))
                .orElseGet(configApp::domain);

        if ("ses".equals(config.useService())) {
            String emailDisplayName = config.emailDisplayName();
            if (!Strings.isNullOrEmpty(emailDisplayName)) {
                fromEmailAddress = emailDisplayName + " <" + fromEmailAddress + ">";
            }

            Destination destination = new Destination()
                    .withToAddresses(email.getToAddress());
            if (config.bccOnTagTypes() != null
                    && config.bccOnTagTypes().contains(email.getTypeTag())) {
                destination.withBccAddresses(getBccEmails());
            }

            SendEmailResult sendEmailResult;
            try {
                sendEmailResult = sesProvider.get().sendEmail(new SendEmailRequest()
                        .withDestination(destination)
                        .withFromEmailAddress(fromEmailAddress)
                        .withEmailTags(new MessageTag().withName("id").withValue(email.getProjectOrAccountId()),
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
                    log.warn("Email service limited, project/account id {} toAddress {} subject {}",
                            email.getProjectOrAccountId(), email.getToAddress(), email.getSubject(), ex);
                }
                return;
            } catch (AccountSuspendedException ex) {
                if (LogUtil.rateLimitAllowLog("emailpush-accountsuspended")) {
                    log.warn("Email service account suspended", ex);
                }
                return;
            } catch (MessageRejectedException | MailFromDomainNotVerifiedException | NotFoundException |
                     BadRequestException ex) {
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
            log.trace("Email sent to {} project/account id {} message id {} subject {}",
                    email.getToAddress(), email.getProjectOrAccountId(), sendEmailResult.getMessageId(), email.getSubject());
        } else {
            if (this.smtpOpt.isEmpty()) {
                System.setProperty("mail.smtp.ssl.protocols", config.smtpTlsProtocols());
                this.smtpOpt = Optional.of(MailerBuilder
                        .withSMTPServer(
                                config.smtpHost(),
                                config.smtpPort(),
                                config.smtpUser(),
                                config.smtpPassword())
                        .withTransportStrategy(Enums.getIfPresent(TransportStrategy.class, config.smtpStrategy())
                                .or(TransportStrategy.SMTP_TLS))
                        .buildMailer());
            }
            EmailPopulatingBuilder emailBuilder = EmailBuilder.startingBlank()
                    .from(config.emailDisplayName(), fromEmailAddress)
                    .to(email.getToAddress())
                    .withSubject(email.getSubject())
                    .withHTMLText(email.getContentHtml())
                    .withPlainText(email.getContentText());
            if (config.bccOnTagTypes() != null
                    && config.bccOnTagTypes().contains(email.getTypeTag())) {
                emailBuilder.bcc(String.join(",", config.bccEmails()));
            }
            this.smtpOpt.get().sendMail(emailBuilder.buildEmail(), true);
            log.info("Sending email to {} subject '{}' project/account id {} ",
                    email.getToAddress(), email.getProjectOrAccountId(), email.getSubject());
        }
    }

    private Set<String> getBccEmails() {
        Set<String> bccEmails = Sets.newHashSet();
        bccEmails.addAll(config.bccEmails());
        bccEmails.add("events@clearflask.com");
        return bccEmails;
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
