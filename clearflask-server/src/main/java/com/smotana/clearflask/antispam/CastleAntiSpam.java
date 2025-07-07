// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.antispam;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.UserCreate;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.util.IpUtil;
import io.castle.client.Castle;
import io.castle.client.internal.config.CastleConfiguration;
import io.castle.client.internal.utils.CastleContextBuilder;
import io.castle.client.internal.utils.HeaderNormalizer;
import io.castle.client.model.CastleApiInvalidRequestTokenException;
import io.castle.client.model.CastleHeader;
import io.castle.client.model.CastleHeaders;
import io.castle.client.model.CastleResponse;
import io.castle.client.model.CastleRuntimeException;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.BadRequestException;
import javax.ws.rs.WebApplicationException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.Optional;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class CastleAntiSpam extends ManagedService implements AntiSpam {

    @Getter
    @AllArgsConstructor
    enum FilterType {
        REGISTRATION("$registration"),
        CUSTOM("$custom");
        private final String value;
    }

    /**
     * Matches "castle.tsx"
     */
    public static final String CASTLE_REQUEST_TOKEN_HEADER_NAME = "castle-request-token";

    public interface Config {
        @DefaultValue("false")
        boolean enabled();

        Observable<Boolean> enabledObservable();

        @DefaultValue("none")
        String apiKey();

        Observable<String> apiKeyObservable();

        @DefaultValue("true")
        boolean blockAccountSignupEnabled();

        @DefaultValue("true")
        boolean blockUserSignupEnabled();
    }

    @Inject
    private Environment env;
    @Inject
    private Config config;

    private final HeaderNormalizer headerNormalizer = new HeaderNormalizer();
    private volatile Optional<Castle> castleOpt = Optional.empty();

    @Override
    protected void serviceStart() throws Exception {
        Stream.of(
                config.enabledObservable(),
                config.apiKeyObservable()
        ).forEach(o -> o.subscribe(v -> initCastle()));
        initCastle();
    }

    @SneakyThrows
    private void initCastle() {
        switch (env) {
            case PRODUCTION_SELF_HOST:
            case TEST:
                castleOpt = Optional.empty();
                return;
        }

        if (!config.enabled()) {
            castleOpt = Optional.empty();
            return;
        }

        String apiKey = config.apiKey();
        if (Strings.isNullOrEmpty(apiKey) || "none".equals(apiKey)) {
            log.error("Castle missing API key via config, not initializing");
            castleOpt = Optional.empty();
            return;
        }

        castleOpt = Optional.of(Castle.initialize(Castle.configurationBuilder()
                .apiSecret(apiKey)
                .build()));
    }

    @Override
    public void onUserSignup(HttpServletRequest request, String projectId, UserCreate userCreate) {
        if (!config.enabled()) {
            return;
        }
        Optional<String> emailOpt = Optional.ofNullable(Strings.emptyToNull(userCreate.getEmail()));
        Optional<String> nameOpt = Optional.ofNullable(Strings.emptyToNull(userCreate.getName()));
        String identifier = "user id " + emailOpt.or(() -> nameOpt).orElse("Anonymous")
                + " ip " + IpUtil.getRemoteIp(request, env);
        if (!config.blockUserSignupEnabled()) {
            log.trace("Castle on user signup not enabled, not checking; {}", identifier);
            return;
        }
        onFilter(FilterType.REGISTRATION,
                request,
                "project-" + projectId,
                identifier,
                emailOpt,
                nameOpt);
    }

    @Override
    public void onAccountSignup(HttpServletRequest request, AccountSignupAdmin form) {
        if (!config.enabled()) {
            return;
        }
        String identifier = "account email " + form.getEmail()
                + " ip " + IpUtil.getRemoteIp(request, env);
        if (!config.blockAccountSignupEnabled()) {
            log.trace("Castle on account signup not enabled, not checking; {}", identifier);
            return;
        }
        onFilter(FilterType.REGISTRATION,
                request,
                "clearflask",
                identifier,
                Optional.of(form.getEmail()),
                Optional.of(form.getName()));
    }

    private void onFilter(FilterType type, HttpServletRequest request, String product, String identifier, Optional<String> emailOpt, Optional<String> nameOpt) {
        Castle castle = castleOpt.orElse(null);
        if (castle == null) {
            log.debug("Castle not enabled, not checking sign up; {}", identifier);
            return;
        }
        try {
            String remoteIp = IpUtil.getRemoteIp(request, env);
            CastleHeaders headers = getCastleHeaders(
                    remoteIp,
                    castle.getSdkConfiguration(),
                    request
            );
            ImmutableMap.Builder<String, Object> paramsBuilder = ImmutableMap.builder();
            emailOpt.ifPresent(email -> paramsBuilder.put("email", email));
            nameOpt.ifPresent(name -> paramsBuilder.put("username", name));
            CastleResponse result = castle.client().filter(
                    ImmutableMap.builder()
                            .put(Castle.KEY_REQUEST_TOKEN, Strings.nullToEmpty(request.getHeader(CASTLE_REQUEST_TOKEN_HEADER_NAME)))
                            .put(
                                    Castle.KEY_CONTEXT,
                                    ImmutableMap.builder()
                                            .put(Castle.KEY_IP, remoteIp)
                                            .put(Castle.KEY_HEADERS, headers)
                                            .build()
                            )
                            .put("type", type.value)
                            .put("product", ImmutableMap.of(
                                    "id", product))
                            .put("status", "$attempted")
                            .put("params", paramsBuilder.build())
                            .build()
            );

            if ("deny".equals(result.json().getAsJsonObject().getAsJsonObject("policy").get("action").getAsString())) {
                log.warn("Castle anti-spam blocked signup attempt; {}", identifier);
                throw new BadRequestException();
            }
        } catch (CastleApiInvalidRequestTokenException ex) {
            // Invalid request token is very likely a bad actor bypassing fingerprinting
            log.warn("Invalid request token detected, blocking signup; {}", identifier, ex);
            throw new BadRequestException();
        } catch (CastleRuntimeException ex) {
            // Allow the attempt - most likely a server or timeout error
            log.error("Castle threw exception, allowing signup attempt; {}", identifier, ex);
        } catch (Exception ex) {
            if (ex instanceof WebApplicationException) {
                throw ex;
            }
            log.error("Exception during castle check, allowing signup attempt; {}", identifier, ex);
        }
    }

    /**
     * Based on {@link CastleContextBuilder#setCastleHeadersFromHttpServletRequest} using Javax instead of Jakarta
     */
    private CastleHeaders getCastleHeaders(String resolvedIp, CastleConfiguration configuration, HttpServletRequest request) {
        ArrayList<CastleHeader> castleHeadersList = new ArrayList<>();
        for (Enumeration<String> headerNames = request.getHeaderNames(); headerNames.hasMoreElements(); ) {
            String key = headerNames.nextElement();
            String headerValue = request.getHeader(key);
            addHeaderValue(configuration, castleHeadersList, key, headerValue);
        }
        //A CGI specific header is added for compliance with other castle sdk libraries
        addHeaderValue(configuration, castleHeadersList, "REMOTE_ADDR", resolvedIp);

        CastleHeaders headers = new CastleHeaders();
        headers.setHeaders(castleHeadersList);
        return headers;
    }

    /**
     * Based on {@link CastleContextBuilder#addHeaderValue} using Javax instead of Jakarta
     */
    private void addHeaderValue(CastleConfiguration configuration, ArrayList<CastleHeader> castleHeadersList, String key, String headerValue) {
        String keyNormalized = headerNormalizer.normalize(key);
        if (configuration.getDenyListHeaders().contains(keyNormalized)) {
            // Scrub header since it is denylisted
            castleHeadersList.add(new CastleHeader(key, "true"));
            return;
        }

        // No allowList set, everything is allowListed
        if (configuration.getAllowListHeaders().isEmpty()) {
            castleHeadersList.add(new CastleHeader(key, headerValue));
        } else if (configuration.getAllowListHeaders().contains(keyNormalized)) {
            castleHeadersList.add(new CastleHeader(key, headerValue));
        } else {
            // Add scrubbed header
            castleHeadersList.add(new CastleHeader(key, "true"));
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AntiSpam.class).to(CastleAntiSpam.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(CastleAntiSpam.class).asEagerSingleton();
            }
        };
    }
}
