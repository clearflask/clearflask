// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import com.google.gson.Gson;
import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import lombok.extern.slf4j.Slf4j;

import javax.management.MBeanServer;
import javax.management.ObjectName;
import java.lang.reflect.Method;
import java.util.Map;


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
    @Inject
    private Gson gson;

    private ImmutableList<ObjectName> registeredObjectNames = ImmutableList.of();

    @Override
    protected void serviceStart() throws Exception {
        if (!config.enabled()) {
            return;
        }
        ImmutableList.Builder<ObjectName> registeredObjectNamesBuilder = ImmutableList.builder();
        for (Key<?> objKey : this.injector.getAllBindings().keySet()) {
            Map<String, Method> methodsByName = Maps.newHashMap();
            Class cls = objKey.getTypeLiteral().getRawType();
            while (cls != null) {
                for (Method method : cls.getDeclaredMethods()) {
                    if (method.isAnnotationPresent(Extern.class)) {
                        if (!method.isAccessible()) {
                            method.setAccessible(true);
                        }
                        Method previous = methodsByName.put(method.getName(), method);
                        if (previous != null) {
                            log.warn("@Extern annotation applied to two methods with the same name: {}",
                                    method.getName());
                        }
                    }
                }
                cls = cls.getSuperclass();
            }
            if (methodsByName.size() == 0) {
                continue;
            }

            ExternBean bean = new ExternBean(this.injector, gson, objKey, ImmutableMap.copyOf(methodsByName));

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

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ExternController.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(ExternController.class).asEagerSingleton();
            }
        };
    }
}
