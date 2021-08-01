// SPDX-FileCopyrightText: 2019 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.testutil;

import com.google.inject.Inject;
import lombok.extern.slf4j.Slf4j;
import org.mockito.Mockito;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.core.Context;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;

import static org.mockito.Mockito.when;

@Slf4j
public abstract class AbstractJerseyTest extends AbstractTest {

    @Inject
    protected SettableContextProvider settableContext;

    protected <T> void installResource(Class<T> clazz) {
        bind(clazz).toProvider(() -> this.getResource(clazz));
    }

    protected void configure() {
        super.configure();
        SettableContextProvider settableContextProvider = new SettableContextProvider();
        bind(SettableContextProvider.class).toInstance(settableContextProvider);
        bind(HttpServletRequest.class).toProvider(settableContextProvider::getRequest);
    }


    private <T> T getResource(Class<T> clazz) {
        try {
            Constructor<T> constructor = clazz.getConstructor();
            constructor.setAccessible(true);
            T instance = constructor.newInstance();
            injector.injectMembers(instance);

            // Inject @Context variables
            for (Field field : clazz.getDeclaredFields()) {
                if (field.getAnnotation(Context.class) == null) {
                    continue;
                }
                field.setAccessible(true);
                field.set(instance, injector.getInstance(field.getType()));
            }
            return instance;
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    public class SettableContextProvider {
        private volatile HttpServletRequest request;

        public SettableContextProvider() {
            setRequestRemoteAddr("127.0.0.1");
        }

        public void setRequestRemoteAddr(String remoteAddr) {
            HttpServletRequest mockRequest = Mockito.mock(HttpServletRequest.class);
            when(mockRequest.getRemoteAddr()).thenReturn(remoteAddr);
            request = mockRequest;
        }

        public HttpServletRequest getRequest() {
            return request;
        }
    }
}
