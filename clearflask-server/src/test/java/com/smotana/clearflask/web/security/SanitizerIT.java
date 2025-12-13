// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.ContentStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

import javax.ws.rs.core.Response;

import static org.junit.Assert.fail;

@Slf4j
public class SanitizerIT extends AbstractTest {

    private static final String PROJECT_ID = "my-project-id";

    @Inject
    private Sanitizer sanitizer;
    @Inject
    private ContentStore contentStoreMock;

    @Override
    protected void configure() {
        super.configure();

        bindMock(ContentStore.class);

        install(Modules.override(
                Sanitizer.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(Sanitizer.Config.class, om -> {
                    om.override(om.id().htmlSanitizerEnabled()).withValue(true);
                }));
            }
        }));
    }

    @Before
    public void setup() throws Exception {
        super.setup();
        Mockito.when(contentStoreMock.getScheme()).thenReturn("https");
    }

    @Test(timeout = 10_000L)
    public void testDomain() throws Exception {
        // Fails behind strict VPN with DNS restriction, so added as an integration test
        assertSanitizeDomain("sandbox.smotana.com", false);
        assertSanitizeDomain("feedback.example.com", true);
    }

    void assertSanitizeDomain(String domain, boolean expectFailure) {
        try {
            sanitizer.domain(domain, false);
            if (expectFailure) {
                fail("Expected failure");
            }
        } catch (ApiException ex) {
            if (ex.getStatus().getStatusCode() == Response.Status.INTERNAL_SERVER_ERROR.getStatusCode()) {
                // It's fine, test was probably performed without network connection
                return;
            }
            if (!expectFailure) {
                throw ex;
            }
        }
    }
}
