// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.jira;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.security.limiter.rate.RateLimiter;
import com.smotana.clearflask.util.LogUtil;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.HttpEntity;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpPut;
import org.apache.http.client.methods.HttpRequestBase;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.message.BasicNameValuePair;
import org.apache.http.util.EntityUtils;
import rx.Observable;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@Slf4j
@Singleton
public class JiraClientProviderImpl implements JiraClientProvider {

    private static final String JIRA_AUTH_URL = "https://auth.atlassian.com/oauth/token";
    private static final String JIRA_ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
    private static final String JIRA_API_BASE = "https://api.atlassian.com/ex/jira";

    public interface Config {
        @DefaultValue("")
        String clientId();

        @DefaultValue("")
        String clientSecret();

        @DefaultValue("true")
        boolean perCloudRateLimiterEnabled();

        @DefaultValue("PT1H")
        Duration perCloudRateLimiterPrechargedPeriod();

        Observable<Duration> perCloudRateLimiterPrechargedPeriodObservable();

        @DefaultValue("PT1H")
        Duration perCloudRateLimiterCapacity();

        Observable<Duration> perCloudRateLimiterCapacityObservable();

        @DefaultValue("1.5")
        double perCloudRateLimiterQpsBase();

        Observable<Double> perCloudRateLimiterQpsBaseObservable();
    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;
    @Inject
    private RateLimiter rateLimiter;

    private LoadingCache<String, JiraClient> clientCache;
    private CloseableHttpClient sharedHttpClient;

    @Inject
    private void setup() {
        // Initialize shared HTTP client with connection pooling
        sharedHttpClient = HttpClientBuilder.create()
                .setMaxConnTotal(100)
                .setMaxConnPerRoute(20)
                .build();

        clientCache = CacheBuilder.newBuilder()
                .expireAfterWrite(Duration.ofMinutes(55L))
                .maximumSize(100L)
                .build(new CacheLoader<>() {
                    @Override
                    public JiraClient load(String cacheKey) {
                        // Cache key format: cloudId:accessToken
                        String[] parts = cacheKey.split(":", 2);
                        String cloudId = parts[0];
                        String accessToken = parts[1];
                        return new JiraClient(
                                new JiraApiClientImpl(cloudId, accessToken),
                                () -> actionTryAcquire(cloudId));
                    }
                });

        Stream.of(
                        config.perCloudRateLimiterPrechargedPeriodObservable(),
                        config.perCloudRateLimiterQpsBaseObservable(),
                        config.perCloudRateLimiterCapacityObservable())
                .forEach(o -> o.subscribe(v -> rateLimiter.clearAll()));
    }

    @Override
    public OAuthTokens exchangeAuthorizationCode(String code, String redirectUri) throws IOException {
        log.info("Exchanging Jira OAuth authorization code for access token");

        HttpPost request = new HttpPost(JIRA_AUTH_URL);
        request.setHeader("Content-Type", "application/x-www-form-urlencoded");
        request.setEntity(new UrlEncodedFormEntity(ImmutableList.of(
                new BasicNameValuePair("grant_type", "authorization_code"),
                new BasicNameValuePair("client_id", config.clientId()),
                new BasicNameValuePair("client_secret", config.clientSecret()),
                new BasicNameValuePair("code", code),
                new BasicNameValuePair("redirect_uri", redirectUri)),
                Charsets.UTF_8));

        try (CloseableHttpResponse response = sharedHttpClient.execute(request)) {
                int statusCode = response.getStatusLine().getStatusCode();
                String responseBody = EntityUtils.toString(response.getEntity(), Charsets.UTF_8);

                if (statusCode < 200 || statusCode >= 300) {
                    log.error("Jira OAuth token exchange failed: HTTP {} - {}", statusCode, responseBody);
                    throw new IOException("Failed to exchange authorization code: HTTP " + statusCode + " - " + responseBody);
                }

                JsonObject json = gson.fromJson(responseBody, JsonObject.class);
                OAuthTokens tokens = OAuthTokens.builder()
                        .accessToken(json.get("access_token").getAsString())
                        .refreshToken(json.has("refresh_token") ? json.get("refresh_token").getAsString() : null)
                        .expiresIn(json.has("expires_in") ? json.get("expires_in").getAsLong() : 3600)
                        .scope(json.has("scope") ? json.get("scope").getAsString() : null)
                        .build();

                log.info("Successfully exchanged Jira OAuth code: hasRefreshToken={}, expiresIn={}",
                        tokens.getRefreshToken() != null, tokens.getExpiresIn());

                return tokens;
        }
    }

