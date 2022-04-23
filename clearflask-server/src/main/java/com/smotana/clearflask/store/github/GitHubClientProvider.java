// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.github;

import lombok.Value;
import org.kohsuke.github.GitHub;

import java.io.IOException;

public interface GitHubClientProvider {
    GitHub getAppClient() throws IOException;

    GitHub getOauthClient(String accessToken) throws IOException;

    GitHubInstallation getInstallationClient(long installationId) throws IOException;

    @Value
    class GitHubInstallation {
        GitHub client;
        ActionRateLimiter rateLimiter;
    }

    interface ActionRateLimiter {
        boolean tryAcquire();
    }
}
