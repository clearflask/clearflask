// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.auth.internal.SignerConstants;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.AmazonS3Exception;
import com.amazonaws.services.s3.model.S3ObjectSummary;
import com.google.common.base.Charsets;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.ContentStore;
import com.smotana.clearflask.store.ContentStore.ContentType;
import com.smotana.clearflask.store.ContentStore.ContentUrl;
import com.smotana.clearflask.store.s3.DefaultS3ClientProvider;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.IdUtil;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.NameValuePair;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.utils.URLEncodedUtils;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import javax.ws.rs.WebApplicationException;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.util.Map;
import java.util.Optional;

import static org.junit.Assert.*;

@Slf4j
@RunWith(Parameterized.class)
public class S3ContentStoreIT extends AbstractTest {

    @Inject
    private ContentStore store;
    @Inject
    private AmazonS3 s3;

    private final String bucketName = "mock-" + IdUtil.randomId();

    @Parameterized.Parameter(0)
    public boolean proxyEnabled;

    @Parameterized.Parameters(name = "proxy {0}")
    public static Object[][] data() {
        return new Object[][]{
                {false},
                {true},
        };
    }


    @Override
    protected void configure() {
        super.configure();

        bind(AWSCredentialsProvider.class).toInstance(new AWSStaticCredentialsProvider(new BasicAWSCredentials("test", "test")));

        install(Modules.override(
                S3ContentStore.module(),
                DefaultS3ClientProvider.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(S3ContentStore.Config.class, om -> {
                    om.override(om.id().scheme()).withValue("http");
                    om.override(om.id().hostname()).withValue(bucketName + ".s3.localhost.localstack.cloud:4566");
                    om.override(om.id().bucketName()).withValue(bucketName);
                    om.override(om.id().proxyEnabled()).withValue(proxyEnabled);
                }));
                install(ConfigSystem.overrideModule(DefaultS3ClientProvider.Config.class, om -> {
                    om.override(om.id().serviceEndpoint()).withValue("http://s3.localhost.localstack.cloud:4566");
                    om.override(om.id().signingRegion()).withValue("us-east-1");
                    om.override(om.id().dnsResolverTo()).withValue("localhost");
                }));
            }
        }));
    }

    @Before
    public void setup() throws Exception {
        super.setup();
        s3.createBucket(bucketName);
    }

    @After
    public void cleanup() throws Exception {
        s3.listObjectsV2(bucketName).getObjectSummaries().stream()
                .map(S3ObjectSummary::getKey)
                .forEach(key -> s3.deleteObject(bucketName, key));
        s3.deleteBucket(bucketName);

        super.cleanup();
    }

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        byte[] exampleJpegBytes = Thread.currentThread().getContextClassLoader().getResourceAsStream("example.jpeg").readAllBytes();
        String projectId = "my-project-id";
        String userId = "my-user-id";

        log.info("buckets: {}", s3.listBuckets());
        ContentUrl contentUrl = store.upload(projectId, userId, ContentType.JPEG, new ByteArrayInputStream(exampleJpegBytes), exampleJpegBytes.length);
        log.info("contentUrl: {}", contentUrl);
        assertEquals(Optional.empty(), store.signUrl("other-project-id", contentUrl.getUrl()));
        String signedUrl = store.signUrl(projectId, contentUrl.getUrl()).get();
        log.info("signedUrl: {}", signedUrl);

        assertNotNull(s3.getObject(bucketName, contentUrl.getKey()));

        if (!proxyEnabled) {
            // This should throw 403 on a real S3, but we're using localstack
            assertEquals(contentUrl.getUrl(), 200, get(contentUrl.getUrl()));
            assertEquals(signedUrl, 200, get(signedUrl));
        } else {
            Map<String, String> queryParams = URLEncodedUtils.parse(new URI(signedUrl), Charsets.UTF_8)
                    .stream()
                    .collect(ImmutableMap.toImmutableMap(p -> p.getName().toLowerCase(), NameValuePair::getValue));
            try {
                store.proxy(
                        projectId,
                        userId,
                        contentUrl.getFileName(),
                        queryParams.getOrDefault(SignerConstants.X_AMZ_SECURITY_TOKEN.toLowerCase(), ""),
                        queryParams.get(SignerConstants.X_AMZ_ALGORITHM.toLowerCase()),
                        queryParams.get(SignerConstants.X_AMZ_DATE.toLowerCase()),
                        queryParams.get(SignerConstants.X_AMZ_SIGNED_HEADER.toLowerCase()),
                        queryParams.get(SignerConstants.X_AMZ_EXPIRES.toLowerCase()),
                        queryParams.get(SignerConstants.X_AMZ_CREDENTIAL.toLowerCase()),
                        queryParams.get(SignerConstants.X_AMZ_SIGNATURE.toLowerCase()));
            } catch (WebApplicationException ex) {
                assertEquals(200, ex.getResponse().getStatus());
            }
        }

        store.delete(signedUrl);

        try {
            assertNull(s3.getObject(bucketName, contentUrl.getKey()));
            fail();
        } catch (AmazonS3Exception ex) {
            if (ex.getStatusCode() != 404) {
                throw ex;
            }
        }
        assertEquals(contentUrl.getUrl(), 404, get(contentUrl.getUrl()));
        assertEquals(signedUrl, 404, get(signedUrl));
    }

    private int get(String url) throws Exception {
        HttpGet req = new HttpGet(url);
        try (CloseableHttpClient client = HttpClientBuilder.create().build();
             CloseableHttpResponse res = client.execute(req)) {
            return res.getStatusLine().getStatusCode();
        }
    }
}


