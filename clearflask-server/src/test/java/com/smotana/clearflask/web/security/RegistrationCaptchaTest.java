package com.smotana.clearflask.web.security;

import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.security.limiter.challenge.CaptchaChallenger;
import org.junit.Test;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.WebApplicationException;
import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class RegistrationCaptchaTest {
    @Test
    public void firstAttemptWithoutSolutionIsChallengedIncludingTrailingSlash() throws Exception {
        Fixture f = new Fixture();
        when(f.request.getRequestURI()).thenReturn("/api/v1/admin/account/signup/");
        assertChallenged(f);
        verify(f.challenger, never()).verifyRegistration(anyString(), anyString(), anyString());
    }

    @Test
    public void invalidSolutionIsChallenged() throws Exception {
        Fixture f = new Fixture();
        when(f.request.getHeader("x-cf-solution")).thenReturn("invalid");
        assertChallenged(f);
    }

    @Test
    public void verifiedSolutionIsConsumedOnceWithinOneRequest() throws Exception {
        Fixture f = new Fixture();
        when(f.request.getHeader("x-cf-solution")).thenReturn("solution");
        when(f.challenger.verifyRegistration(anyString(), anyString(), eq("solution"))).thenReturn(true);
        f.guard.require(f.request, Optional.empty());
        f.guard.require(f.request, Optional.empty());
        verify(f.challenger, times(1)).verifyRegistration(anyString(), anyString(), eq("solution"));
    }

    @Test
    public void verifiedSuperadminKeepsExistingExemption() throws Exception {
        Fixture f = new Fixture();
        ExtendedSecurityContext.ExtendedPrincipal principal = mock(ExtendedSecurityContext.ExtendedPrincipal.class);
        when(principal.getAuthenticatedSuperAccountIdOpt()).thenReturn(Optional.of("owner"));
        f.guard.require(f.request, Optional.of(principal));
        verifyNoInteractions(f.challenger);
    }

    @Test
    public void ordinaryAccountAndForgedHeadersDoNotExemptRegistration() throws Exception {
        Fixture f = new Fixture();
        ExtendedSecurityContext.ExtendedPrincipal principal = mock(ExtendedSecurityContext.ExtendedPrincipal.class);
        when(principal.getAuthenticatedSuperAccountIdOpt()).thenReturn(Optional.empty());
        when(f.request.getHeader("X-Forwarded-For")).thenReturn("10.9.1.1");
        try {
            f.guard.require(f.request, Optional.of(principal));
            fail("ordinary account must solve CAPTCHA");
        } catch (WebApplicationException error) {
            assertEquals(429, error.getResponse().getStatus());
        }
    }

    private static void assertChallenged(Fixture f) {
        try {
            f.guard.require(f.request, Optional.empty());
            fail("registration must be challenged");
        } catch (WebApplicationException error) {
            assertEquals(429, error.getResponse().getStatus());
            assertEquals("challenge", error.getResponse().getHeaderString("x-cf-challenge"));
        }
    }

    private static class Fixture {
        final RegistrationCaptcha guard = new RegistrationCaptcha();
        final HttpServletRequest request = mock(HttpServletRequest.class);
        final CaptchaChallenger challenger = mock(CaptchaChallenger.class);
        Fixture() throws Exception {
            inject(guard, "env", Environment.TEST);
            inject(guard, "challenger", challenger);
            when(request.getRemoteAddr()).thenReturn("127.0.0.1");
            when(request.getRequestURI()).thenReturn("/api/v1/admin/account/signup");
            when(challenger.issue(anyString(), anyString())).thenReturn("challenge");
            Map<String, Object> attributes = new HashMap<>();
            when(request.getAttribute(anyString())).thenAnswer(i -> attributes.get(i.getArgument(0)));
            doAnswer(i -> { attributes.put(i.getArgument(0), i.getArgument(1)); return null; })
                    .when(request).setAttribute(anyString(), any());
        }
    }

    static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