    @Override
    public OAuthTokens refreshAccessToken(String refreshToken) throws IOException {
        log.info("Refreshing Jira OAuth access token");

        HttpPost request = new HttpPost(JIRA_AUTH_URL);
        request.setHeader("Content-Type", "application/x-www-form-urlencoded");
        request.setEntity(new UrlEncodedFormEntity(ImmutableList.of(
                new BasicNameValuePair("grant_type", "refresh_token"),
                new BasicNameValuePair("client_id", config.clientId()),
                new BasicNameValuePair("client_secret", config.clientSecret()),
                new BasicNameValuePair("refresh_token", refreshToken)),
                Charsets.UTF_8));

        try (CloseableHttpResponse response = sharedHttpClient.execute(request)) {
                int statusCode = response.getStatusLine().getStatusCode();
                String responseBody = EntityUtils.toString(response.getEntity(), Charsets.UTF_8);

                if (statusCode < 200 || statusCode >= 300) {
                    log.error("Jira OAuth token refresh failed: HTTP {} - {}", statusCode, responseBody);
                    throw new IOException("Failed to refresh access token: HTTP " + statusCode + " - " + responseBody);
                }

                JsonObject json = gson.fromJson(responseBody, JsonObject.class);
                return OAuthTokens.builder()
                        .accessToken(json.get("access_token").getAsString())
                        .refreshToken(json.has("refresh_token") ? json.get("refresh_token").getAsString() : refreshToken)
                        .expiresIn(json.has("expires_in") ? json.get("expires_in").getAsLong() : 3600)
                        .scope(json.has("scope") ? json.get("scope").getAsString() : null)
                        .build();
        }
    }

    @Override
    public ImmutableList<JiraCloudInstance> getAccessibleResources(String accessToken) throws IOException {
        log.info("Fetching accessible Jira cloud instances");

        HttpGet request = new HttpGet(JIRA_ACCESSIBLE_RESOURCES_URL);
        request.setHeader("Authorization", "Bearer " + accessToken);
        request.setHeader("Accept", "application/json");

        try (CloseableHttpResponse response = sharedHttpClient.execute(request)) {
                int statusCode = response.getStatusLine().getStatusCode();
                String responseBody = EntityUtils.toString(response.getEntity(), Charsets.UTF_8);

                if (statusCode < 200 || statusCode >= 300) {
                    log.error("Jira accessible resources request failed: HTTP {} - {}", statusCode, responseBody);
                    throw new IOException("Failed to get accessible resources: HTTP " + statusCode + " - " + responseBody);
                }

                JsonArray resourcesArray = gson.fromJson(responseBody, JsonArray.class);
                ImmutableList.Builder<JiraCloudInstance> instances = ImmutableList.builder();

                for (JsonElement element : resourcesArray) {
                    JsonObject resource = element.getAsJsonObject();
                    ImmutableList.Builder<String> scopes = ImmutableList.builder();
                    if (resource.has("scopes")) {
                        for (JsonElement scope : resource.getAsJsonArray("scopes")) {
                            scopes.add(scope.getAsString());
                        }
                    }

                    instances.add(JiraCloudInstance.builder()
                            .id(resource.get("id").getAsString())
                            .url(resource.get("url").getAsString())
                            .name(resource.get("name").getAsString())
                            .scopes(scopes.build())
                            .build());
                }

                return instances.build();
        }
    }

    @SneakyThrows
    @Override
    public JiraClient getClient(String cloudId, String accessToken) {
        String cacheKey = cloudId + ":" + accessToken;
        return clientCache.getUnchecked(cacheKey);
    }

    private boolean actionTryAcquire(String cloudId) {
        if (!config.perCloudRateLimiterEnabled()) {
            return true;
        }
        boolean success = rateLimiter.tryAcquire(
                "jira-cloud-" + cloudId,
                1,
                config.perCloudRateLimiterPrechargedPeriod().getSeconds(),
                config.perCloudRateLimiterQpsBase(),
                config.perCloudRateLimiterCapacity().getSeconds());
        if (!success && LogUtil.rateLimitAllowLog("jira-client-provider-ratelimited")) {
            log.warn("Jira per-cloud rate-limiter kicked in for cloudId {}", cloudId);
        }
        return success;
    }

