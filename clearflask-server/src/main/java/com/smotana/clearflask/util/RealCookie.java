// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.message.internal.HttpDateFormat;
import org.glassfish.jersey.message.internal.StringBuilderUtils;

import javax.servlet.http.HttpServletResponse;
import java.sql.Date;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static com.google.common.base.Preconditions.checkArgument;

@Slf4j
@Value
public class RealCookie {

    public enum SameSite {
        NONE,
        STRICT,
        LAX,
    }

    @NonNull
    String name;
    @NonNull
    String value;
    @NonNull
    String path;
    @NonNull
    long version;
    String domain;

    boolean httpOnly;
    boolean secure;
    SameSite sameSite;

    Long maxAge;
    Long ttlInEpochSec;

    String comment;

    @NonNull
    ImmutableMap<String, String> additionalProperties;

    @Builder
    public RealCookie(
            @NonNull String name,
            @NonNull String value,
            @NonNull String path,
            @NonNull long version,
            String domain,
            boolean httpOnly,
            boolean secure,
            SameSite sameSite,
            Long maxAge,
            Long ttlInEpochSec,
            String comment,
            @NonNull ImmutableMap<String, String> additionalProperties) {
        checkArgument(secure || sameSite != SameSite.NONE, "Cookies with SameSite=None must also specify Secure");
        this.name = name;
        this.value = value;
        this.path = path;
        this.version = version;
        this.domain = domain;
        this.httpOnly = httpOnly;
        this.secure = secure;
        this.sameSite = sameSite;
        this.maxAge = maxAge;
        this.ttlInEpochSec = ttlInEpochSec;
        this.comment = comment;
        this.additionalProperties = additionalProperties;
    }

    public void addToResponse(HttpServletResponse response) {
        response.addHeader("Set-Cookie", toHeaderString());
    }

    public String toHeaderString() {
        final StringBuilder b = new StringBuilder();

        StringBuilderUtils.appendQuotedIfWhitespace(b, getName());
        b.append('=');
        StringBuilderUtils.appendQuotedIfWhitespace(b, getValue());

        b.append("; Version=").append(getVersion());

        if (getComment() != null) {
            b.append("; Comment=");
            StringBuilderUtils.appendQuotedIfWhitespace(b, getComment());
        }
        if (getDomain() != null) {
            b.append("; Domain=");
            StringBuilderUtils.appendQuotedIfWhitespace(b, getDomain());
        }
        if (getPath() != null) {
            b.append("; Path=");
            StringBuilderUtils.appendQuotedIfWhitespace(b, getPath());
        }
        if (getMaxAge() != null) {
            b.append("; Max-Age=");
            b.append(getMaxAge());
        }
        if (isSecure()) {
            b.append("; Secure");
        }
        if (isHttpOnly()) {
            b.append("; HttpOnly");
        }
        if (getSameSite() != null) {
            switch (getSameSite()) {
                case NONE:
                    b.append("; SameSite=None");
                    break;
                case STRICT:
                    b.append("; SameSite=Strict");
                    break;
                case LAX:
                    b.append("; SameSite=Lax");
                    break;
            }
        }
        if (getTtlInEpochSec() != null) {
            b.append("; Expires=");
            b.append(HttpDateFormat.getPreferredDateFormat().format(Date.from(Instant.ofEpochSecond(getTtlInEpochSec()))));
        }
        if (getAdditionalProperties().size() != 0) {
            getAdditionalProperties().forEach((key, value) -> {
                b.append("; ");
                StringBuilderUtils.appendQuotedIfWhitespace(b, key);
                b.append("=");
                StringBuilderUtils.appendQuotedIfWhitespace(b, value);
            });
        }

        return b.toString();
    }

    public static class RealCookieBuilder {
        private static long VERSION = 1;
        private Map<String, String> additionalProperties = Maps.newHashMap();

        public RealCookieBuilder value(@NonNull String value) {
            this.value = value;
            return this;
        }

        public RealCookieBuilder maxAge(Long maxAge) {
            // For backwards compatibility, also set expiry
            if (maxAge != null && maxAge != 0) {
                this.ttlInEpochSec = Instant.now().plus(maxAge, ChronoUnit.SECONDS).getEpochSecond();
            }
            this.maxAge = maxAge;
            return this;
        }

        public RealCookieBuilder addAdditionalProperty(String key, String value) {
            this.additionalProperties.put(key, value);
            return this;
        }

        public RealCookie build() {
            return new RealCookie(name, value, path, VERSION, domain, httpOnly, secure, sameSite, maxAge, ttlInEpochSec, comment, ImmutableMap.copyOf(additionalProperties));
        }
    }
}
