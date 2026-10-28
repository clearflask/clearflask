package com.smotana.clearflask.web.security;

import com.google.inject.Inject;
import com.smotana.clearflask.api.model.RegistrationAbuseSettings;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.testutil.AbstractTest;
import io.dataspray.singletable.SingleTable;
import org.junit.Test;
import com.smotana.clearflask.web.ApiException;

import static org.junit.Assert.*;

public class RegistrationAbusePolicyTest extends AbstractTest {
    @Inject private SingleTable singleTable;

    @Override
    protected void configure() {
        super.configure();
        install(InMemoryDynamoDbProvider.module());
        install(SingleTableProvider.module());
    }

    @Test
    public void defaultsToCaptchaAndPersistsAcrossIndependentInstances() {
        RegistrationAbusePolicy first = new RegistrationAbusePolicy(singleTable);
        assertEquals(new RegistrationAbuseSettings(true, true), first.get());
        first.update(new RegistrationAbuseSettings(false, true));
        RegistrationAbusePolicy second = new RegistrationAbusePolicy(singleTable);
        assertEquals(new RegistrationAbuseSettings(false, true), second.get());
        try {
            second.requireRegistrationsEnabled();
            fail("disabled registration policy must reject creation");
        } catch (ApiException e) {
            assertEquals(403, e.getStatus().getStatusCode());
        }
        second.update(new RegistrationAbuseSettings(true, false));
        assertEquals(new RegistrationAbuseSettings(true, false), first.get());
    }
}
