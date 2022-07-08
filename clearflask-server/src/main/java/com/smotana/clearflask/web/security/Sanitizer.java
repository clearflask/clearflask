// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Maps;
import com.google.common.collect.Sets;
import com.google.common.net.InternetDomainName;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.ContentStore;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.owasp.html.Handler;
import org.owasp.html.HtmlChangeListener;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.HtmlSanitizer;
import org.owasp.html.HtmlStreamRenderer;
import org.owasp.html.PolicyFactory;
import org.xbill.DNS.CNAMERecord;
import org.xbill.DNS.Lookup;
import org.xbill.DNS.Record;
import org.xbill.DNS.TextParseException;
import org.xbill.DNS.Type;

import javax.mail.internet.AddressException;
import javax.mail.internet.InternetAddress;
import javax.ws.rs.core.Response;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.INTERNAL_SERVER_ERROR;

@Slf4j
@Singleton
public class Sanitizer {
    private static final PolicyFactory HtmlToPlaintextPolicyFactory = new HtmlPolicyBuilder().toFactory();

    public interface Config {
        @DefaultValue(value = "www,admin,smotana,clearflask,veruv,mail,email,remote,blog,server,ns1,ns2,smtp,secure,vpn,m,shop,portal,support,dev,news,kaui,killbill,kibana,feedback,docs,documentation,release,api,domain,cname,sni,upload", innerType = String.class)
        Set<String> reservedSubdomains();

        @DefaultValue("false")
        boolean skipCheckForAllDomains();

        @DefaultValue(value = "", innerType = String.class)
        Set<String> skipCheckForDomains();

        @DefaultValue(value = "clearflask.com,localhost", innerType = String.class)
        Set<String> reservedDomains();

        @DefaultValue("sni.clearflask.com")
        String sniDomain();

        @DefaultValue("true")
        boolean htmlSanitizerEnabled();

        @DefaultValue("<p style=\"color: #e60000;\">Cannot display corrupted message</p>")
        boolean htmlSanitizerInvalidHtmlMessage();
    }

    @Inject
    private Config config;
    @Inject
    private ContentStore contentStore;

    /** If changed, also change in PostCreateForm.tsx */
    private static final long POST_TITLE_MAX_LENGTH = 100;
    private static final long CONTENT_MAX_LENGTH = 10_000;
    private static final long NAME_MAX_LENGTH = 30;
    /** If changed, also change in api-project.yaml */
    private static final long SUBDOMAIN_MIN_LENGTH = 1;
    /** If changed, also change in api-project.yaml */
    private static final long SUBDOMAIN_MAX_LENGTH = 30;
    /** If changed, also change in api-project.yaml */
    private static final String SUBDOMAIN_REGEX = "^[a-z0-9](?:[a-z0-9\\-]*[a-z0-9])?$";
    private static final long SEARCH_TEXT_MAX_LENGTH = 200;
    private static final Pattern IS_NUMERIC_PATTERN = Pattern.compile("^[0-9]+$");

    private Predicate<String> subdomainPredicate;
    private PolicyFactory richHtmlPolicyFactory;

    @Inject
    private void setup() {
        subdomainPredicate = Pattern.compile(SUBDOMAIN_REGEX).asPredicate();
        richHtmlPolicyFactory = new HtmlPolicyBuilder()
                .allowAttributes("class").matching(Pattern.compile("ql-indent-[0-9]")).onElements("li")
                .allowAttributes("class").matching(false, "ql-syntax").onElements("pre")
                .allowAttributes("spellcheck").matching(false, "false").onElements("pre")
                .allowAttributes("data-checked").matching(false, "true", "false").onElements("ul")

                // Links
                .allowAttributes("src", "width", "align").onElements("img")
                // Links
                .allowAttributes("href").onElements("a")
                // If changed, also change in quill-format-link.ts
                .allowAttributes("target").matching((String elementName, String attributeName, String value) -> "_blank").onElements("a")
                .allowAttributes("rel").matching((String elementName, String attributeName, String value) -> "" /* Will be set by requireRelsOnLinks */).onElements("a")
                .allowElements((elementName, attrs) -> attrs.containsAll(ImmutableSet.of("rel", "href", "target")) ? elementName : null, "a")
                // If changed, also change in quill-format-link.ts
                .requireRelsOnLinks("noreferrer", "noopener", "ugc")
                // If changed, also change in quill-format-link.ts
                .allowUrlProtocols("https", "http", "mailto", "tel")

                // Migration from <p> to <div>
                .allowElements((elementName, attrs) -> "div", "p")

                .allowElements("div", "br", "a", "strong", "s", "em", "u", "ul", "ol", "li", "pre", "blockquote", "h2", "h3", "h4", "img")
                .toFactory();
    }