    /**
     * Implementation of JiraApiClient for REST API calls.
     */
    private class JiraApiClientImpl implements JiraApiClient {
        private final String cloudId;
        private final String accessToken;
        private final String baseUrl;

        JiraApiClientImpl(String cloudId, String accessToken) {
            this.cloudId = cloudId;
            this.accessToken = accessToken;
            this.baseUrl = JIRA_API_BASE + "/" + cloudId;
        }

        @Override
        public String getCloudId() {
            return cloudId;
        }

        @Override
        public String getBaseUrl() {
            return baseUrl;
        }

        private <T> T executeRequest(HttpRequestBase request, Class<T> responseClass) throws IOException {
            request.setHeader("Authorization", "Bearer " + accessToken);
            request.setHeader("Accept", "application/json");

            try (CloseableHttpResponse response = sharedHttpClient.execute(request)) {
                int statusCode = response.getStatusLine().getStatusCode();
                String responseBody = response.getEntity() != null
                        ? EntityUtils.toString(response.getEntity(), Charsets.UTF_8)
                        : "";

                if (statusCode < 200 || statusCode >= 300) {
                    log.warn("Jira API request failed, url {}, status {}: {}",
                            request.getURI(), statusCode, responseBody);
                    throw new IOException("Jira API request failed: " + statusCode);
                }

                if (responseClass == Void.class || Strings.isNullOrEmpty(responseBody)) {
                    return null;
                }

                return gson.fromJson(responseBody, responseClass);
            }
        }

        private <T> T executeRequest(HttpRequestBase request, TypeToken<T> typeToken) throws IOException {
            request.setHeader("Authorization", "Bearer " + accessToken);
            request.setHeader("Accept", "application/json");

            try (CloseableHttpResponse response = sharedHttpClient.execute(request)) {
                int statusCode = response.getStatusLine().getStatusCode();
                String responseBody = response.getEntity() != null
                        ? EntityUtils.toString(response.getEntity(), Charsets.UTF_8)
                        : "";

                if (statusCode < 200 || statusCode >= 300) {
                    log.warn("Jira API request failed, url {}, status {}: {}",
                            request.getURI(), statusCode, responseBody);
                    throw new IOException("Jira API request failed: " + statusCode);
                }

                return gson.fromJson(responseBody, typeToken.getType());
            }
        }

        @Override
        public ImmutableList<JiraProject> getProjects() throws IOException {
            HttpGet request = new HttpGet(baseUrl + "/rest/api/3/project");
            JsonArray projectsArray = executeRequest(request, JsonArray.class);

            ImmutableList.Builder<JiraProject> projects = ImmutableList.builder();
            for (JsonElement element : projectsArray) {
                projects.add(parseProject(element.getAsJsonObject()));
            }
            return projects.build();
        }

        @Override
        public JiraProject getProject(String projectKey) throws IOException {
            HttpGet request = new HttpGet(baseUrl + "/rest/api/3/project/" + projectKey);
            JsonObject json = executeRequest(request, JsonObject.class);
            return parseProject(json);
        }

        private JiraProject parseProject(JsonObject json) {
            return JiraProject.builder()
                    .id(json.get("id").getAsString())
                    .key(json.get("key").getAsString())
                    .name(json.get("name").getAsString())
                    .description(json.has("description") && !json.get("description").isJsonNull()
                            ? json.get("description").getAsString() : null)
                    .projectTypeKey(json.has("projectTypeKey") ? json.get("projectTypeKey").getAsString() : null)
                    .avatarUrl(json.has("avatarUrls") && json.getAsJsonObject("avatarUrls").has("48x48")
                            ? json.getAsJsonObject("avatarUrls").get("48x48").getAsString() : null)
                    .build();
        }

        @Override
        public JiraIssue getIssue(String issueKey) throws IOException {
            HttpGet request = new HttpGet(baseUrl + "/rest/api/3/issue/" + issueKey);
            JsonObject json = executeRequest(request, JsonObject.class);
            return parseIssue(json);
        }

