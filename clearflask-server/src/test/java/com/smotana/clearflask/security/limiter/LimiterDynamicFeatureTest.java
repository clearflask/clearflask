// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security.limiter;

import com.smotana.clearflask.core.ServiceInjector.Environment;
import org.junit.Test;
import org.mockito.ArgumentCaptor;

import javax.annotation.security.RolesAllowed;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Priorities;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.ResourceInfo;
import javax.ws.rs.core.FeatureContext;
import javax.ws.rs.core.SecurityContext;
import java.lang.reflect.Field;

import static org.junit.Assert.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class LimiterDynamicFeatureTest {
    public static class Resource {
        @Limit(requiredPermits = 10, challengeAfter = 0)
        public void publicEndpoint() {}

        @Limit(requiredPermits = 10, challengeAfter = 0)
        @RolesAllowed("ADMINISTRATOR")
        public void protectedEndpoint() {}
    }

    @Test
    public void defersOnlyCaptchaUntilAfterAuthenticationOnPublicAndProtectedEndpoints() throws Exception {
        verifyFilters("publicEndpoint", 2);
        verifyFilters("protectedEndpoint", 3);
    }

    private void verifyFilters(String methodName, int count) throws Exception {
        LimiterDynamicFeature feature = new LimiterDynamicFeature();
        Limiter limiter = mock(Limiter.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        inject(feature, "limiter", limiter);
        inject(feature, "request", request);
        inject(feature, "env", Environment.TEST);
        ResourceInfo info = mock(ResourceInfo.class);
        when(info.getResourceClass()).thenReturn((Class) Resource.class);
        when(info.getResourceMethod()).thenReturn(Resource.class.getMethod(methodName));
        FeatureContext configuration = mock(FeatureContext.class);
        feature.configure(info, configuration);
        ArgumentCaptor<Object> filters = ArgumentCaptor.forClass(Object.class);
        ArgumentCaptor<Integer> priorities = ArgumentCaptor.forClass(Integer.class);
        verify(configuration, times(count)).register(filters.capture(), priorities.capture());
        assertEquals(Integer.valueOf(Priorities.AUTHENTICATION - 10), priorities.getAllValues().get(0));
        assertEquals(Integer.valueOf(Priorities.AUTHENTICATION + 5), priorities.getAllValues().get(1));

        ContainerRequestContext context = mock(ContainerRequestContext.class);
        Limit limit = Resource.class.getMethod(methodName).getAnnotation(Limit.class);
        ((ContainerRequestFilter) filters.getAllValues().get(0)).filter(context);
        verify(limiter).rateLimit(context, limit, "127.0.0.1", "127.0.0.1");
        verify(limiter, never()).challenge(any(), any(), anyString(), anyString());
        ((ContainerRequestFilter) filters.getAllValues().get(1)).filter(context);
        verify(limiter).challenge(context, limit, "127.0.0.1", "127.0.0.1");
        if (count == 3) {
            assertEquals(Integer.valueOf(Priorities.AUTHENTICATION + 10), priorities.getAllValues().get(2));
            SecurityContext security = mock(SecurityContext.class);
            when(context.getSecurityContext()).thenReturn(security);
            when(security.getUserPrincipal()).thenReturn(() -> "account");
            ((ContainerRequestFilter) filters.getAllValues().get(2)).filter(context);
            verify(limiter).filter(context, limit, "127.0.0.1", "account");
        }
    }

    private static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
