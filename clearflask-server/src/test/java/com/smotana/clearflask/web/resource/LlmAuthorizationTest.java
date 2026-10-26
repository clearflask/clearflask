// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.LlmAgentStore;
import com.smotana.clearflask.store.LlmHistoryStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.AuthenticationFilter;
import com.smotana.clearflask.web.security.SuperAdminPredicate;
import org.junit.Test;
import org.mockito.ArgumentCaptor;

import javax.annotation.security.RolesAllowed;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.core.MultivaluedHashMap;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import javax.ws.rs.sse.SseEventSink;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.Optional;

import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class LlmAuthorizationTest {

    @Test
    public void unrelatedActiveAccountCannotAccessAnyProjectConversationEndpoint() throws Exception {
        SecurityContext context = authenticate(false, true);
        for (Method method : LlmResource.class.getDeclaredMethods()) {
            if (method.getName().endsWith("Admin") && !method.getName().endsWith("SuperAdmin")) {
                assertFalse(method.getName(), allowed(context, method));
            }
        }
    }

    @Test
    public void activeProjectAdminRetainsConversationAccess() throws Exception {
        SecurityContext context = authenticate(true, true);
        for (Method method : LlmResource.class.getDeclaredMethods()) {
            if (method.getName().endsWith("Admin") && !method.getName().endsWith("SuperAdmin")) {
                assertTrue(method.getName(), allowed(context, method));
            }
        }
    }

    @Test
    public void inactiveProjectCanReadHistoryButCannotGenerateMessages() throws Exception {
        SecurityContext context = authenticate(true, false);
        for (Method method : LlmResource.class.getDeclaredMethods()) {
            if (method.getName().endsWith("Admin") && !method.getName().endsWith("SuperAdmin")) {
                assertEquals(method.getName(), !method.getName().equals("messageCreateAdmin"), allowed(context, method));
            }
        }
    }

    @Test
    public void streamRejectsConversationNotOwnedByCallerBeforeSubscribing() throws Exception {
        LlmResource resource = new LlmResource();
        resource.securityContext = authenticate(true, true);
        LlmHistoryStore history = mock(LlmHistoryStore.class);
        LlmAgentStore agent = mock(LlmAgentStore.class);
        SseEventSink sink = mock(SseEventSink.class);
        inject(resource, "llmHistoryStore", history);
        inject(resource, "llmAgentStore", agent);
        when(history.getConvo("project", "caller", "foreign-conversation")).thenReturn(Optional.empty());

        assertThrows(ApiException.class, () -> resource.messageStreamGetAdmin(
                "project", "foreign-conversation", "message", null, sink));

        verify(history).getConvo("project", "caller", "foreign-conversation");
        verifyNoInteractions(agent);
        verify(sink).close();
    }

    @Test
    public void streamAllowsCallersOwnConversation() throws Exception {
        LlmResource resource = new LlmResource();
        resource.securityContext = authenticate(true, true);
        LlmHistoryStore history = mock(LlmHistoryStore.class);
        LlmAgentStore agent = mock(LlmAgentStore.class);
        inject(resource, "llmHistoryStore", history);
        inject(resource, "llmAgentStore", agent);
        when(history.getConvo("project", "caller", "own-conversation"))
                .thenReturn(Optional.of(mock(LlmHistoryStore.ConvoModel.class)));

        resource.messageStreamGetAdmin("project", "own-conversation", "message", null, mock(SseEventSink.class));

        verify(agent).awaitAnswer(eq("project"), eq("own-conversation"), eq("message"), any());
    }

    private boolean allowed(SecurityContext context, Method method) {
        for (String role : method.getAnnotation(RolesAllowed.class).value()) {
            if (context.isUserInRole(role)) {
                return true;
            }
        }
        return false;
    }

    private SecurityContext authenticate(boolean projectAdmin, boolean active) throws Exception {
        AuthenticationFilter filter = new AuthenticationFilter();
        AccountStore accounts = mock(AccountStore.class);
        AccountStore.Account account = mock(AccountStore.Account.class);
        when(account.getAccountId()).thenReturn("caller");
        when(account.getEmail()).thenReturn("caller@example.com");
        when(account.getStatus()).thenReturn(active ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELLED);
        when(accounts.getAccountByApiKey("test-key")).thenReturn(Optional.of(account));
        when(accounts.getAccount(anyString(), eq(true))).thenReturn(Optional.of(account));
        ProjectStore projects = mock(ProjectStore.class);
        ProjectStore.Project project = mock(ProjectStore.Project.class);
        when(project.getAccountId()).thenReturn("owner");
        when(project.isAdmin("caller")).thenReturn(projectAdmin);
        when(projects.getProject("project", true)).thenReturn(Optional.of(project));
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        inject(filter, "request", request);
        inject(filter, "env", Environment.TEST);
        inject(filter, "accountStore", accounts);
        inject(filter, "projectStore", projects);
        inject(filter, "superAdminPredicate", mock(SuperAdminPredicate.class));
        inject(filter, "authCookie", mock(AuthCookie.class));

        ContainerRequestContext context = mock(ContainerRequestContext.class);
        UriInfo uri = mock(UriInfo.class);
        MultivaluedHashMap<String, String> path = new MultivaluedHashMap<>();
        path.putSingle("projectId", "project");
        when(uri.getPathParameters()).thenReturn(path);
        when(context.getUriInfo()).thenReturn(uri);
        when(context.getCookies()).thenReturn(Collections.emptyMap());
        when(context.getHeaderString(AuthenticationFilter.EXTERNAL_API_AUTH_HEADER_NAME_TOKEN)).thenReturn("test-key");
        filter.filter(context);
        ArgumentCaptor<SecurityContext> security = ArgumentCaptor.forClass(SecurityContext.class);
        verify(context).setSecurityContext(security.capture());
        return security.getValue();
    }

    private static void inject(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
