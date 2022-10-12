// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.io.CharStreams;
import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.gson.JsonSyntaxException;
import com.google.gson.annotations.SerializedName;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ApiException;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URLEncoder;
import java.util.Optional;

@Slf4j
@Singleton
public class CheckMailOrgEmailValidator extends ManagedService implements EmailValidator {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("https://mailcheck.p.rapidapi.com/?domain=")
        String endpointPrefix();

        @DefaultValue("mailcheck.p.rapidapi.com")
        String rapidApiHost();

        @DefaultValue("")
        String apiKey();
    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;

    private CloseableHttpClient client;

    @Override
    protected void serviceStart() throws Exception {
        client = HttpClientBuilder.create().build();
    }

    @Override
    protected void serviceStop() throws Exception {
        if (client != null) {
            client.close();
        }
    }

    @Extern
    @Override
    public void assertValid(String email) throws ApiException {
        if (!config.enabled()) {
            return;
        }
        if (Strings.isNullOrEmpty(config.apiKey())) {
            log.warn("Could not check email validity, api key not set");
            return;
        }

        EmailValidResult result = checkValid(email);

        if (EmailValidResult.VALID.equals(result)) {
            return;
        }

        if (EmailValidResult.DISPOSABLE.equals(result)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Email is disposable! Please contact support if this is a mistake");
        }

        if (EmailValidResult.INVALID.equals(result)) {
            throw new ApiException(Response.Status.BAD_REQUEST, "Email is invalid! Please contact support if this is a mistake");
        }

        if (LogUtil.rateLimitAllowLog("CheckMailOrgEmailValidator-unknown-result")) {
            log.warn("Unknown result {} for email {}", result, email);
        }
    }

    @Extern
    @Override
    public EmailValidResult checkValid(String email) {
        if (!config.enabled()) {
            return EmailValidResult.VALID;
        }
        if (Strings.isNullOrEmpty(config.apiKey())) {
            log.warn("Could not check email validity, api key not set");
            return EmailValidResult.VALID;
        }

        try {
            Optional<String> domainOpt = getDomain(email);
            if (domainOpt.isEmpty()) {
                return EmailValidResult.INVALID;
            }

            String domainEscaped = URLEncoder.encode(domainOpt.get(), Charsets.UTF_8);

            HttpGet req = new HttpGet(
                    config.endpointPrefix()
                            + domainEscaped);
            req.setHeader("x-rapidapi-host", config.rapidApiHost());
            req.setHeader("x-rapidapi-key", config.apiKey());
            String responseStr;
            try (CloseableHttpResponse res = client.execute(req)) {
                if (res.getStatusLine().getStatusCode() < 200
                        || res.getStatusLine().getStatusCode() > 299) {
                    if (LogUtil.rateLimitAllowLog("CheckMailOrgEmailValidator-non-200")) {
                        log.warn("API returned non 200 result for email {}, status {}",
                                email, res.getStatusLine().getStatusCode());
                    }
                    return EmailValidResult.VALID;
                }
                responseStr = CharStreams.toString(new InputStreamReader(
                        res.getEntity().getContent(), Charsets.UTF_8));
            } catch (IOException ex) {
                if (LogUtil.rateLimitAllowLog("CheckMailOrgEmailValidator-ioexc")) {
                    log.warn("Failed to check email {} with io exception", email, ex);
                }
                return EmailValidResult.VALID;
            }

            CheckMailResponse response;
            try {
                response = gson.fromJson(responseStr, CheckMailResponse.class);
            } catch (JsonSyntaxException ex) {
                if (LogUtil.rateLimitAllowLog("CheckMailOrgEmailValidator-invalid-response")) {
                    log.warn("Failed to parse response for email {}: {}", email, responseStr, ex);
                }
                return EmailValidResult.VALID;
            }

            if (response.disposable) {
                log.info("Denying email as disposable, email {} reason {}",
                        email, response.reason);
                return EmailValidResult.DISPOSABLE;
            }
            if (!response.valid || response.block) {
                log.info("Denying email as invalid, email {} reason {}",
                        email, response.reason);
                return EmailValidResult.INVALID;
            }
            return EmailValidResult.VALID;
        } catch (Exception ex) {
            if (LogUtil.rateLimitAllowLog("CheckMailOrgEmailValidator-failed-processing")) {
                log.warn("Failed to proces email {}", email, ex);
            }
            return EmailValidResult.VALID;
        }
    }

    private Optional<String> getDomain(String email) {
        if (Strings.isNullOrEmpty(email)) {
            return Optional.empty();
        }

        int atIndex = email.indexOf("@");
        if (atIndex == -1) {
            return Optional.empty();
        }

        String domain = email.substring(atIndex + 1).trim();

        if (Strings.isNullOrEmpty(domain)) {
            return Optional.empty();
        }

        return Optional.of(domain);
    }

    /**
     * API definition
     *
     * https://check-mail.org/get-started/
     * https://rapidapi.com/Top-Rated/api/e-mail-check-invalid-or-disposable-domain
     */
    @Value
    private static class CheckMailResponse {
        @GsonNonNull
        @SerializedName("valid")
        boolean valid;

        @GsonNonNull
        @SerializedName("block")
        boolean block;

        @GsonNonNull
        @SerializedName("disposable")
        boolean disposable;

        @SerializedName("reason")
        String reason;

        // Remainder left out as it is not needed
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(EmailValidator.class).to(CheckMailOrgEmailValidator.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(CheckMailOrgEmailValidator.class).asEagerSingleton();
            }
        };
    }
}
