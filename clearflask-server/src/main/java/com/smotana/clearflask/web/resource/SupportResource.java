package com.smotana.clearflask.web.resource;

import com.amazonaws.services.simpleemailv2.AmazonSimpleEmailServiceV2;
import com.amazonaws.services.simpleemailv2.model.Body;
import com.amazonaws.services.simpleemailv2.model.Content;
import com.amazonaws.services.simpleemailv2.model.Destination;
import com.amazonaws.services.simpleemailv2.model.EmailContent;
import com.amazonaws.services.simpleemailv2.model.Message;
import com.amazonaws.services.simpleemailv2.model.MessageTag;
import com.amazonaws.services.simpleemailv2.model.SendEmailRequest;
import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.SupportApi;
import com.smotana.clearflask.api.model.SupportMessage;
import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.util.IpUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;

import javax.annotation.security.PermitAll;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Path;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Singleton
@Path("/v1")
public class SupportResource extends AbstractResource implements SupportApi {
    /** If changed, also change in ContactPage.tsx */
    private static final String TYPE_FIELD = "type";
    /** If changed, also change in ContactPage.tsx */
    private static final String TYPE_IMPORTANT = "important";
    /** If changed, also change in ContactPage.tsx */
    private static final String CONTACT_FIELD = "contact";

    public interface Config {
        @DefaultValue("support@clearflask.com")
        String supportEmail();

        @DefaultValue("server@clearflask.com")
        String fromEmail();
    }

    @Inject
    private Config config;
    @Inject
    private AmazonSimpleEmailServiceV2 ses;
    @Inject
    private ServiceInjector.Environment env;
    @Context
    private HttpServletRequest request;

    @PermitAll
    @Limit(requiredPermits = 100, challengeAfter = 1)
    @Override
    public void supportMessage(SupportMessage supportMessage) {
        try {
            ses.sendEmail(new SendEmailRequest()
                    .withDestination(new Destination()
                            .withToAddresses(config.supportEmail()))
                    .withFromEmailAddress(config.fromEmail())
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
            throw new ErrorWithMessageException(Response.Status.INTERNAL_SERVER_ERROR, "Failed to send, please use support@clearflask.com");
        }
    }

    private String generateSubject(SupportMessage supportMessage) {
        StringBuilder sb = new StringBuilder();
        if (supportMessage.getContent().containsKey(TYPE_IMPORTANT)) {
            sb.append("IMPORTANT ");
        }
        sb.append("CfSupport");
        sb.append(" type:");
        sb.append(StringUtils.abbreviate(supportMessage.getContent().getOrDefault(TYPE_FIELD, "unknown"), 20));
        sb.append(" contact:");
        sb.append(StringUtils.abbreviate(supportMessage.getContent().getOrDefault(CONTACT_FIELD, IpUtil.getRemoteIp(request, env)), 40));
        return sb.toString();
    }

    private String generateBody(SupportMessage supportMessage) {
        return Stream.concat(
                ImmutableMap.of(
                        "ip", request.getRemoteAddr(),
                        "x-forwarded-for", request.getHeader("x-forwarded-for")
                ).entrySet().stream(),
                supportMessage.getContent().entrySet().stream())
                .map(pair -> Strings.nullToEmpty(pair.getKey()) + ":\n" + Strings.nullToEmpty(pair.getValue()) + "\n\n")
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
