// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.security.limiter.challenge;

import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.google.gson.annotations.SerializedName;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.util.Extern;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

@Slf4j
@Singleton
public class CaptchaChallenger implements Challenger {
    private enum Version {
        RECAPTCHA_V2
    }

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("true")
        boolean allowOnUnavailable();

        @DefaultValue("https://www.google.com/recaptcha/api/siteverify")
        String recaptchaV2Api();

        @NoDefaultValue
        String siteKey();

        Observable<String> siteKeyObservable();

        @NoDefaultValue
        String secretKey();
    }

    @Value
    class CaptchaChallenge {
        private final Version version;
        private final String challenge;
    }

    @Value
    class CaptchaSolution {
        private final Version version;
        private final String solution;
    }

    @Value
    private class RecaptchaV2Response {
        @SerializedName("success")
        private final boolean success;
        /** timestamp of the challenge load (ISO format yyyy-MM-dd'T'HH:mm:ssZZ) */
        @SerializedName("challenge_ts")
        private final String challengeTs;
        /** the hostname of the site where the reCAPTCHA was solved */
        @SerializedName("hostname")
        private final String hostname;
        /** Optional error codes */
        @SerializedName("error-codes")
        private final ImmutableList<String> errorCodes;

    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;

    private String challenge;

    @Inject
    private void setup() {
        config.siteKeyObservable().subscribe(this::onSiteKeyChanged);
        onSiteKeyChanged(config.siteKey());
    }

    private void onSiteKeyChanged(String siteKey) {
        this.challenge = gson.toJson(new CaptchaChallenge(Version.RECAPTCHA_V2, siteKey));
    }

    @Extern
    @Override
    public String issue(String remoteIp, String target) {
        return challenge;
    }

    @Extern
    @Override
    public boolean verify(String remoteIp, String target, String solutionStr) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return true;
        }

        CaptchaSolution solution;
        try {
            solution = gson.fromJson(solutionStr, CaptchaSolution.class);
        } catch (JsonSyntaxException ex) {
            log.warn("Challenge solution cannot be parsed, given '{}'", solutionStr);
            return false;
        }

        if (!Version.RECAPTCHA_V2.equals(solution.getVersion())) {
            log.warn("Captcha version mismatch, expecting {} received {}", Version.RECAPTCHA_V2, solution.getVersion());
            return false;
        }

        Response response = ClientBuilder.newClient()
                .target(config.recaptchaV2Api())
                .queryParam("secret", config.secretKey())
                .queryParam("response", solution.getSolution())
                .queryParam("remoteip", remoteIp)
                .request(MediaType.APPLICATION_JSON)
                .accept("application/json")
                .get();

        if (response.getStatus() != 200) {
            log.warn("Captcha service returned status {} response {}", response.getStatus(), response);
            return config.allowOnUnavailable();
        }

        String responseStr = response.readEntity(String.class);
        RecaptchaV2Response captchaResponse;
        try {
            captchaResponse = gson.fromJson(responseStr, RecaptchaV2Response.class);
        } catch (JsonSyntaxException ex) {
            log.warn("Captcha service response cannot be parsed, given '{}'", responseStr);
            return config.allowOnUnavailable();
        }

        if (captchaResponse.getErrorCodes() != null
                && (captchaResponse.getErrorCodes().contains("missing-input-secret")
                || captchaResponse.getErrorCodes().contains("invalid-input-secret")
                || captchaResponse.getErrorCodes().contains("bad-request"))) {
            log.warn("Captcha service error codes {} for solution {} ip {}",
                    captchaResponse.getErrorCodes(), solution, remoteIp);
            return config.allowOnUnavailable();
        }

        log.trace("challenge result {} ip {} target {}", captchaResponse, remoteIp, target);

        return captchaResponse.isSuccess();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(Challenger.class).to(CaptchaChallenger.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
