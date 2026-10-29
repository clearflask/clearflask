package com.smotana.clearflask.web.security;

import com.smotana.clearflask.antispam.AntiSpam;
import com.smotana.clearflask.api.model.UserCreate;
import com.smotana.clearflask.api.model.UserBindOauthToken;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.resource.UserResource;
import org.junit.Test;
import javax.ws.rs.core.Response;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.lang.reflect.Field;
import java.util.Optional;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Public portal flows must reach their own validation without a dashboard registration challenge. */
public class PortalRegistrationScopeTest {
    @Test
    public void portalSignupReachesProjectValidationWithoutMandatoryCaptcha() throws Exception {
        UserResource resource = new UserResource();
        ProjectStore projects = mock(ProjectStore.class);
        when(projects.getProject("missing", true)).thenReturn(Optional.empty());
        inject(resource, "projectStore", projects);
        inject(resource, "antiSpam", mock(AntiSpam.class));
        assertMissingProject(() -> resource.userCreate("missing", UserCreate.builder().build()));
    }

    @Test
    public void portalSsoAndOauthReachProjectValidationWithoutMandatoryCaptcha() throws Exception {
        UserBindUtil bind = new UserBindUtil();
        ProjectStore projects = mock(ProjectStore.class);
        when(projects.getProject("missing", true)).thenReturn(Optional.empty());
        inject(bind, "projectStore", projects);
        assertMissingProject(() -> bind.userBind(mock(HttpServletRequest.class), mock(HttpServletResponse.class),
                "missing", Optional.empty(), Optional.of("token"), Optional.empty(), Optional.empty(), Optional.empty()));
        assertMissingProject(() -> bind.userBind(mock(HttpServletRequest.class), mock(HttpServletResponse.class),
                "missing", Optional.empty(), Optional.empty(), Optional.empty(), Optional.of(new UserBindOauthToken("provider", "code")), Optional.empty()));
    }

    private static void assertMissingProject(Runnable call) {
        try { call.run(); fail("Expected project validation"); }
        catch (ApiException e) { assertEquals(Response.Status.NOT_FOUND, e.getStatus()); }
    }
    private static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name); field.setAccessible(true); field.set(target, value);
    }
}