    public void email(String email) {
        if (email == null) {
            return;
        }
        try {
            new InternetAddress(email).validate();
        } catch (AddressException ex) {
            throw new ApiException(BAD_REQUEST, "Invalid email format", ex);
        }
    }

    public void accountName(String accountName) {
        if (accountName != null && accountName.length() > NAME_MAX_LENGTH) {
            throw new ApiException(BAD_REQUEST, "Name is too long, must be at most " + NAME_MAX_LENGTH + " characters");
        }
    }

    public void userName(String userName) {
        if (userName != null && userName.length() > NAME_MAX_LENGTH) {
            throw new ApiException(BAD_REQUEST, "Name is too long, must be at most " + NAME_MAX_LENGTH + " characters");
        }
    }

    public void content(String content) {
        if (content != null && content.length() > CONTENT_MAX_LENGTH) {
            throw new ApiException(BAD_REQUEST, "Content is too long, must be at most " + CONTENT_MAX_LENGTH + " characters");
        }
    }

    public void postTitle(String postTitle) {
        if (Strings.isNullOrEmpty(postTitle)) {
            throw new ApiException(BAD_REQUEST, "Title cannot be empty");
        }
        if (postTitle.length() > POST_TITLE_MAX_LENGTH) {
            throw new ApiException(BAD_REQUEST, "Title is too long, must be at most " + POST_TITLE_MAX_LENGTH + " characters");
        }
    }

    public void searchText(String searchText) {
        if (searchText != null && searchText.length() > SEARCH_TEXT_MAX_LENGTH) {
            throw new ApiException(BAD_REQUEST, "Search text is too long, must be at most " + SEARCH_TEXT_MAX_LENGTH + " characters");
        }
    }

    public void domain(String domain, boolean isSuperAdmin) {
        if (Strings.isNullOrEmpty(domain)) {
            throw new ApiException(BAD_REQUEST, "Custom domain is empty");
        }

        if (isSuperAdmin) {
            log.debug("Skipping custom domain validation for {}, isSuperAdmin", domain);
            return;
        }

        if (config.skipCheckForAllDomains()) {
            log.debug("Skipping custom domain validation for {}, skipCheckForAllDomains true", domain);
            return;
        }

        if (Optional.ofNullable(config.skipCheckForDomains()).orElse(ImmutableSet.of()).contains(domain)) {
            log.info("Skipping custom domain validation for {}, skipCheckForDomains match", domain);
            return;
        }

        if (!InternetDomainName.from(domain).isUnderPublicSuffix()) {
            throw new ApiException(BAD_REQUEST, "Custom domain doesn't appear to have a public suffix. If this is an error, please contact support team.");
        }

        if (config.reservedDomains().contains(domain)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "'" + domain + "' domain is reserved");
        }

