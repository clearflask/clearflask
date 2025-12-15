// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.slack;

import com.slack.api.methods.MethodsClient;
import lombok.Value;

import java.util.Optional;

/**
 * Provides Slack API clients for project integrations.
 */
public interface SlackClientProvider {

    /**
     * Get a Slack MethodsClient for the given project's integration.
     *
     * @param projectId The project ID
     * @return The Slack client wrapped with rate limiter, or empty if no integration configured
     */
    Optional<SlackClientWithRateLimiter> getClient(String projectId);

    /**
     * Get a Slack MethodsClient using the provided access token.
     * Used during OAuth flow before token is stored in project config.
     *
     * @param accessToken The OAuth access token
     * @return The Slack client
     */
    MethodsClient getClientWithToken(String accessToken);

    /**
     * Get OAuth client for token exchange.
     *
     * @return Slack OAuth client
     */
    MethodsClient getOAuthClient();

    /**
     * Get the configured OAuth client ID.
     *
     * @return Client ID
     */
    String getClientId();

    /**
     * Get the configured OAuth client secret.
     *
     * @return Client secret
     */
    String getClientSecret();

    @Value
    class SlackClientWithRateLimiter {
        MethodsClient client;
        ActionRateLimiter rateLimiter;
        String teamId;
        String botUserId;
    }

    interface ActionRateLimiter {
        boolean tryAcquire();
    }

    @Value
    class SlackOAuthResult {
        String accessToken;
        String teamId;
        String teamName;
        String botUserId;
    }
}
