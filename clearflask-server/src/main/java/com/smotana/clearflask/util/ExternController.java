// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.Key;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;

import javax.management.MBeanServer;
import javax.management.ObjectName;
import java.lang.reflect.Method;
import java.util.StringJoiner;


@Slf4j
@Singleton
public class ExternController extends ManagedService {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();
    }

    @Inject
    private Config config;
    @Inject
    private Injector injector;
    @Inject
    private MBeanServer mBeanServer;

    private ImmutableList<ObjectName> registeredObjectNames = ImmutableList.of();

    @Override
    protected void serviceStart() throws Exception {
        if (!config.enabled()) {
            return;
        }
        ImmutableList.Builder<ObjectName> registeredObjectNamesBuilder = ImmutableList.builder();
        for (Key<?> objKey : this.injector.getAllBindings().keySet()) {
            ImmutableMap.Builder<String, Method> methodsByNameBuilder = ImmutableMap.builder();
            Class cls = objKey.getTypeLiteral().getRawType();
            while (cls != null) {
                for (Method method : cls.getDeclaredMethods()) {
                    if (method.isAnnotationPresent(Extern.class)) {
                        if (!method.isAccessible()) {
                            method.setAccessible(true);
                        }
                        methodsByNameBuilder.put(getMethodName(method), method);
                    }
                }
                cls = cls.getSuperclass();
            }
            ImmutableMap<String, Method> methodsByName = methodsByNameBuilder.build();
            if (methodsByName.size() == 0) {
                continue;
            }

            ExternBean bean = new ExternBean(this.injector, objKey, methodsByName);

            ObjectName objectName = new ObjectName(bean.getMBeanName());
            mBeanServer.registerMBean(bean, objectName);
            registeredObjectNamesBuilder.add(objectName);
            log.debug("Registered bean with name {}", bean.getMBeanName());
        }
        this.registeredObjectNames = registeredObjectNamesBuilder.build();
    }

    @Override
    protected void serviceStop() throws Exception {
        for (ObjectName objectName : registeredObjectNames) {
            mBeanServer.unregisterMBean(objectName);
        }
    }

    String getMethodName(Method m) {
        StringBuilder sb = new StringBuilder();

        sb.append(m.getName());
        sb.append('(');
        StringJoiner sj = new StringJoiner(",");
        for (Class<?> parameterType : m.getParameterTypes()) {
            sj.add(parameterType.getTypeName());
        }
        sb.append(sj.toString());
        sb.append(')');

        return sb.toString();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ExternController.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(ExternController.class);
            }
        };
    }
}
