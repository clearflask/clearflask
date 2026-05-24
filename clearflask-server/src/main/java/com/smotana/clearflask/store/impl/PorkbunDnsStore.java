// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.annotations.SerializedName;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.DnsStore;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

@Slf4j
@Singleton
public class PorkbunDnsStore extends ManagedService implements DnsStore {

    public interface Config {
        @DefaultValue("")
        String apiKey();

        @DefaultValue("")
        String secretApiKey();

        @DefaultValue("https://api.porkbun.com/api/json/v3")
        String baseUrl();

        /**
         * Apex domain managed by this Porkbun account, e.g. "clearflask.com".
         * Hosts passed to upsert/get/delete must be either this exact domain or a
         * subdomain of it; anything else is rejected.
         */
        @DefaultValue("clearflask.com")
        String domain();

        @DefaultValue("600")
        int defaultTtlSeconds();
    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;

    private CloseableHttpClient client;

    @Override
    protected void serviceStart() throws Exception {
        client = HttpClientBuilder.create().build();
    }

    @Override
    protected void serviceStop() throws Exception {
        if (client != null) {
            client.close();
        }
    }

    @Override
    public Optional<String> getTxtRecord(String host) {
        String subdomain = toSubdomain(host);
        RetrieveResponse response = post(
                "/dns/retrieveByNameType/" + config.domain() + "/TXT" + (subdomain.isEmpty() ? "" : "/" + subdomain),
                emptyAuthBody(),
                RetrieveResponse.class);
        if (response.records == null || response.records.isEmpty()) {
            return Optional.empty();
        }
        return response.records.stream()
                .map(r -> r.content)
                .findFirst();
    }

    @Override
    public void upsertTxtRecord(String host, String value) {
        String subdomain = toSubdomain(host);

        // Porkbun "editByNameType" overwrites all records with the same (name,type) tuple,
        // which is what we want for TXT challenge upsert semantics.
        EditBody body = new EditBody();
        body.apikey = config.apiKey();
        body.secretapikey = config.secretApiKey();
        body.content = value;
        body.ttl = String.valueOf(config.defaultTtlSeconds());

        StatusResponse response = post(
                "/dns/editByNameType/" + config.domain() + "/TXT" + (subdomain.isEmpty() ? "" : "/" + subdomain),
                body,
                StatusResponse.class);

        // editByNameType returns failure when no record exists yet; in that case create one.
        if (!"SUCCESS".equalsIgnoreCase(response.status)) {
            CreateBody createBody = new CreateBody();
            createBody.apikey = config.apiKey();
            createBody.secretapikey = config.secretApiKey();
            createBody.name = subdomain;
            createBody.type = "TXT";
            createBody.content = value;
            createBody.ttl = String.valueOf(config.defaultTtlSeconds());
            StatusResponse createResponse = post(
                    "/dns/create/" + config.domain(),
                    createBody,
                    StatusResponse.class);
            if (!"SUCCESS".equalsIgnoreCase(createResponse.status)) {
                throw new RuntimeException("Porkbun create failed for " + host
                        + ": status=" + createResponse.status + " message=" + createResponse.message);
            }
        }
    }

    @Override
    public void deleteTxtRecord(String host, String value) {
        String subdomain = toSubdomain(host);
        StatusResponse response = post(
                "/dns/deleteByNameType/" + config.domain() + "/TXT" + (subdomain.isEmpty() ? "" : "/" + subdomain),
                emptyAuthBody(),
                StatusResponse.class);
        // Porkbun returns ERROR if no record exists — treat as benign on teardown.
        if (!"SUCCESS".equalsIgnoreCase(response.status)) {
            log.info("Porkbun delete for {} returned status={} message={} (continuing)",
                    host, response.status, response.message);
        }
    }

    private String toSubdomain(String host) {
        if (Strings.isNullOrEmpty(host)) {
            throw new IllegalArgumentException("Host must be non-empty");
        }
        String domain = config.domain();
        if (host.equals(domain)) {
            return "";
        }
        if (host.endsWith("." + domain)) {
            return host.substring(0, host.length() - domain.length() - 1);
        }
        throw new IllegalArgumentException("Host " + host + " is not within configured Porkbun domain " + domain);
    }

    private JsonObject emptyAuthBody() {
        JsonObject body = new JsonObject();
        body.addProperty("apikey", config.apiKey());
        body.addProperty("secretapikey", config.secretApiKey());
        return body;
    }

    private <T> T post(String path, Object body, Class<T> responseClass) {
        String url = config.baseUrl() + path;
        HttpPost req = new HttpPost(url);
        req.setEntity(new StringEntity(gson.toJson(body), ContentType.APPLICATION_JSON));
        try (CloseableHttpResponse res = client.execute(req)) {
            int status = res.getStatusLine().getStatusCode();
            String responseBody = res.getEntity() == null
                    ? ""
                    : new String(res.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
            // Porkbun returns 200 with status=SUCCESS on success and 400 with status=ERROR on most failures.
            // Parse the body either way so the caller can decide what to do with non-SUCCESS responses.
            if (status >= 500) {
                throw new RuntimeException("Porkbun call to " + path + " failed with HTTP " + status + ": " + responseBody);
            }
            return gson.fromJson(responseBody, responseClass);
        } catch (IOException ex) {
            throw new RuntimeException("Porkbun call to " + path + " failed", ex);
        }
    }

    private static class CreateBody {
        String apikey;
        String secretapikey;
        String name;
        String type;
        String content;
        String ttl;
    }

    private static class EditBody {
        String apikey;
        String secretapikey;
        String content;
        String ttl;
    }

    private static class StatusResponse {
        String status;
        String message;
    }

    private static class RetrieveResponse {
        String status;
        String message;
        List<RetrievedRecord> records;
    }

    private static class RetrievedRecord {
        String id;
        String name;
        String type;
        String content;
        String ttl;
        @SerializedName("prio")
        String prio;
        String notes;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DnsStore.class).to(PorkbunDnsStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(PorkbunDnsStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
