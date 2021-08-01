// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store.impl;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.DeleteObjectsRequest;
import com.amazonaws.services.s3.model.ObjectListing;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.S3ObjectSummary;
import com.google.common.annotations.VisibleForTesting;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.ContentStore;
import com.smotana.clearflask.util.IdUtil;
import lombok.extern.slf4j.Slf4j;

import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
public class S3ContentStore extends ManagedService implements ContentStore {

    private static final String KEY_PREFIX = "img/ugc/";
    private static final Pattern CONTENT_TYPE_URL_MATCHER = Pattern.compile("^(?<scheme>[^:]+)://(?<domain>[^/]+)/(?<key>" + KEY_PREFIX + "(?<projectId>[^/]+)/(?<userId>[^/]+)/(?<fileName>[^?]+\\.(?<extension>[^.?]+)))(?<query>\\?[^#]*)?$");

    public interface Config {
        @DefaultValue("clearflask-upload.s3.amazonaws.com")
        String hostname();

        @DefaultValue("https")
        String scheme();

        @DefaultValue("clearflask-upload")
        String bucketName();

        @DefaultValue("false")
        boolean createBucket();

        @DefaultValue("PT3H")
        Duration presignedUrlExpiry();
    }

    @Inject
    private Config config;
    @Inject
    private AmazonS3 s3;

    @Override
    protected void serviceStart() throws Exception {
        if (config.createBucket()) {
            s3.createBucket(config.bucketName());
        }
    }

    @Override
    public String getScheme() {
        return config.scheme();
    }

    @Override
    public ContentUrl upload(String projectId, String userId, ContentType contentType, InputStream inputStream, int length) {
        ContentUrl contentUrl = generateContentUrl(projectId, userId, contentType);
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(contentType.getMediaType());
        metadata.setContentLength(length);
        s3.putObject(config.bucketName(), contentUrl.getKey(), inputStream, metadata);
        return contentUrl;
    }

    @Override
    public String uploadAndSign(String projectId, String userId, ContentType contentType, InputStream inputStream, int length) {
        ContentUrl contentUrl = upload(projectId, userId, contentType, inputStream, length);
        return signUrl(contentUrl);
    }

    @Override
    public void deleteAsUser(String matchProjectId, String matchUserId, String url) {
        delete(Optional.of(matchProjectId), Optional.of(matchUserId), url);
    }

    @Override
    public void deleteAsAdmin(String matchProjectId, String url) {
        delete(Optional.of(matchProjectId), Optional.empty(), url);
    }

    @Override
    public void delete(String url) {
        delete(Optional.empty(), Optional.empty(), url);
    }

    private void delete(Optional<String> matchProjectIdOpt, Optional<String> matchUserIdOpt, String url) {
        Optional<ContentUrl> contentUrlOpt = parseContentUrl(url);
        if (!contentUrlOpt.isPresent()
                || (matchProjectIdOpt.isPresent() && !matchProjectIdOpt.get().equals(contentUrlOpt.get().getUrl()))
                || (matchUserIdOpt.isPresent() && !matchUserIdOpt.get().equals(contentUrlOpt.get().getUserId()))) {
            return;
        }
        s3.deleteObject(config.bucketName(), contentUrlOpt.get().getKey());
    }

    @Override
    public void deleteAllForUser(String projectId, String userId) {
        deleteAllForPrefix(KEY_PREFIX + projectId + "/" + userId + "/");
    }

    @Override
    public void deleteAllForProject(String projectId) {
        deleteAllForPrefix(KEY_PREFIX + projectId + "/");
    }

    private void deleteAllForPrefix(String prefix) {
        ObjectListing objectListing = s3.listObjects(config.bucketName(), prefix);
        while (true) {
            s3.deleteObjects(new DeleteObjectsRequest(config.bucketName())
                    .withKeys(objectListing.getObjectSummaries().stream()
                            .map(S3ObjectSummary::getKey)
                            .toArray(String[]::new)));
            if (objectListing.isTruncated()) {
                objectListing = s3.listNextBatchOfObjects(objectListing);
            } else {
                break;
            }
        }
    }

    @Override
    public Optional<String> signUrl(String matchProjectId, String url) {
        Optional<ContentUrl> contentUrlOpt = parseContentUrl(url);
        if (!contentUrlOpt.isPresent()
                || !matchProjectId.equals(contentUrlOpt.get().getProjectId())) {
            return Optional.empty();
        }

        return Optional.of(signUrl(contentUrlOpt.get()));
    }

    @Override
    public String signUrl(ContentUrl contentUrl) {
        return s3.generatePresignedUrl(
                config.bucketName(),
                contentUrl.getKey(),
                Date.from(Instant.now().plus(config.presignedUrlExpiry())),
                HttpMethod.GET).toString();
    }

    @Override
    public Optional<ContentUrl> parseContentUrl(String url) {
        Matcher matcher = CONTENT_TYPE_URL_MATCHER.matcher(url);
        if (!matcher.matches()) {
            return Optional.empty();
        }
        String scheme = matcher.group("scheme");
        String domain = matcher.group("domain");
        String key = matcher.group("key");
        String projectId = matcher.group("projectId");
        String userId = matcher.group("userId");
        String fileName = matcher.group("fileName");
        String extension = matcher.group("extension");
        String query = matcher.group("query");
        ContentType contentType = ContentType.EXTENSION_TO_CONTENT_TYPE.getOrDefault(extension, ContentType.UNKNOWN);

        if (!config.scheme().equals(scheme)
                || !config.hostname().equals(domain)) {
            return Optional.empty();
        }

        return Optional.of(new ContentUrl(url, key, fileName, query, projectId, userId, contentType));
    }

    @VisibleForTesting
    public ContentUrl generateContentUrl(String projectId, String userId, ContentType contentType) {
        String fileName = IdUtil.randomId() + "." + contentType.getExtension();
        String key = KEY_PREFIX + projectId + "/" + userId + "/" + fileName;
        String url = config.scheme() + "://" + config.hostname() + "/" + key;

        return new ContentUrl(url, key, fileName, null, projectId, userId, contentType);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ContentStore.class).to(S3ContentStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(S3ContentStore.class);
            }
        };
    }
}
