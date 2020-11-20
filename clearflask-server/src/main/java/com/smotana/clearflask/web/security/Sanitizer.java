package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.extern.slf4j.Slf4j;

import javax.mail.internet.AddressException;
import javax.mail.internet.InternetAddress;
import javax.ws.rs.core.Response;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;

@Slf4j
@Singleton
public class Sanitizer {

    public interface Config {
        @DefaultValue(value = "www,admin,smotana,clearflask,veruv,mail,email,remote,blog,server,ns1,ns2,smtp,secure,vpn,m,shop,portal,support,dev,news,kaui,killbill,kibana,feedback", innerType = String.class)
        Set<String> reservedSubdomains();
    }

    @Inject
    private Config config;

    /** If changed, also change in IdeaExplorer.tsx */
    private static final long POST_TITLE_MAX_LENGTH = 100;
    private static final long CONTENT_MAX_LENGTH = 10_000;
    private static final long NAME_MAX_LENGTH = 30;
    /** If changed, also change in api-project.yaml */
    private static final long SUBDOMAIN_MIN_LENGTH = 1;
    /** If changed, also change in api-project.yaml */
    private static final long SUBDOMAIN_MAX_LENGTH = 30;
    /** If changed, also change in api-project.yaml */
    private static final String SUBDOMAIN_REGEX = "^[A-Za-z0-9](?:[A-Za-z0-9\\-]*[A-Za-z0-9])?$";
    private static final long SEARCH_TEXT_MAX_LENGTH = 200;

    private final Predicate<String> subdomainPredicate;

    @Inject
    private Sanitizer() {
        subdomainPredicate = Pattern.compile(SUBDOMAIN_REGEX).asPredicate();
    }

    public void email(String email) {
        if (email == null) {
            return;
        }
        try {
            new InternetAddress(email).validate();
        } catch (AddressException ex) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Invalid email format", ex);
        }
    }

    public void accountName(String accountName) {
        if (accountName != null && accountName.length() > NAME_MAX_LENGTH) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Name is too long, must be at most " + NAME_MAX_LENGTH + " characters");
        }
    }

    public void userName(String userName) {
        if (userName != null && userName.length() > NAME_MAX_LENGTH) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Name is too long, must be at most " + NAME_MAX_LENGTH + " characters");
        }
    }

    public void content(String content) {
        if (content != null && content.length() > CONTENT_MAX_LENGTH) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Content is too long, must be at most " + CONTENT_MAX_LENGTH + " characters");
        }
    }

    public void postTitle(String postTitle) {
        if (postTitle != null && postTitle.length() > POST_TITLE_MAX_LENGTH) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Title is too long, must be at most " + POST_TITLE_MAX_LENGTH + " characters");
        }
    }

    public void searchText(String searchText) {
        if (searchText != null && searchText.length() > SEARCH_TEXT_MAX_LENGTH) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Search text is too long, must be at most " + SEARCH_TEXT_MAX_LENGTH + " characters");
        }
    }

    public void subdomain(String slug) {
        if (slug.length() < SUBDOMAIN_MIN_LENGTH) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Subdomain is too short, must be at least " + SUBDOMAIN_MIN_LENGTH + " character(s)");
        }
        if (slug.length() > SUBDOMAIN_MAX_LENGTH) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Subdomain is too long, must be at most " + SUBDOMAIN_MAX_LENGTH + " characters");
        }
        if (!subdomainPredicate.test(slug)) {
            throw new ErrorWithMessageException(BAD_REQUEST, "Subdomain can only contain lowercase letters, numbers and dashes in the middle");
        }

        if (config.reservedSubdomains().contains(slug)) {
            throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "'" + slug + "' subdomain is reserved");
        }
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
