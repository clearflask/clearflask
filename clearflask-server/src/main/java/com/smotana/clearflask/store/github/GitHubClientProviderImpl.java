// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.github;

import com.google.common.base.Strings;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.security.limiter.rate.RateLimiter;
import com.smotana.clearflask.util.CacheUtil;
import com.smotana.clearflask.util.LogUtil;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.kohsuke.github.GHAppInstallationToken;
import org.kohsuke.github.GHPermissionType;
import org.kohsuke.github.GitHub;
import org.kohsuke.github.GitHubBuilder;
import org.kohsuke.github.extras.authorization.JWTTokenProvider;
import rx.Observable;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class GitHubClientProviderImpl implements GitHubClientProvider {

    public interface Config {
        @DefaultValue("140255")
        String appId();

        @DefaultValue("")
        String privateKeyPem();

        @DefaultValue("true")
        boolean perInstallationRateLimiterEnabled();

        @DefaultValue("PT1H")
        Duration perInstallationRateLimiterPrechargedPeriod();

        Observable<Duration> perInstallationRateLimiterPrechargedPeriodObservable();

        @DefaultValue("PT1H")
        Duration perInstallationRateLimiterCapacity();

        Observable<Duration> perInstallationRateLimiterCapacityObservable();

        @DefaultValue("1")
        double perInstallationRateLimiterQpsBase();

        Observable<Double> perInstallationRateLimiterQpsBaseObservable();
    }

    @Inject
    private Config config;
    @Inject
    private RateLimiter rateLimiter;

    private Optional<JWTTokenProvider> jwtTokenProviderOpt = Optional.empty();
    private Optional<GitHub> clientOpt = Optional.empty();
    private LoadingCache<Long, GitHubInstallation> installationCache;

    @Inject
    private void setup() {
        installationCache = CacheBuilder.newBuilder()
                // Expires after one hour
                // https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation
                .expireAfterWrite(Duration.ofMinutes(55L))
                .maximumSize(100L)
                .build(new CacheLoader<>() {
                    @Override
                    public GitHubInstallation load(Long installationId) throws Exception {
                        GHAppInstallationToken installationToken = getAppClient()
                                .getApp()
                                .getInstallationById(installationId)
                                .createToken()
                                .permissions(ImmutableMap.of(
                                        "metadata", GHPermissionType.READ,
                                        "issues", GHPermissionType.WRITE,
                                        "repository_hooks", GHPermissionType.WRITE))
                                .create();
                        if (Instant.now().plus(1L, ChronoUnit.HOURS)
                                .minus(1, ChronoUnit.MINUTES)
                                .isAfter(installationToken.getExpiresAt().toInstant())) {
                            if (LogUtil.rateLimitAllowLog("github-client-provider-expiration-short")) {
                                log.warn("Installation client expiration is shorter than one hour: {}seconds",
                                        Instant.now().until(installationToken.getExpiresAt().toInstant(), ChronoUnit.SECONDS));
                            }
                        }
                        installationToken.getExpiresAt();
                        GitHub client = new GitHubBuilder()
                                .withAppInstallationToken(installationToken.getToken())
                                .build();
                        return new GitHubInstallation(
                                client,
                                () -> actionTryAcquire(installationId));
                    }
                });

        Stream.of(
                        config.perInstallationRateLimiterPrechargedPeriodObservable(),
                        config.perInstallationRateLimiterQpsBaseObservable(),
                        config.perInstallationRateLimiterCapacityObservable())
                .forEach(o -> o.subscribe(v -> rateLimiter.clearAll()));
    }

    @SneakyThrows
    @Override
    public GitHub getAppClient() throws IOException {
        if (clientOpt.isEmpty()) {
            clientOpt = Optional.of(new GitHubBuilder()
                    .withAuthorizationProvider(getAppJwtToken())
                    .build());
        }
        return clientOpt.get();
    }

    @Override
    public GitHub getOauthClient(String accessToken) throws IOException {
        return new GitHubBuilder()
                .withOAuthToken(accessToken)
                .build();
    }

    @SneakyThrows
    @Override
    public GitHubInstallation getInstallationClient(long installationId) throws IOException {
        GitHubInstallation installationClient = CacheUtil.guavaCacheUnwrapException(() ->
                installationCache.getUnchecked(installationId));
        if (!installationClient.getClient().isCredentialValid()) {
            installationCache.invalidate(installationId);
            installationClient = CacheUtil.guavaCacheUnwrapException(() ->
                    installationCache.getUnchecked(installationId));
            if (!installationClient.getClient().isCredentialValid()) {
                if (!installationClient.getClient().isCredentialValid()) {
                    throw new IOException("Client credentials are invalid for installationId " + installationId);
                }
            }
        }
        return installationClient;
    }

    private JWTTokenProvider getAppJwtToken() throws GeneralSecurityException, IOException {
        if (jwtTokenProviderOpt.isEmpty()) {
            Optional<String> pemSingleLineOpt = Optional.ofNullable(Strings.emptyToNull(config.privateKeyPem()));
            if (pemSingleLineOpt.isEmpty()) {
                throw new RuntimeException("GitHub Private key pem missing in configuration");
            }
            String pem = pemSingleLineOpt.get().replaceAll("\\\\n", System.lineSeparator());
            JWTTokenProvider jwtTokenProvider = new JWTTokenProvider(config.appId(), pem);
            jwtTokenProviderOpt = Optional.of(jwtTokenProvider);
        }

        return jwtTokenProviderOpt.get();
    }

    private boolean actionTryAcquire(long installationId) {
        if (!config.perInstallationRateLimiterEnabled()) {
            return true;
        }
        boolean success = rateLimiter.tryAcquire(
                "github-installation-" + installationId,
                1,
                config.perInstallationRateLimiterPrechargedPeriod().getSeconds(),
                config.perInstallationRateLimiterQpsBase(),
                config.perInstallationRateLimiterCapacity().getSeconds());
        if (!success && LogUtil.rateLimitAllowLog("github-client-provider-ratelimited")) {
            log.warn("GitHub per-installation rate-limiter kicked in for installationId {}", installationId);
        }

        return success;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(GitHubClientProvider.class).to(GitHubClientProviderImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
