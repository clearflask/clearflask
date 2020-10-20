package com.smotana.clearflask.web.resource;

import com.amazonaws.services.simpleemailv2.AmazonSimpleEmailServiceV2;
import com.amazonaws.services.simpleemailv2.model.*;
import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.SupportApi;
import com.smotana.clearflask.api.model.SupportMessage;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.util.IpUtil;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.RandomStringUtils;
import org.apache.commons.lang.StringUtils;

import javax.annotation.security.PermitAll;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Path;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class SupportResource extends AbstractResource implements SupportApi {
    /**
     * If changed, also change in ContactPage.tsx
     */
    private static final String TYPE_FIELD = "type";
    /**
     * If changed, also change in ContactPage.tsx
     */
    private static final String TYPE_IMPORTANT = "important";
    /**
     * If changed, also change in ContactPage.tsx
     */
    private static final String CONTACT_FIELD = "contact";

    public interface Config {
        @DefaultValue("support")
        String supportEmailLocalPart();

        @DefaultValue("noreply")
        String fromEmailLocalPart();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private AmazonSimpleEmailServiceV2 ses;
    @Inject
    private Environment env;
    @Context
    private HttpServletRequest request;

    @PermitAll
    @Limit(requiredPermits = 100, challengeAfter = 10)
    @Override
    public void supportMessage(SupportMessage supportMessage) {
        try {
            SendEmailRequest sendEmailRequest = new SendEmailRequest();
            generateReplyTo(supportMessage).ifPresent(sendEmailRequest::withReplyToAddresses);
            ses.sendEmail(sendEmailRequest
                    .withDestination(new Destination()
                            .withToAddresses(config.supportEmailLocalPart() + "@" + configApp.domain()))
                    .withFromEmailAddress(config.fromEmailLocalPart() + "@" + configApp.domain())
                    .withReplyToAddresses()
                    .withEmailTags(new MessageTag().withName("supportType").withValue(supportMessage.getContent().getOrDefault(TYPE_FIELD, "unknown")))
                    .withContent(new EmailContent().withSimple(new Message()
                            .withSubject(new Content()
                                    .withCharset(Charsets.UTF_8.name())
                                    .withData(generateSubject(supportMessage)))
                            .withBody(new Body().withText(new Content()
                                    .withCharset(Charsets.UTF_8.name())
                                    .withData(generateBody(supportMessage)))))));
        } catch (Exception ex) {
            log.error("Failed to send support message {}", supportMessage, ex);
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to send, please use support@clearflask.com", ex);
        }
    }

    private Optional<String> generateReplyTo(SupportMessage supportMessage) {
        return Optional.ofNullable(supportMessage.getContent().get(CONTACT_FIELD));
    }

    private String generateSubject(SupportMessage supportMessage) {
        StringBuilder sb = new StringBuilder();
        if (supportMessage.getContent().containsKey(TYPE_IMPORTANT)) {
            sb.append("!");
        }
        sb.append("Support");
        sb.append(" ");
        sb.append(StringUtils.abbreviate(supportMessage.getContent().getOrDefault(TYPE_FIELD, "unknown"), 20));
        sb.append(" #");
        sb.append(RandomStringUtils.randomAlphanumeric(7));
        return sb.toString();
    }

    private String generateBody(SupportMessage supportMessage) {
        return Stream.concat(
                ImmutableMap.of(
                        "ip", IpUtil.getRemoteIp(request, env)
                ).entrySet().stream(),
                supportMessage.getContent().entrySet().stream())
                .map(pair -> Strings.nullToEmpty(pair.getKey()) + ": " + Strings.nullToEmpty(pair.getValue()))
                .collect(Collectors.joining("\n"));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(SupportResource.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
