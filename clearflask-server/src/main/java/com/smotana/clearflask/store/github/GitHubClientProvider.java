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
