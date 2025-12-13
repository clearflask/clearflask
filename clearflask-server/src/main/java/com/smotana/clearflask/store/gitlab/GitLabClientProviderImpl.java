// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.gitlab;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.security.limiter.rate.RateLimiter;
import com.smotana.clearflask.util.LogUtil;
import lombok.extern.slf4j.Slf4j;
import org.gitlab4j.api.GitLabApi;
import rx.Observable;

import java.time.Duration;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class GitLabClientProviderImpl implements GitLabClientProvider {

    public interface Config {
        @DefaultValue("true")
        boolean perInstanceRateLimiterEnabled();

        @DefaultValue("PT1H")
        Duration perInstanceRateLimiterPrechargedPeriod();

        Observable<Duration> perInstanceRateLimiterPrechargedPeriodObservable();

        @DefaultValue("PT1H")
        Duration perInstanceRateLimiterCapacity();

        Observable<Duration> perInstanceRateLimiterCapacityObservable();

        @DefaultValue("1")
        double perInstanceRateLimiterQpsBase();

        Observable<Double> perInstanceRateLimiterQpsBaseObservable();
    }

    @Inject
    private Config config;
    @Inject
    private RateLimiter rateLimiter;

    @Inject
    private void setup() {
        Stream.of(
                        config.perInstanceRateLimiterPrechargedPeriodObservable(),
                        config.perInstanceRateLimiterQpsBaseObservable(),
                        config.perInstanceRateLimiterCapacityObservable())
                .forEach(o -> o.subscribe(v -> rateLimiter.clearAll()));
    }

    @Override
    public GitLabClient getClient(String gitlabInstanceUrl, String accessToken) {
        GitLabApi api = new GitLabApi(gitlabInstanceUrl, accessToken);
        return new GitLabClient(
                api,
                () -> actionTryAcquire(gitlabInstanceUrl));
    }

    private boolean actionTryAcquire(String gitlabInstanceUrl) {
        if (!config.perInstanceRateLimiterEnabled()) {
            return true;
        }
        boolean success = rateLimiter.tryAcquire(
                "gitlab-instance-" + gitlabInstanceUrl.hashCode(),
                1,
                config.perInstanceRateLimiterPrechargedPeriod().getSeconds(),
                config.perInstanceRateLimiterQpsBase(),
                config.perInstanceRateLimiterCapacity().getSeconds());
        if (!success && LogUtil.rateLimitAllowLog("gitlab-client-provider-ratelimited")) {
            log.warn("GitLab per-instance rate-limiter kicked in for instance {}", gitlabInstanceUrl);
        }

        return success;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(GitLabClientProvider.class).to(GitLabClientProviderImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
