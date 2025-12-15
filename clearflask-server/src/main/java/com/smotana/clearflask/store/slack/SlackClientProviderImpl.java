// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.slack;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.slack.api.Slack;
import com.slack.api.methods.MethodsClient;
import com.smotana.clearflask.security.limiter.rate.RateLimiter;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.util.LogUtil;
import lombok.extern.slf4j.Slf4j;
import rx.Observable;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ExecutionException;

@Slf4j
@Singleton
public class SlackClientProviderImpl implements SlackClientProvider {

    public interface Config {
        /**
         * Slack OAuth Client ID for the ClearFlask Slack App
         */
        @DefaultValue("")
        String clientId();

        /**
         * Slack OAuth Client Secret for the ClearFlask Slack App
         */
        @DefaultValue("")
        String clientSecret();

        /**
         * Signing secret for verifying Slack webhook requests
         */
        @DefaultValue("")
        String signingSecret();

        @DefaultValue("true")
        boolean perTeamRateLimiterEnabled();

        @DefaultValue("PT1H")
        Duration perTeamRateLimiterPrechargedPeriod();

        Observable<Duration> perTeamRateLimiterPrechargedPeriodObservable();

        @DefaultValue("PT1H")
        Duration perTeamRateLimiterCapacity();

        Observable<Duration> perTeamRateLimiterCapacityObservable();

        /**
         * Slack's rate limit is typically 1 request per second for most API methods
         */
        @DefaultValue("1")
        double perTeamRateLimiterQpsBase();

        Observable<Double> perTeamRateLimiterQpsBaseObservable();
    }

    @Inject
    private Config config;
    @Inject
    private RateLimiter rateLimiter;
    @Inject
    private ProjectStore projectStore;

    private final Slack slack = Slack.getInstance();

    private LoadingCache<String, Optional<SlackClientWithRateLimiter>> clientCache;

    @Inject
    private void setup() {
        clientCache = CacheBuilder.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(15L))
                .maximumSize(100L)
                .build(new CacheLoader<>() {
                    @Override
                    public Optional<SlackClientWithRateLimiter> load(String projectId) {
                        Optional<ProjectStore.Project> projectOpt = projectStore.getProject(projectId, true);
                        if (projectOpt.isEmpty()) {
                            return Optional.empty();
                        }

                        com.smotana.clearflask.api.model.Slack slackConfig = projectOpt.get().getVersionedConfigAdmin().getConfig().getSlack();
                        if (slackConfig == null || slackConfig.getAccessToken() == null) {
                            return Optional.empty();
                        }

                        MethodsClient client = slack.methods(slackConfig.getAccessToken());
                        String teamId = slackConfig.getTeamId();
                        String botUserId = slackConfig.getBotUserId();

                        return Optional.of(new SlackClientWithRateLimiter(
                                client,
                                () -> actionTryAcquire(teamId),
                                teamId,
                                botUserId));
                    }
                });

        // Clear cache when rate limiter config changes
        java.util.stream.Stream.of(
                        config.perTeamRateLimiterPrechargedPeriodObservable(),
                        config.perTeamRateLimiterQpsBaseObservable(),
                        config.perTeamRateLimiterCapacityObservable())
                .forEach(o -> o.subscribe(v -> rateLimiter.clearAll()));
    }

    @Override
    public Optional<SlackClientWithRateLimiter> getClient(String projectId) {
        try {
            return clientCache.get(projectId);
        } catch (ExecutionException e) {
            log.warn("Failed to get Slack client for project {}", projectId, e);
            return Optional.empty();
        }
    }

    @Override
    public MethodsClient getClientWithToken(String accessToken) {
        return slack.methods(accessToken);
    }

    /**
     * Invalidate the cached client for a project.
     * Call this when the Slack configuration changes.
     */
    public void invalidateClient(String projectId) {
        clientCache.invalidate(projectId);
    }

    private boolean actionTryAcquire(String teamId) {
        if (!config.perTeamRateLimiterEnabled()) {
            return true;
        }
        boolean success = rateLimiter.tryAcquire(
                "slack-team-" + teamId,
                1,
                config.perTeamRateLimiterPrechargedPeriod().getSeconds(),
                config.perTeamRateLimiterQpsBase(),
                config.perTeamRateLimiterCapacity().getSeconds());
        if (!success && LogUtil.rateLimitAllowLog("slack-client-provider-ratelimited")) {
            log.warn("Slack per-team rate-limiter kicked in for teamId {}", teamId);
        }
        return success;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(SlackClientProvider.class).to(SlackClientProviderImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