        @Override
        public JiraIssue createIssue(CreateIssueRequest createRequest) throws IOException {
            HttpPost request = new HttpPost(baseUrl + "/rest/api/3/issue");
            request.setHeader("Content-Type", "application/json");

            JsonObject fields = new JsonObject();
            JsonObject project = new JsonObject();
            project.addProperty("key", createRequest.getProjectKey());
            fields.add("project", project);

            JsonObject issueType = new JsonObject();
            issueType.addProperty("id", createRequest.getIssueTypeId());
            fields.add("issuetype", issueType);

            fields.addProperty("summary", createRequest.getSummary());

            if (createRequest.getDescription() != null) {
                fields.add("description", gson.fromJson(createRequest.getDescription(), JsonObject.class));
            }

            if (createRequest.getPriorityId() != null) {
                JsonObject priority = new JsonObject();
                priority.addProperty("id", createRequest.getPriorityId());
                fields.add("priority", priority);
            }

            if (createRequest.getCustomFields() != null) {
                for (Map.Entry<String, Object> entry : createRequest.getCustomFields().entrySet()) {
                    fields.add(entry.getKey(), gson.toJsonTree(entry.getValue()));
                }
            }

            JsonObject body = new JsonObject();
            body.add("fields", fields);

            request.setEntity(new StringEntity(gson.toJson(body), Charsets.UTF_8));

            JsonObject response = executeRequest(request, JsonObject.class);
            // The create response only returns id, key, self - fetch full issue
            return getIssue(response.get("key").getAsString());
        }

        @Override
        public JiraIssue updateIssue(String issueKey, UpdateIssueRequest updateRequest) throws IOException {
            HttpPut request = new HttpPut(baseUrl + "/rest/api/3/issue/" + issueKey);
            request.setHeader("Content-Type", "application/json");

            JsonObject fields = new JsonObject();

            if (updateRequest.getSummary() != null) {
                fields.addProperty("summary", updateRequest.getSummary());
            }

            if (updateRequest.getDescription() != null) {
                fields.add("description", gson.fromJson(updateRequest.getDescription(), JsonObject.class));
            }

            if (updateRequest.getPriorityId() != null) {
                JsonObject priority = new JsonObject();
                priority.addProperty("id", updateRequest.getPriorityId());
                fields.add("priority", priority);
            }

            if (updateRequest.getCustomFields() != null) {
                for (Map.Entry<String, Object> entry : updateRequest.getCustomFields().entrySet()) {
                    fields.add(entry.getKey(), gson.toJsonTree(entry.getValue()));
                }
            }

            JsonObject body = new JsonObject();
            body.add("fields", fields);

            request.setEntity(new StringEntity(gson.toJson(body), Charsets.UTF_8));

            executeRequest(request, Void.class);
            return getIssue(issueKey);
        }

        @Override
        public void deleteIssue(String issueKey) throws IOException {
            HttpDelete request = new HttpDelete(baseUrl + "/rest/api/3/issue/" + issueKey);
            executeRequest(request, Void.class);
        }

        @Override
        public void transitionIssue(String issueKey, String transitionId) throws IOException {
            HttpPost request = new HttpPost(baseUrl + "/rest/api/3/issue/" + issueKey + "/transitions");
            request.setHeader("Content-Type", "application/json");

            JsonObject transition = new JsonObject();
            transition.addProperty("id", transitionId);

            JsonObject body = new JsonObject();
            body.add("transition", transition);

            request.setEntity(new StringEntity(gson.toJson(body), Charsets.UTF_8));
            executeRequest(request, Void.class);
        }

        @Override
        public ImmutableList<JiraTransition> getTransitions(String issueKey) throws IOException {
            HttpGet request = new HttpGet(baseUrl + "/rest/api/3/issue/" + issueKey + "/transitions");
            JsonObject response = executeRequest(request, JsonObject.class);

            ImmutableList.Builder<JiraTransition> transitions = ImmutableList.builder();
            for (JsonElement element : response.getAsJsonArray("transitions")) {
                JsonObject t = element.getAsJsonObject();
                JiraStatus toStatus = null;
                if (t.has("to")) {
                    JsonObject to = t.getAsJsonObject("to");
                    toStatus = parseStatus(to);
                }
                transitions.add(JiraTransition.builder()
                        .id(t.get("id").getAsString())
                        .name(t.get("name").getAsString())
                        .to(toStatus)
                        .build());
            }
            return transitions.build();
        }

