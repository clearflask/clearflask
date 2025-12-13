// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.HttpMethod;
import com.amazonaws.auth.internal.SignerConstants;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.Headers;
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
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.config.RegistryBuilder;
import org.apache.http.conn.socket.ConnectionSocketFactory;
import org.apache.http.conn.socket.PlainConnectionSocketFactory;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.impl.conn.BasicHttpClientConnectionManager;
import org.apache.http.impl.conn.SystemDefaultDnsResolver;
import org.elasticsearch.common.Strings;

import javax.ws.rs.NotFoundException;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
public class S3ContentStore extends ManagedService implements ContentStore {

    private static final String KEY_PREFIX = "img/ugc/";
    private static final Pattern CONTENT_TYPE_URL_MATCHER_S3 = Pattern.compile("^(?<scheme>[^:]+)://(?<domain>[^/]+)/" + KEY_PREFIX + "(?<projectId>[^/]+)/(?<userId>[^/]+)/(?<fileName>[^?]+\\.(?<extension>[^.?]+))(?<query>\\?[^#]*)?$");
    private static final Pattern CONTENT_TYPE_URL_MATCHER_PROXY = Pattern.compile("^(?<scheme>[^:]+)://(?<domain>[^/]+)/api" + Application.RESOURCE_VERSION + "/project/(?<projectId>[^/]+)/content/proxy/userId/(?<userId>[^/]+)/file/(?<fileName>[^?]+\\.(?<extension>[^.?]+))(?<query>\\?[^#]*)?$");

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

        @DefaultValue("false")
        boolean proxyEnabled();

        /**
         * Used for localstack where "*.localstack.cloud" needs to be resolved to "localstack"
         */
        @DefaultValue("")
        String proxyResolveTo();
    }

    @Inject
    private Application.Config configApp;
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
        return upload(projectId, userId, contentType, inputStream, length,
                IdUtil.randomId()  + "." + contentType.getExtension());
    }

    @Override
    public ContentUrl upload(String projectId, String userId, ContentType contentType, InputStream inputStream, int length, String fileName) {
        ContentUrl contentUrl = generateContentUrl(projectId, userId, contentType, fileName);
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
    public String uploadAndSign(String projectId, String userId, ContentType contentType, InputStream inputStream, int length, String fileName) {
        ContentUrl contentUrl = upload(projectId, userId, contentType, inputStream, length, fileName);
        return signUrl(contentUrl);
    }

    @Override
    public void proxy(String projectId, String userId, String object, String xAmzSecurityToken, String xAmzAlgorithm, String xAmzDate, String xAmzSignedHeaders, String xAmzExpires, String xAmzCredential, String xAmzSignature) throws WebApplicationException {
        if (!config.proxyEnabled()) {
            log.debug("Not enabled, skipping");
            throw new NotFoundException();
        }
        HttpClientBuilder clientBuilder = HttpClientBuilder.create();
        if (!Strings.isNullOrEmpty(config.proxyResolveTo())) {
            clientBuilder.setConnectionManager(new BasicHttpClientConnectionManager(RegistryBuilder.<ConnectionSocketFactory>create()
                    .register("http", PlainConnectionSocketFactory.getSocketFactory())
                    .register("https", SSLConnectionSocketFactory.getSocketFactory()).build(),
                    null, null, new SystemDefaultDnsResolver() {
                @Override
                public InetAddress[] resolve(final String host) throws UnknownHostException {
                    if (config.hostname().split(":")[0].equalsIgnoreCase(host)) {
                        log.trace("Proxy resolving {} to {}", host, config.proxyResolveTo());
                        return super.resolve(config.proxyResolveTo());
                    } else {
                        log.debug("Proxy NOT resolving {} to {}", host, config.proxyResolveTo());
                        return super.resolve(host);
                    }
                }
            }
            ));
        }
        try (CloseableHttpClient client = clientBuilder.build()) {
            String url = getContentUrl(getContentKey(projectId, userId, object));
            URIBuilder uriBuilder = new URIBuilder(url)
                    .setParameter(SignerConstants.X_AMZ_SECURITY_TOKEN, xAmzSecurityToken)
                    .setParameter(SignerConstants.X_AMZ_ALGORITHM, xAmzAlgorithm)
                    .setParameter(SignerConstants.X_AMZ_DATE, xAmzDate)
                    .setParameter(SignerConstants.X_AMZ_SIGNED_HEADER, xAmzSignedHeaders)
                    .setParameter(SignerConstants.X_AMZ_EXPIRES, xAmzExpires)
                    .setParameter(SignerConstants.X_AMZ_CREDENTIAL, xAmzCredential)
                    .setParameter(SignerConstants.X_AMZ_SIGNATURE, xAmzSignature);
            HttpGet request = new HttpGet(uriBuilder.build());
            log.trace("Proxying to url {}", request.getURI());
            try (CloseableHttpResponse response = client.execute(request)) {
                if (response.getStatusLine().getStatusCode() < 200
                        || response.getStatusLine().getStatusCode() > 299) {
                    log.info("Failed to proxy content with {} projectId {} userId {} object {}",
                            response.getStatusLine().getStatusCode(), projectId, userId, object);
                    throw new WebApplicationException(Response.Status.NOT_FOUND);
                }
                byte[] responseBytes = response.getEntity().getContent().readAllBytes();
                throw new WebApplicationException(Response
                        .status(response.getStatusLine().getStatusCode())
                        .entity(responseBytes)
                        .header(Headers.CONTENT_TYPE, response.getEntity().getContentType().getValue())
                        .header(Headers.CONTENT_LENGTH, response.getEntity().getContentLength())
                        .header(Headers.CONTENT_ENCODING, response.getEntity().getContentEncoding())
                        .build());
            }
        } catch (IOException | URISyntaxException ex) {
            throw new ApiException(Response.Status.NOT_FOUND, ex);
        }
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
    @SneakyThrows
    public String signUrl(ContentUrl contentUrl) {
        String signedUrl = s3.generatePresignedUrl(
                config.bucketName(),
                contentUrl.getKey(),
                Date.from(Instant.now().plus(config.presignedUrlExpiry())),
                HttpMethod.GET).toString();

        if (!config.proxyEnabled()) {
            return signedUrl;
        }

        URI signedUri = URI.create(signedUrl);
        String signedProxyUrl = new URI(
                config.scheme(),
                configApp.domain(),
                "/api" + Application.RESOURCE_VERSION + "/project/" + contentUrl.getProjectId() + "/content/proxy/userId/" + contentUrl.getUserId() + "/file/" + contentUrl.getFileName(),
                signedUri.getQuery(),
                signedUri.getFragment())
                .toString();
        return signedProxyUrl;
    }

    @Override
    public Optional<ContentUrl> parseContentUrl(String url) {
        boolean isProxied = false;
        Matcher matcher = CONTENT_TYPE_URL_MATCHER_S3.matcher(url);
        // Fallback to proxy URL
        if (!matcher.matches() && config.proxyEnabled()) {
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
        String url = getContentUrl(key);

        return new ContentUrl(url, key, fileName, null, projectId, userId, contentType);
    }

    private String getContentKey(String projectId, String userId, String fileName) {
        return KEY_PREFIX + projectId + "/" + userId + "/" + fileName;
    }

    private String getContentUrl(String path) {
        return config.scheme() + "://" + config.hostname() + "/" + path;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ContentStore.class).to(S3ContentStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(S3ContentStore.class).asEagerSingleton();
            }
        };
    }
}
