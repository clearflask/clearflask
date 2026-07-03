// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.s3.Headers;
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
import com.smotana.clearflask.web.Application;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Comparator;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A {@link ContentStore} that keeps uploaded content on the local filesystem instead of S3.
 *
 * Intended for the lean self-host stack (no localstack). Local disk is not publicly reachable, so
 * content is always served back through the same {@code /api/.../content/proxy/...} endpoint the S3
 * store uses in proxy mode; {@link #signUrl(ContentUrl)} therefore always returns a proxy URL.
 *
 * Persisted content URLs use the same {@code scheme://hostname/img/ugc/...} shape and key layout as
 * {@link S3ContentStore} so URL parsing stays consistent across a switch between the two stores.
 */
@Slf4j
public class LocalDiskContentStore extends ManagedService implements ContentStore {

    private static final String KEY_PREFIX = "img/ugc/";
    private static final Pattern CONTENT_TYPE_URL_MATCHER_S3 = Pattern.compile("^(?<scheme>[^:]+)://(?<domain>[^/]+)/" + KEY_PREFIX + "(?<projectId>[^/]+)/(?<userId>[^/]+)/(?<fileName>[^?]+\\.(?<extension>[^.?]+))(?<query>\\?[^#]*)?$");
    private static final Pattern CONTENT_TYPE_URL_MATCHER_PROXY = Pattern.compile("^(?<scheme>[^:]+)://(?<domain>[^/]+)/api" + Application.RESOURCE_VERSION + "/project/(?<projectId>[^/]+)/content/proxy/userId/(?<userId>[^/]+)/file/(?<fileName>[^?]+\\.(?<extension>[^.?]+))(?<query>\\?[^#]*)?$");
    /** Reject any path segment that could escape the base directory or nest into subdirectories. */
    private static final Pattern SAFE_SEGMENT = Pattern.compile("[A-Za-z0-9._-]+");

    public interface Config {
        @DefaultValue("/opt/clearflask/content")
        String baseDir();

        /** Only used to form the stored content URL; never resolved over the network. */
        @DefaultValue("content.clearflask.selfhost")
        String hostname();

        @DefaultValue("https")
        String scheme();
    }

    @Inject
    private Application.Config configApp;
    @Inject
    private Config config;

    @Override
    protected void serviceStart() throws Exception {
        Files.createDirectories(baseDirPath());
    }

    @Override
    public String getScheme() {
        return config.scheme();
    }

    @Override
    public ContentUrl upload(String projectId, String userId, ContentType contentType, InputStream inputStream, int length) {
        return upload(projectId, userId, contentType, inputStream, length,
                IdUtil.randomId() + "." + contentType.getExtension());
    }

    @Override
    @SneakyThrows
    public ContentUrl upload(String projectId, String userId, ContentType contentType, InputStream inputStream, int length, String fileName) {
        ContentUrl contentUrl = generateContentUrl(projectId, userId, contentType, fileName);
        Path filePath = resolveKeyToPath(contentUrl.getKey());
        Files.createDirectories(filePath.getParent());
        try (InputStream in = inputStream) {
            Files.copy(in, filePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        return contentUrl;
    }

    @Override
    public String uploadAndSign(String projectId, String userId, ContentType contentType, InputStream inputStream, int length) {
        return signUrl(upload(projectId, userId, contentType, inputStream, length));
    }

    @Override
    public String uploadAndSign(String projectId, String userId, ContentType contentType, InputStream inputStream, int length, String fileName) {
        return signUrl(upload(projectId, userId, contentType, inputStream, length, fileName));
    }

    @Override
    public void proxy(String projectId, String userId, String object, String xAmzSecurityToken, String xAmzAlgorithm, String xAmzDate, String xAmzSignedHeaders, String xAmzExpires, String xAmzCredential, String xAmzSignature) throws WebApplicationException {
        // xAmz* signing params are meaningless for local disk and intentionally ignored.
        Path filePath = resolveKeyToPath(getContentKey(projectId, userId, object));
        if (!Files.isRegularFile(filePath)) {
            throw new WebApplicationException(Response.Status.NOT_FOUND);
        }
        byte[] bytes;
        try {
            bytes = Files.readAllBytes(filePath);
        } catch (IOException ex) {
            log.info("Failed to read local content projectId {} userId {} object {}", projectId, userId, object, ex);
            throw new WebApplicationException(Response.Status.NOT_FOUND);
        }
        throw new WebApplicationException(Response
                .status(Response.Status.OK)
                .entity(bytes)
                .header(Headers.CONTENT_TYPE, contentTypeForFileName(object).getMediaType())
                .header(Headers.CONTENT_LENGTH, bytes.length)
                .build());
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

    @SneakyThrows
    private void delete(Optional<String> matchProjectIdOpt, Optional<String> matchUserIdOpt, String url) {
        Optional<ContentUrl> contentUrlOpt = parseContentUrl(url);
        if (!contentUrlOpt.isPresent()
                || (matchProjectIdOpt.isPresent() && !matchProjectIdOpt.get().equals(contentUrlOpt.get().getProjectId()))
                || (matchUserIdOpt.isPresent() && !matchUserIdOpt.get().equals(contentUrlOpt.get().getUserId()))) {
            return;
        }
        Files.deleteIfExists(resolveKeyToPath(contentUrlOpt.get().getKey()));
    }

    @Override
    public void deleteAllForUser(String projectId, String userId) {
        deleteRecursively(resolveKeyToPath(KEY_PREFIX + safe(projectId) + "/" + safe(userId)));
    }

    @Override
    public void deleteAllForProject(String projectId) {
        deleteRecursively(resolveKeyToPath(KEY_PREFIX + safe(projectId)));
    }

    @SneakyThrows
    private void deleteRecursively(Path dir) {
        if (!Files.exists(dir)) {
            return;
        }
        try (java.util.stream.Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ex) {
                    log.warn("Failed to delete {}", path, ex);
                }
            });
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
    @SneakyThrows
    public String signUrl(ContentUrl contentUrl) {
        return new URI(
                config.scheme(),
                configApp.domain(),
                "/api" + Application.RESOURCE_VERSION + "/project/" + contentUrl.getProjectId() + "/content/proxy/userId/" + contentUrl.getUserId() + "/file/" + contentUrl.getFileName(),
                null,
                null)
                .toString();
    }

    @Override
    public Optional<ContentUrl> parseContentUrl(String url) {
        boolean isProxied = false;
        Matcher matcher = CONTENT_TYPE_URL_MATCHER_S3.matcher(url);
        if (!matcher.matches()) {
            isProxied = true;
            matcher = CONTENT_TYPE_URL_MATCHER_PROXY.matcher(url);
        }
        if (!matcher.matches()) {
            return Optional.empty();
        }
        String scheme = matcher.group("scheme");
        String domain = matcher.group("domain");
        String projectId = matcher.group("projectId");
        String userId = matcher.group("userId");
        String fileName = matcher.group("fileName");
        String extension = matcher.group("extension");
        String key = KEY_PREFIX + projectId + "/" + userId + "/" + fileName;
        String query = matcher.group("query");
        ContentType contentType = ContentType.EXTENSION_TO_CONTENT_TYPE.getOrDefault(extension, ContentType.UNKNOWN);
        if (!config.scheme().equals(scheme)) {
            return Optional.empty();
        }
        if (!isProxied && !config.hostname().equals(domain)) {
            return Optional.empty();
        }
        if (isProxied && !configApp.domain().equals(domain)) {
            return Optional.empty();
        }
        return Optional.of(new ContentUrl(url, key, fileName, query, projectId, userId, contentType));
    }

    @VisibleForTesting
    public ContentUrl generateContentUrl(String projectId, String userId, ContentType contentType, String fileName) {
        String key = getContentKey(projectId, userId, fileName);
        String url = config.scheme() + "://" + config.hostname() + "/" + key;
        return new ContentUrl(url, key, fileName, null, projectId, userId, contentType);
    }

    private String getContentKey(String projectId, String userId, String fileName) {
        return KEY_PREFIX + safe(projectId) + "/" + safe(userId) + "/" + safe(fileName);
    }

    private ContentType contentTypeForFileName(String fileName) {
        int dot = fileName.lastIndexOf('.');
        String extension = dot < 0 ? "" : fileName.substring(dot + 1);
        return ContentType.EXTENSION_TO_CONTENT_TYPE.getOrDefault(extension, ContentType.UNKNOWN);
    }

    private Path baseDirPath() {
        return Paths.get(config.baseDir()).toAbsolutePath().normalize();
    }

    /** Resolves a store key to an absolute path, guaranteeing it stays under the base directory. */
    private Path resolveKeyToPath(String key) {
        Path base = baseDirPath();
        Path resolved = base.resolve(key).normalize();
        if (!resolved.startsWith(base)) {
            throw new WebApplicationException(Response.Status.BAD_REQUEST);
        }
        return resolved;
    }

    /** Rejects path segments containing separators or traversal so they can't escape the base dir. */
    private String safe(String segment) {
        if (segment == null || !SAFE_SEGMENT.matcher(segment).matches()) {
            throw new WebApplicationException(Response.Status.BAD_REQUEST);
        }
        return segment;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ContentStore.class).to(LocalDiskContentStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(LocalDiskContentStore.class).asEagerSingleton();
            }
        };
    }
}
