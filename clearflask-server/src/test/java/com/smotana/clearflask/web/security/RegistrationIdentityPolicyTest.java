package com.smotana.clearflask.web.security;

import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.impl.DynamoElasticUserStore;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.resource.AccountResource;
import com.smotana.clearflask.api.model.RegistrationAbuseSettings;
import org.junit.Test;

import javax.annotation.security.RolesAllowed;
import javax.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.Optional;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class RegistrationIdentityPolicyTest {
    @Test
    public void existingSsoIdentityStillSignsInWhileNewIdentityIsBlocked() throws Exception {
        RegistrationAbusePolicy policy = mock(RegistrationAbusePolicy.class);
        doThrow(new ApiException(Response.Status.FORBIDDEN)).when(policy).requireRegistrationsEnabled();
        DynamoElasticUserStore store = spy(new DynamoElasticUserStore());
        Field field = DynamoElasticUserStore.class.getDeclaredField("registrationAbusePolicy");
        field.setAccessible(true);
        field.set(store, policy);
        UserModel existing = mock(UserModel.class);
        doReturn(Optional.of(existing)).when(store).getUserByIdentifier("project", UserStore.IdentifierType.GUID, "existing");
        assertSame(existing, store.createOrGet("project", "existing", Optional.empty(), Optional.empty(), false));
        verifyNoInteractions(policy);
        doReturn(Optional.empty()).when(store).getUserByIdentifier("project", UserStore.IdentifierType.GUID, "new");
        try {
            store.createOrGet("project", "new", Optional.empty(), Optional.empty(), false);
            fail("New SSO identity must be blocked");
        } catch (ApiException e) {
            assertEquals(Response.Status.FORBIDDEN, e.getStatus());
        }
    }

    @Test
    public void controlEndpointsRequireSuperadmin() throws Exception {
        assertArrayEquals(new String[]{Role.SUPER_ADMIN}, AccountResource.class
                .getMethod("registrationAbuseGetSuperAdmin").getAnnotation(RolesAllowed.class).value());
        assertArrayEquals(new String[]{Role.SUPER_ADMIN}, AccountResource.class
                .getMethod("registrationAbuseUpdateSuperAdmin", RegistrationAbuseSettings.class).getAnnotation(RolesAllowed.class).value());
    }
}
