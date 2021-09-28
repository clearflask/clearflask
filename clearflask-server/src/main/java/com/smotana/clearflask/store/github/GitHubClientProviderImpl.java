// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store.github;

import com.google.common.base.Strings;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.GuavaRateLimiters;
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
import org.kohsuke.github.GitHub;
import org.kohsuke.github.GitHubBuilder;
import org.kohsuke.github.extras.authorization.JWTTokenProvider;
import rx.Observable;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.Duration;
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
    private GuavaRateLimiters guavaRateLimiters;
    @Inject
    private RateLimiter rateLimiter;

    private Optional<JWTTokenProvider> jwtTokenProviderOpt = Optional.empty();
    private LoadingCache<String, GitHub> clientCache;
    private LoadingCache<Long, GitHubInstallation> installationCache;

    @Inject
    private void setup() {
        clientCache = CacheBuilder.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(8L))
                .maximumSize(1L)
                .build(new CacheLoader<>() {
                    @Override
                    public GitHub load(String key) throws Exception {
                        return new GitHubBuilder()
                                .withJwtToken(getAppJwtToken().getEncodedAuthorization())
                                .build();
                    }
                });
        installationCache = CacheBuilder.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(8L))
                .maximumSize(100L)
                .build(new CacheLoader<>() {
                    @Override
                    public GitHubInstallation load(Long installationId) throws Exception {
                        String appInstallationToken = getAppClient()
                                .getApp()
                                .getInstallationById(installationId)
                                .createToken()
                                .create()
                                .getToken();
                        GitHub client = new GitHubBuilder()
                                .withAppInstallationToken(appInstallationToken)
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
        return CacheUtil.guavaCacheUnwrapException(() ->
                clientCache.getUnchecked(config.appId() + config.privateKeyPem()));
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
        return CacheUtil.guavaCacheUnwrapException(() ->
                installationCache.getUnchecked(installationId));
    }

    private JWTTokenProvider getAppJwtToken() throws GeneralSecurityException, IOException {
        if (jwtTokenProviderOpt.isEmpty()) {
            Optional<String> pemSingleLineOpt = Optional.ofNullable(Strings.emptyToNull(config.privateKeyPem()));
            if (pemSingleLineOpt.isEmpty()) {
                throw new RuntimeException("GitHub Private key pem missing in configuration");
            }
            String pem = pemSingleLineOpt.get().replaceAll("\\n", System.lineSeparator());
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