        Lookup lookup = null;
        try {
            lookup = new Lookup(domain, Type.CNAME);
        } catch (TextParseException ex) {
            throw new ApiException(BAD_REQUEST, "Custom domain name appears to be invalid.", ex);
        }
        Record[] records = Optional.ofNullable(lookup.run()).orElse(new Record[]{});
        switch (lookup.getResult()) {
            case Lookup.SUCCESSFUL:
                break;
            case Lookup.HOST_NOT_FOUND:
            case Lookup.TYPE_NOT_FOUND:
            case Lookup.UNRECOVERABLE:
                throw new ApiException(BAD_REQUEST, "Custom domain doesn't appear to have the correct DNS entry. Please set a CNAME record in your DNS to " + config.sniDomain());
            case Lookup.TRY_AGAIN:
                throw new ApiException(INTERNAL_SERVER_ERROR, "Failed to validate Custom Domain DNS entry");
        }
        boolean isCanonical = records.length > 0 && Arrays.stream(records)
                .allMatch(r -> r.getType() == Type.CNAME
                        && r instanceof CNAMERecord
                        && config.sniDomain().equals(((CNAMERecord) r).getTarget().toString(true)));
        if (!isCanonical) {
            throw new ApiException(BAD_REQUEST, "Custom domain doesn't appear to have the correct DNS CNAME record in your DNS to " + config.sniDomain());
        }
    }

    public void subdomain(String subdomain, boolean isSuperAdmin) {
        if (subdomain.length() < SUBDOMAIN_MIN_LENGTH) {
            throw new ApiException(BAD_REQUEST, "Subdomain is too short, must be at least " + SUBDOMAIN_MIN_LENGTH + " character(s)");
        }
        if (isSuperAdmin) {
            log.debug("Skipping subdomain validation for {}, isSuperAdmin", subdomain);
            return;
        }
        if (subdomain.length() > SUBDOMAIN_MAX_LENGTH) {
            throw new ApiException(BAD_REQUEST, "Subdomain is too long, must be at most " + SUBDOMAIN_MAX_LENGTH + " characters");
        }
        if (!subdomainPredicate.test(subdomain)) {
            throw new ApiException(BAD_REQUEST, "Subdomain can only contain lowercase letters, numbers and dashes in the middle");
        }

        if (config.reservedSubdomains().contains(subdomain)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "'" + subdomain + "' subdomain is reserved");
        }
    }

    public String richHtml(String html, String identifierType, String identifierId, String projectId, boolean silenceViolations) {
        if (!config.htmlSanitizerEnabled()) {
            return html;
        }
        StringBuilder sanitizedHtmlBuilder = new StringBuilder();

        Map<String, Set<String>> discarded = Maps.newHashMap();
        HtmlChangeListener<Map<String, Set<String>>> htmlChangeListener = new HtmlChangeListener<>() {
            @Override
            public void discardedTag(Map<String, Set<String>> discarded, String elementName) {
                discarded.putIfAbsent(elementName, Sets.newHashSet());
            }

            @Override
            public void discardedAttributes(Map<String, Set<String>> discarded, String elementName, String... attributeNames) {
                discarded.getOrDefault(elementName, Sets.newHashSet()).addAll(Arrays.asList(attributeNames));
            }
        };
        HtmlStreamRenderer renderer = HtmlStreamRenderer.create(
                sanitizedHtmlBuilder,
                badHtml -> {
                    if (LogUtil.rateLimitAllowLog("sanitizer-html-error")) {
                        log.warn("Error in HTML parsing for {} id {}: '{}'",
                                identifierType, identifierId, badHtml);
                    }
                    sanitizedHtmlBuilder.append(config.htmlSanitizerInvalidHtmlMessage());
                });
        PolicyFactory policy = richHtmlPolicyFactory.and(contentSignUrlsPolicy(projectId));
        HtmlSanitizer.sanitize(html, policy.apply(renderer, htmlChangeListener, discarded));

        // Migration from <p> to <div>
        if (!discarded.isEmpty()
                && discarded.containsKey("p")
                && discarded.get("p").isEmpty()) {
            discarded.remove("p");
        }

        if (!discarded.isEmpty()) {
            log.info("HTML Policy violation(s) for {} {} id {}, element-attribute violations(s): {}",
                    projectId, identifierType, identifierId, discarded);
        }
        return sanitizedHtmlBuilder.toString();
    }

    /**
     * - Only allow images uploaded to our service
     * - Attach S3 presigned URL query params.
     */
    private PolicyFactory contentSignUrlsPolicy(String projectId) {
        return new HtmlPolicyBuilder()
                .allowAttributes("src")
                .matching((elementName, attributeName, value) -> contentStore.signUrl(projectId, value).orElse(null))
                .onElements("img")

                .allowAttributes("width")
                .matching(IS_NUMERIC_PATTERN)
                .onElements("img")

                .allowAttributes("align")
                .matching(true, "left", "middle", "right")
                .onElements("img")

                .allowElements((elementName, attrs) -> attrs.containsAll(ImmutableSet.of("src")) ? elementName : null, "img")
                .allowUrlProtocols(contentStore.getScheme())
                .allowElements("img")
                .toFactory();
    }

    public Optional<String> signCoverImg(String projectId, String coverImg) {
        if (Strings.isNullOrEmpty(coverImg)) {
            return Optional.empty();
        }
        return contentStore.signUrl(projectId, coverImg);
    }

    public String richHtmlToPlaintext(String html) {
        StringBuilder sanitizedHtmlBuilder = new StringBuilder();

        HtmlStreamRenderer renderer = HtmlStreamRenderer.create(
                sanitizedHtmlBuilder,
                Handler.DO_NOTHING);
        HtmlSanitizer.sanitize(html, HtmlToPlaintextPolicyFactory.apply(renderer));
        return sanitizedHtmlBuilder.toString();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Sanitizer.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
