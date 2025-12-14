// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.gitlab;

import lombok.Value;
import org.gitlab4j.api.GitLabApi;

public interface GitLabClientProvider {

    /**
     * Get a GitLab API client for the specified instance using OAuth access token.
     *
     * @param gitlabInstanceUrl GitLab instance URL (e.g., https://gitlab.com)
     * @param accessToken OAuth access token
     * @return GitLabClient wrapper with rate limiter
     */
    GitLabClient getClient(String gitlabInstanceUrl, String accessToken);

    @Value
    class GitLabClient {
        GitLabApi api;
        ActionRateLimiter rateLimiter;
    }

    interface ActionRateLimiter {
        boolean tryAcquire();
    }
}
