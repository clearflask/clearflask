package com.smotana.clearflask.util;

import com.google.common.collect.ImmutableMap;
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
import java.lang.ref.WeakReference;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Optional;

import static com.google.common.base.Preconditions.checkNotNull;

@Slf4j
public class ExternBean implements DynamicMBean {

    private final WeakReference<Injector> injectorRef;
    private final Key objKey;
    private final Map<String, Method> methodsByName;
    private final MBeanInfo mBeanInfo;
    private final String mBeanName;

    public ExternBean(WeakReference<Injector> injectorRef, Key objKey, ImmutableMap<String, Method> methodsByName) {
        this.injectorRef = injectorRef;

        this.objKey = objKey;
        checkNotNull(injectorRef.get().getExistingBinding(this.objKey));

        this.methodsByName = methodsByName;

        this.mBeanInfo = new MBeanInfo(
                objKey.getTypeLiteral().getRawType().getName(),
                null,
                null,
                null,
                this.methodsByName.entrySet().stream()
                        .map(e -> new MBeanOperationInfo(null, e.getValue()))
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
            return methodsByName.get(actionName)
                    .invoke(injectorRef.get().getInstance(objKey), params);
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
