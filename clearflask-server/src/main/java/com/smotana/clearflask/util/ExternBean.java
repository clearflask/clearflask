// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableMap;
import com.google.gson.Gson;
import com.google.inject.Injector;
import com.google.inject.Key;
import com.google.inject.name.Named;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.NotImplementedException;

import javax.management.Attribute;
import javax.management.AttributeList;
import javax.management.AttributeNotFoundException;
import javax.management.DynamicMBean;
import javax.management.InvalidAttributeValueException;
import javax.management.MBeanException;
import javax.management.MBeanInfo;
import javax.management.MBeanOperationInfo;
import javax.management.ReflectionException;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Optional;

import static com.google.common.base.Preconditions.checkNotNull;

@Slf4j
public class ExternBean implements DynamicMBean {

    private final Injector injector;
    private final Gson gson;
    private final Key<?> objKey;
    private final Map<String, Method> methodsByName;
    private final MBeanInfo mBeanInfo;
    private final String mBeanName;

    public ExternBean(Injector injector, Gson gson, Key<?> objKey, ImmutableMap<String, Method> methodsByName) {
        this.injector = injector;
        this.gson = gson;

        this.objKey = objKey;
        checkNotNull(injector.getExistingBinding(this.objKey));

        this.methodsByName = methodsByName;

        this.mBeanInfo = new MBeanInfo(
                objKey.getTypeLiteral().getRawType().getName(),
                null,
                null,
                null,
                this.methodsByName.values().stream()
                        .map(method -> new MBeanOperationInfo(null, method))
                        .toArray(MBeanOperationInfo[]::new),
                null);

        Class<?> declaringClass = objKey.getTypeLiteral().getRawType();
        String jmxDomain = declaringClass.getPackage().getName() + ":";
        String jmxName = "name=" + declaringClass.getSimpleName() + "OpsMBean";
        Optional<Named> annotationOpt = objKey.getAnnotation() instanceof Named
                ? Optional.of((Named) objKey.getAnnotation()) : Optional.empty();
        String jmxScope = annotationOpt.map(a -> ",scope=" + a.value()).orElse("");
        this.mBeanName = jmxDomain + jmxName + jmxScope;
    }

    @Override
    public MBeanInfo getMBeanInfo() {
        return mBeanInfo;
    }

    @Override
    public Object invoke(String actionName, Object[] params, String[] signature) throws MBeanException, ReflectionException {
        try {
            log.info("Invoking method {}", actionName);
            Object result = methodsByName.get(actionName)
                    .invoke(injector.getInstance(objKey), params);
            return gson.toJson(result);
        } catch (Exception ex) {
            log.error("Failed method invoke {}", actionName, ex);
            throw new MBeanException(ex);
        }
    }

    @Override
    public Object getAttribute(String attribute) throws AttributeNotFoundException, MBeanException, ReflectionException {
        throw new AttributeNotFoundException();
    }

    @Override
    public void setAttribute(Attribute attribute) throws AttributeNotFoundException, InvalidAttributeValueException, MBeanException, ReflectionException {
        throw new AttributeNotFoundException();
    }

    @Override
    public AttributeList getAttributes(String[] attributes) {
        throw new NotImplementedException();
    }

    @Override
    public AttributeList setAttributes(AttributeList attributes) {
        throw new NotImplementedException();
    }

    public String getMBeanName() {
        return mBeanName;
    }
}
