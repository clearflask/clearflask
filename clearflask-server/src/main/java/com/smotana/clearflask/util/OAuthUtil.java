// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.io.CharStreams;
import com.google.gson.Gson;
import com.google.gson.JsonIOException;
import com.google.gson.JsonSyntaxException;
import com.jayway.jsonpath.JsonPathException;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.message.BasicNameValuePair;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Slf4j
public class OAuthUtil {

    @Value
    public static class OAuthResult {
        String guid;
        Optional<String> nameOpt;
        Optional<String> emailOpt;
    }

    public static Optional<OAuthResult> fetch(
            Gson gson,
            String projectId,
            String redirectUrl,
            String tokenUrl,
            String userProfileUrl,
            String guidJsonPath,
            String nameJsonPath,
            String emailUrl,
            String emailJsonPath,
            String clientId,
            String clientSecret,
            String code) {
        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
            HttpPost reqAuthorize = new HttpPost(tokenUrl);
            reqAuthorize.setHeader("Accept", "application/json");
            reqAuthorize.setEntity(new UrlEncodedFormEntity(ImmutableList.of(
                    new BasicNameValuePair("grant_type", "authorization_code"),
                    new BasicNameValuePair("client_id", clientId),
                    new BasicNameValuePair("client_secret", clientSecret),
                    new BasicNameValuePair("redirect_uri", redirectUrl),
                    new BasicNameValuePair("code", code)),
                    Charsets.UTF_8));
            DynamoElasticUserStore.OAuthAuthorizationResponse oAuthAuthorizationResponse;
            try (CloseableHttpResponse res = client.execute(reqAuthorize)) {
                if (res.getStatusLine().getStatusCode() < 200
                        || res.getStatusLine().getStatusCode() > 299) {
                    log.debug("OAuth provider failed authorization, projectId {} url {} response status {}",
                            projectId, reqAuthorize.getURI(), res.getStatusLine().getStatusCode());
                    return Optional.empty();
                }
                try {
                    oAuthAuthorizationResponse = gson.fromJson(new InputStreamReader(res.getEntity().getContent(), StandardCharsets.UTF_8), DynamoElasticUserStore.OAuthAuthorizationResponse.class);
                } catch (JsonSyntaxException | JsonIOException ex) {
                    log.warn("OAuth provider authorization response cannot parse, projectId {} url {} response status {}",
                            projectId, reqAuthorize.getURI(), res.getStatusLine().getStatusCode(), ex);
                    return Optional.empty();
                }
            } catch (IOException ex) {
                log.warn("OAuth provider failed authorizing, projectId {} url {}",
                        projectId, reqAuthorize.getURI(), ex);
                return Optional.empty();
            }

            HttpGet reqProfile = new HttpGet(userProfileUrl);
            reqProfile.addHeader("Authorization", "Bearer " + oAuthAuthorizationResponse.getAccessToken());
            reqProfile.setHeader("Accept", "application/json");
            String profileResponse;
            try (CloseableHttpResponse res = client.execute(reqProfile)) {
                if (res.getStatusLine().getStatusCode() < 200
                        || res.getStatusLine().getStatusCode() > 299) {
                    log.debug("OAuth provider failed profile fetch, projectId {} url {} response status {}",
                            projectId, reqProfile.getURI(), res.getStatusLine().getStatusCode());
                    return Optional.empty();
                }
                profileResponse = CharStreams.toString(new InputStreamReader(
                        res.getEntity().getContent(), Charsets.UTF_8));
                log.trace("OAuth profile url {} returned {} for projectId {}",
                        profileResponse, profileResponse, projectId);
            } catch (IOException ex) {
                log.debug("OAuth provider failed fetching profile, projectId {} url {}",
                        projectId, reqProfile.getURI(), ex);
                return Optional.empty();
            }

            String emailResponse;
            if (!Strings.isNullOrEmpty(emailUrl) && !emailUrl.equals(userProfileUrl)) {
                HttpGet reqEmail = new HttpGet(emailUrl);
                reqEmail.addHeader("Authorization", "Bearer " + oAuthAuthorizationResponse.getAccessToken());
                reqEmail.setHeader("Accept", "application/json");
                try (CloseableHttpResponse res = client.execute(reqEmail)) {
                    if (res.getStatusLine().getStatusCode() < 200
                            || res.getStatusLine().getStatusCode() > 299) {
                        log.debug("OAuth provider failed email fetch, projectId {} url {} response status {}",
                                projectId, reqEmail.getURI(), res.getStatusLine().getStatusCode());
                        return Optional.empty();
                    }
                    emailResponse = CharStreams.toString(new InputStreamReader(
                            res.getEntity().getContent(), Charsets.UTF_8));
                    log.trace("OAuth email url {} returned {} for projectId {}",
                            emailUrl, emailResponse, projectId);
                } catch (IOException ex) {
                    log.debug("OAuth provider failed fetching email, projectId {} url {}",
                            projectId, reqEmail.getURI(), ex);
                    return Optional.empty();
                }
            } else {
                emailResponse = profileResponse;
            }

            try {
                Optional<String> guidOpt = JsonPathUtil.findFirstAsString(guidJsonPath, profileResponse);
                if (guidOpt.isEmpty()) {
                    log.debug("OAuth provider failed parsing guid from profile, projectId {} url {} jsonPath {}",
                            projectId, reqProfile.getURI(), guidJsonPath);
                    return Optional.empty();
                }
                Optional<String> nameOpt = Optional.ofNullable(Strings.emptyToNull(nameJsonPath))
                        .flatMap(jsonPath -> JsonPathUtil.findFirstAsString(jsonPath, profileResponse));
                Optional<String> emailOpt = Optional.ofNullable(Strings.emptyToNull(emailJsonPath))
                        .flatMap(jsonPath -> JsonPathUtil.findFirstAsString(jsonPath, emailResponse));
                return Optional.of(new OAuthResult(guidOpt.get(), nameOpt, emailOpt));
            } catch (JsonPathException ex) {
                log.debug("OAuth provider failed parsing profile, projectId {} url {}",
                        projectId, reqProfile.getURI(), ex);
                return Optional.empty();
            }
        } catch (IOException ex) {
            log.warn("OAuth provider failed, projectId {}",
                    projectId, ex);
            return Optional.empty();
        }
    }
}
