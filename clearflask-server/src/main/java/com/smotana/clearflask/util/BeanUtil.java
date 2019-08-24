package com.smotana.clearflask.util;

import lombok.extern.slf4j.Slf4j;

import javax.management.InstanceAlreadyExistsException;
import javax.management.MBeanServer;
import javax.management.ObjectName;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;

/**
 * Used for intercepting registration of already registered beans. Handles it by re-registering instead of throwing.
 */
@Slf4j
public class BeanUtil {
    public static MBeanServer wrapOverwriteRegister(MBeanServer mBeanServer) {
        return (MBeanServer) Proxy.newProxyInstance(
                BeanUtil.class.getClassLoader(), new Class[]{MBeanServer.class},
                (proxy, method, methodArgs) -> {
                    if (method.getName().equals("registerMBean")) {
                        try {
                            return method.invoke(mBeanServer, methodArgs);
                        } catch (InvocationTargetException ex) {
                            if (!(ex.getCause() instanceof InstanceAlreadyExistsException)) {
                                throw ex.getCause();
                            }
                            log.info("Intercepted InstanceAlreadyExistsException, replacing mbean {}", methodArgs[1]);
                            mBeanServer.unregisterMBean((ObjectName) methodArgs[1]);
                            return method.invoke(mBeanServer, methodArgs);
                        }
                    } else {
                        return method.invoke(mBeanServer, methodArgs);
                    }
                });
    }
}
