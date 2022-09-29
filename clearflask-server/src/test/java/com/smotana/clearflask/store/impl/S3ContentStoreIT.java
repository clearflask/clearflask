// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.AmazonS3Exception;
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
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.util.Optional;

import static org.junit.Assert.*;

@Slf4j
public class S3ContentStoreIT extends AbstractTest {

    @Inject
    private ContentStore store;
    @Inject
    private AmazonS3 s3;

    private final String bucketName = "mock-" + IdUtil.randomId();

    @Override
    protected void configure() {
        super.configure();

        bind(AWSCredentialsProvider.class).toInstance(new AWSStaticCredentialsProvider(new BasicAWSCredentials("test", "test")));

        install(Modules.override(
                S3ContentStore.module(),
                Application.module(),
                DefaultS3ClientProvider.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(S3ContentStore.Config.class, om -> {
                    om.override(om.id().scheme()).withValue("http");
                    om.override(om.id().hostname()).withValue(bucketName + ".s3.localhost.localstack.cloud:4566");
                    om.override(om.id().bucketName()).withValue(bucketName);
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
        // This should throw 403 on a real S3, but we're using localstack
        assertEquals(contentUrl.getUrl(), 200, get(contentUrl.getUrl()));
        assertEquals(signedUrl, 200, get(signedUrl));

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