        @Override
        public ImmutableList<JiraComment> getComments(String issueKey) throws IOException {
            HttpGet request = new HttpGet(baseUrl + "/rest/api/3/issue/" + issueKey + "/comment");
            JsonObject response = executeRequest(request, JsonObject.class);

            ImmutableList.Builder<JiraComment> comments = ImmutableList.builder();
            for (JsonElement element : response.getAsJsonArray("comments")) {
                comments.add(parseComment(element.getAsJsonObject()));
            }
            return comments.build();
        }

        @Override
        public JiraComment addComment(String issueKey, String body) throws IOException {
            HttpPost request = new HttpPost(baseUrl + "/rest/api/3/issue/" + issueKey + "/comment");
            request.setHeader("Content-Type", "application/json");

            JsonObject requestBody = new JsonObject();
            requestBody.add("body", gson.fromJson(body, JsonObject.class));

            request.setEntity(new StringEntity(gson.toJson(requestBody), Charsets.UTF_8));

            JsonObject response = executeRequest(request, JsonObject.class);
            return parseComment(response);
        }

        @Override
        public JiraComment updateComment(String issueKey, String commentId, String body) throws IOException {
            HttpPut request = new HttpPut(baseUrl + "/rest/api/3/issue/" + issueKey + "/comment/" + commentId);
            request.setHeader("Content-Type", "application/json");

            JsonObject requestBody = new JsonObject();
            requestBody.add("body", gson.fromJson(body, JsonObject.class));

            request.setEntity(new StringEntity(gson.toJson(requestBody), Charsets.UTF_8));

            JsonObject response = executeRequest(request, JsonObject.class);
            return parseComment(response);
        }

        @Override
        public void deleteComment(String issueKey, String commentId) throws IOException {
            HttpDelete request = new HttpDelete(baseUrl + "/rest/api/3/issue/" + issueKey + "/comment/" + commentId);
            executeRequest(request, Void.class);
        }

        @Override
        public JiraWebhookRegistration registerWebhook(RegisterWebhookRequest webhookRequest) throws IOException {
            HttpPost request = new HttpPost(baseUrl + "/rest/api/3/webhook");
            request.setHeader("Content-Type", "application/json");

            JsonObject requestBody = new JsonObject();
            requestBody.addProperty("url", webhookRequest.getUrl());
            requestBody.add("webhooks", createWebhookArray(webhookRequest));

            String requestBodyJson = gson.toJson(requestBody);
            log.info("Registering Jira webhook with payload: {}", requestBodyJson);
            request.setEntity(new StringEntity(requestBodyJson, Charsets.UTF_8));

            JsonObject response = executeRequest(request, JsonObject.class);
            log.info("Jira webhook registration response: {}", gson.toJson(response));
            JsonArray webhooks = response.getAsJsonArray("webhookRegistrationResult");
            if (webhooks != null && webhooks.size() > 0) {
                JsonObject webhook = webhooks.get(0).getAsJsonObject();
                log.info("First webhook in response: {}", gson.toJson(webhook));

                // The field might be "createdWebhookId" or just "id" depending on API version
                JsonElement webhookIdElement = webhook.get("createdWebhookId");
                if (webhookIdElement == null) {
                    webhookIdElement = webhook.get("id");
                }
                if (webhookIdElement == null) {
                    log.error("Webhook response missing both 'createdWebhookId' and 'id' fields. Response: {}", gson.toJson(webhook));
                    throw new IOException("Webhook response missing webhook ID field");
                }

                return JiraWebhookRegistration.builder()
                        .id(webhookIdElement.getAsString())
                        .url(webhookRequest.getUrl())
                        .events(ImmutableList.copyOf(webhookRequest.getEvents()))
                        .name(webhookRequest.getName())
                        .enabled(true)
                        .build();
            }
            log.error("Failed to register webhook - empty or null webhookRegistrationResult. Full response: {}", gson.toJson(response));
            throw new IOException("Failed to register webhook");
        }

        private JsonArray createWebhookArray(RegisterWebhookRequest request) {
            JsonArray webhooks = new JsonArray();
            JsonObject webhook = new JsonObject();

            JsonArray events = new JsonArray();
            for (String event : request.getEvents()) {
                events.add(event);
            }
            webhook.add("events", events);

            // Jira Cloud REST API v3 webhook structure:
            // The API expects only events array, no jqlFilter support in v3
            // For project filtering, Jira recommends using the old webhooks/1.0 API
            // or filtering in the webhook handler

            webhooks.add(webhook);
            return webhooks;
        }

