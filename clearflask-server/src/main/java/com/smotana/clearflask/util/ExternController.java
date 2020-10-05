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
import java.lang.ref.WeakReference;
import java.lang.reflect.Method;


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
        WeakReference<Injector> injectorRef = new WeakReference<>(injector);
        for (Key<?> objKey : injector.getAllBindings().keySet()) {
            ImmutableMap.Builder<String, Method> methodsByNameBuilder = ImmutableMap.builder();
            Class cls = objKey.getTypeLiteral().getRawType();
            while (cls != null) {
                for (Method method : cls.getDeclaredMethods()) {
                    if (method.isAnnotationPresent(Extern.class)) {
                        if (!method.isAccessible()) {
                            method.setAccessible(true);
                        }
                        methodsByNameBuilder.put(method.getName(), method);
                    }
                }
                cls = cls.getSuperclass();
            }
            ImmutableMap<String, Method> methodsByName = methodsByNameBuilder.build();
            if (methodsByName.size() == 0) {
                continue;
            }

            ExternBean bean = new ExternBean(injectorRef, objKey, methodsByName);

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
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(ExternController.class);
            }
        };
    }
}
