// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Before;
import org.junit.Test;

import java.util.Optional;
import java.util.function.Function;

import static org.junit.Assert.assertEquals;

@Slf4j
public class RemoteLicenseStoreTest extends AbstractTest {

    private final String licenseValid = "valid-license";
    private final String licenseInvalid = "invalid-license";
    private final Function<String, Optional<Boolean>> validator = l -> Optional.of(licenseValid.equals(l));
    private final Function<String, Optional<Boolean>> validatorFailing = l -> Optional.empty();
    private final Function<String, Optional<Boolean>> validatorThrow = l -> {
        throw new RuntimeException("Failed: should not be hitting validator");
    };

    @Inject
    private DynamoRemoteLicenseStore store;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DynamoRemoteLicenseStore.module(),
                InMemoryDynamoDbProvider.module(),
                SingleTableProvider.module()
        ).with(new AbstractModule() {
        }));
    }

    @Before
    public void setup() throws Exception {
        super.setup();

        store.clearCache();
        store.clearLicense();
    }

    @Test(timeout = 10_000L)
    public void testSetGetClear() throws Exception {

        assertEquals(Optional.empty(), store.getLicense());

        String license = "my-license";
        store.setLicense(license);
        assertEquals(Optional.of(license), store.getLicense());

        store.clearLicense();
        assertEquals(Optional.empty(), store.getLicense());
    }

    @Test(timeout = 10_000L)
    public void testValidateLicenseRemotelyWithoutCacheNoLicense() throws Exception {
        assertEquals(Optional.empty(), store.validateLicenseRemotely(false, validator));
        assertEquals(Optional.empty(), store.validateLicenseRemotely(false, validatorFailing));
    }

    @Test(timeout = 10_000L)
    public void testValidateLicenseRemotelyWithoutCacheInvalidLicense() throws Exception {
        store.setLicense(licenseInvalid);
        assertEquals(Optional.of(false), store.validateLicenseRemotely(false, validator));
        assertEquals(Optional.of(false), store.validateLicenseRemotely(false, validatorFailing));
    }

    @Test(timeout = 10_000L)
    public void testValidateLicenseRemotelyWithoutCacheValidLicense() throws Exception {
        store.setLicense(licenseValid);
        assertEquals(Optional.of(true), store.validateLicenseRemotely(false, validator));
        assertEquals(Optional.of(false), store.validateLicenseRemotely(false, validatorFailing));
    }

    @Test(timeout = 10_000L)
    public void testValidateLicenseRemotelyInvalidIsCached() throws Exception {
        store.clearCache();
        store.setLicense(licenseInvalid);
        assertEquals(Optional.of(false), store.validateLicenseRemotely(true, validator));
        assertEquals(Optional.of(false), store.validateLicenseRemotely(true, validatorThrow));
    }

    @Test(timeout = 10_000L)
    public void testValidateLicenseRemotelyValidIsCached() throws Exception {
        store.clearCache();
        store.setLicense(licenseValid);
        assertEquals(Optional.of(true), store.validateLicenseRemotely(true, validator));
        assertEquals(Optional.of(true), store.validateLicenseRemotely(true, validatorThrow));
    }

    @Test(timeout = 10_000L)
    public void testValidateLicenseRemotelyGraceOnValidatorFailing() throws Exception {
        // First we populate the cache as valid
        store.setLicense(licenseValid);
        assertEquals(Optional.of(true), store.validateLicenseRemotely(true, validator));

        // Clear short-term cache
        store.lastValidationCache.invalidateAll();

        // Expect success even though validator is failing due to grace period
        assertEquals(Optional.of(true), store.validateLicenseRemotely(true, validatorFailing));
        // Expect to be cached
        assertEquals(Optional.of(true), store.validateLicenseRemotely(true, validatorThrow));
    }

    @Test(timeout = 10_000L)
    public void testValidateLicenseRemotelyNoGraceOnInvalid() throws Exception {
        // First we populate the cache as valid
        store.setLicense(licenseValid);
        assertEquals(Optional.of(true), store.validateLicenseRemotely(true, validator));

        // Clear short-term cache
        store.lastValidationCache.invalidateAll();

        // Expect success even though validator is failing due to grace period
        store.setLicense(licenseInvalid);
        assertEquals(Optional.of(false), store.validateLicenseRemotely(true, validator));
        // Expect to be cached
        assertEquals(Optional.of(false), store.validateLicenseRemotely(true, validatorThrow));
    }
}