        @Override
        public void deleteWebhook(String webhookId) throws IOException {
            HttpDelete request = new HttpDelete(baseUrl + "/rest/api/3/webhook");
            request.setHeader("Content-Type", "application/json");

            JsonObject body = new JsonObject();
            JsonArray webhookIds = new JsonArray();
            webhookIds.add(Long.parseLong(webhookId));
            body.add("webhookIds", webhookIds);

            // DELETE with body requires special handling
            // Jira uses POST with _method=DELETE or specific endpoint
            // For now, use the bulk delete endpoint
            HttpPost deleteRequest = new HttpPost(baseUrl + "/rest/api/3/webhook");
            deleteRequest.setHeader("Content-Type", "application/json");
            deleteRequest.setEntity(new StringEntity(gson.toJson(body), Charsets.UTF_8));

            // Actually Jira uses DELETE /rest/webhooks/1.0/webhook/{webhookId}
            String webhookDeleteUrl = baseUrl + "/rest/webhooks/1.0/webhook/" + webhookId;
            HttpDelete actualDelete = new HttpDelete(webhookDeleteUrl);
            executeRequest(actualDelete, Void.class);
        }

        @Override
        public ImmutableList<JiraWebhookRegistration> getWebhooks() throws IOException {
            HttpGet request = new HttpGet(baseUrl + "/rest/webhooks/1.0/webhook");
            JsonArray response = executeRequest(request, JsonArray.class);

            ImmutableList.Builder<JiraWebhookRegistration> webhooks = ImmutableList.builder();
            for (JsonElement element : response) {
                JsonObject w = element.getAsJsonObject();
                ImmutableList.Builder<String> events = ImmutableList.builder();
                if (w.has("events")) {
                    for (JsonElement e : w.getAsJsonArray("events")) {
                        events.add(e.getAsString());
                    }
                }
                webhooks.add(JiraWebhookRegistration.builder()
                        .id(w.get("self").getAsString().substring(w.get("self").getAsString().lastIndexOf('/') + 1))
                        .url(w.has("url") ? w.get("url").getAsString() : "")
                        .events(events.build())
                        .name(w.has("name") ? w.get("name").getAsString() : null)
                        .enabled(w.has("enabled") && w.get("enabled").getAsBoolean())
                        .build());
            }
            return webhooks.build();
        }

        @Override
        public ImmutableList<JiraIssueType> getIssueTypes(String projectKey) throws IOException {
            HttpGet request = new HttpGet(baseUrl + "/rest/api/3/project/" + projectKey + "/statuses");
            JsonArray response = executeRequest(request, JsonArray.class);

            ImmutableList.Builder<JiraIssueType> issueTypes = ImmutableList.builder();
            for (JsonElement element : response) {
                JsonObject it = element.getAsJsonObject();
                issueTypes.add(JiraIssueType.builder()
                        .id(it.get("id").getAsString())
                        .name(it.get("name").getAsString())
                        .description(it.has("description") ? it.get("description").getAsString() : null)
                        .subtask(it.has("subtask") && it.get("subtask").getAsBoolean())
                        .iconUrl(it.has("iconUrl") ? it.get("iconUrl").getAsString() : null)
                        .build());
            }
            return issueTypes.build();
        }

        @Override
        public ImmutableList<JiraStatus> getStatuses(String projectKey) throws IOException {
            HttpGet request = new HttpGet(baseUrl + "/rest/api/3/project/" + projectKey + "/statuses");
            JsonArray response = executeRequest(request, JsonArray.class);

            ImmutableList.Builder<JiraStatus> statuses = ImmutableList.builder();
            for (JsonElement element : response) {
                JsonObject issueType = element.getAsJsonObject();
                if (issueType.has("statuses")) {
                    for (JsonElement statusElement : issueType.getAsJsonArray("statuses")) {
                        statuses.add(parseStatus(statusElement.getAsJsonObject()));
                    }
                }
            }
            return statuses.build();
        }

