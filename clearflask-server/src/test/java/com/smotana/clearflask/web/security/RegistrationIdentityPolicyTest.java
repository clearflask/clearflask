package com.smotana.clearflask.web.security;

import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.api.model.RegistrationAbuseSettings;
import org.junit.Test;

import javax.annotation.security.RolesAllowed;

import static org.junit.Assert.*;

public class RegistrationIdentityPolicyTest {
    @Test
    public void controlEndpointsRequireSuperadmin() throws Exception {
        assertArrayEquals(new String[]{Role.SUPER_ADMIN}, AccountResource.class
                .getMethod("registrationAbuseGetSuperAdmin").getAnnotation(RolesAllowed.class).value());
        assertArrayEquals(new String[]{Role.SUPER_ADMIN}, AccountResource.class
                .getMethod("registrationAbuseUpdateSuperAdmin", RegistrationAbuseSettings.class).getAnnotation(RolesAllowed.class).value());
    }
}