        private JiraIssue parseIssue(JsonObject json) {
            JsonObject fields = json.getAsJsonObject("fields");

            JiraStatus status = null;
            if (fields.has("status") && !fields.get("status").isJsonNull()) {
                status = parseStatus(fields.getAsJsonObject("status"));
            }

            JiraIssueType issueType = null;
            if (fields.has("issuetype") && !fields.get("issuetype").isJsonNull()) {
                JsonObject it = fields.getAsJsonObject("issuetype");
                issueType = JiraIssueType.builder()
                        .id(it.get("id").getAsString())
                        .name(it.get("name").getAsString())
                        .description(it.has("description") && !it.get("description").isJsonNull()
                                ? it.get("description").getAsString() : null)
                        .subtask(it.has("subtask") && it.get("subtask").getAsBoolean())
                        .iconUrl(it.has("iconUrl") ? it.get("iconUrl").getAsString() : null)
                        .build();
            }

            JiraPriority priority = null;
            if (fields.has("priority") && !fields.get("priority").isJsonNull()) {
                JsonObject p = fields.getAsJsonObject("priority");
                priority = JiraPriority.builder()
                        .id(p.get("id").getAsString())
                        .name(p.get("name").getAsString())
                        .iconUrl(p.has("iconUrl") ? p.get("iconUrl").getAsString() : null)
                        .build();
            }

            JiraUser reporter = null;
            if (fields.has("reporter") && !fields.get("reporter").isJsonNull()) {
                reporter = parseUser(fields.getAsJsonObject("reporter"));
            }

            JiraUser assignee = null;
            if (fields.has("assignee") && !fields.get("assignee").isJsonNull()) {
                assignee = parseUser(fields.getAsJsonObject("assignee"));
            }

            String description = null;
            if (fields.has("description") && !fields.get("description").isJsonNull()) {
                description = gson.toJson(fields.get("description"));
            }

            return JiraIssue.builder()
                    .id(json.get("id").getAsString())
                    .key(json.get("key").getAsString())
                    .self(json.get("self").getAsString())
                    .summary(fields.has("summary") && !fields.get("summary").isJsonNull()
                            ? fields.get("summary").getAsString() : null)
                    .description(description)
                    .status(status)
                    .issueType(issueType)
                    .priority(priority)
                    .reporter(reporter)
                    .assignee(assignee)
                    .created(fields.has("created") ? fields.get("created").getAsString() : null)
                    .updated(fields.has("updated") ? fields.get("updated").getAsString() : null)
                    .build();
        }

        private JiraComment parseComment(JsonObject json) {
            JiraUser author = null;
            if (json.has("author") && !json.get("author").isJsonNull()) {
                author = parseUser(json.getAsJsonObject("author"));
            }

            String body = null;
            if (json.has("body") && !json.get("body").isJsonNull()) {
                body = gson.toJson(json.get("body"));
            }

            return JiraComment.builder()
                    .id(json.get("id").getAsString())
                    .self(json.get("self").getAsString())
                    .body(body)
                    .author(author)
                    .created(json.has("created") ? json.get("created").getAsString() : null)
                    .updated(json.has("updated") ? json.get("updated").getAsString() : null)
                    .build();
        }

        private JiraUser parseUser(JsonObject json) {
            return JiraUser.builder()
                    .accountId(json.get("accountId").getAsString())
                    .displayName(json.has("displayName") ? json.get("displayName").getAsString() : null)
                    .emailAddress(json.has("emailAddress") ? json.get("emailAddress").getAsString() : null)
                    .avatarUrl(json.has("avatarUrls") && json.getAsJsonObject("avatarUrls").has("48x48")
                            ? json.getAsJsonObject("avatarUrls").get("48x48").getAsString() : null)
                    .build();
        }

        private JiraStatus parseStatus(JsonObject json) {
            String statusCategory = null;
            if (json.has("statusCategory") && !json.get("statusCategory").isJsonNull()) {
                JsonObject sc = json.getAsJsonObject("statusCategory");
                statusCategory = sc.has("key") ? sc.get("key").getAsString() : null;
            }

            return JiraStatus.builder()
                    .id(json.get("id").getAsString())
                    .name(json.get("name").getAsString())
                    .description(json.has("description") && !json.get("description").isJsonNull()
                            ? json.get("description").getAsString() : null)
                    .statusCategory(statusCategory)
                    .build();
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(JiraClientProvider.class).to(JiraClientProviderImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
