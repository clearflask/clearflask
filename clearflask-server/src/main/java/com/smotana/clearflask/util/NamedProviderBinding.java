// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableSet;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.Key;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.binder.ScopedBindingBuilder;
import com.google.inject.internal.Annotations;
import com.google.inject.name.Named;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.annotation.Annotation;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Parameter;
import java.util.ArrayList;

import static com.google.common.base.Preconditions.checkArgument;
import static com.google.common.base.Preconditions.checkNotNull;

/**
 * Allows Guice binding of instances with dynamically injected properties based on a given Named name.
 *
 * Example below shows binding a Voice class to an Animal.
 * <pre><code>
 * {@literal @}Singleton
 * private static class Animal
 * {
 *     private static final String COLOR_SUFFIX = "color";
 *
 *    {@literal @}InjectNamed
 *     Voice voice;
 *
 *     public static Module module(Named name)
 *     {
 *         return new AbstractModule()
 *         {
 *            {@literal @}Override
 *             protected void configure()
 *             {
 *                 install(NamedProviderBinding.namedModule(name, Animal.class));
 *             }
 *         };
 *     }
 * }
 * </code></pre>
 *
 * Now to use it, let's bind an Animal as a cat:
 * <pre><code>
 * private static class House
 * {
 *     private static final String CAT = "cat";
 *
 *    {@literal @}Inject
 *    {@literal @}Named(CAT)
 *     Animal cat;
 *
 *     public static Module module()
 *     {
 *         return new AbstractModule()
 *         {
 *            {@literal @}Override
 *             protected void configure()
 *             {
 *                 install(Animal.module(Names.named(CAT)));
 *                 bind(Voice.class)
 *                      .annotatedWith(Names.named(CAT))
 *                      .to(Meow.class);
 *             }
 *         };
 *     }
 * }
 * </code></pre>
 *
 * Additional notes:
 * <ul>
 * <li>{@literal @}InjectNamed cannot be used in conjunction with {@literal @}Inject nor {@literal @}Named</li>
 * <li>Adding {@literal @}Singleton to the class specifies each Named instance will be a singleton. Absence of the
 * annotation will allow multiple cat instances from above example.</li>
 * <li>When the constructor is called, both {@literal @}InjectNamed and {@literal @}Inject properties are null. To use
 * injected properties, either add the property as an argument to an injected constructor or use an injected
 * method.</li>
 * <li>{@literal @}InjectNamed arguments to constructors and methods are not supported.</li>
 * </ul>
 */
public class NamedProviderBinding {
    private static final Logger log = LoggerFactory.getLogger(NamedProviderBinding.class);

    public static <T> Module namedModule(Named name, Class<T> clazz) {
        return namedModule(name, clazz, clazz);
    }

    /**
     * @param clazz the implementation class
     * @param targetClazz the class being bound
     */
    public static <T> Module namedModule(Named name, Class<? extends T> clazz, Class<T> targetClazz) {
        checkNotNull(name);
        checkArgument(!Strings.isNullOrEmpty(name.value()));

        return new AbstractModule() {
            @Override
            protected void configure() {
                // Find appropriate constructor
                final Constructor<? extends T> constructor;
                try {
                    Constructor<? extends T> ctor = null;
                    for (Constructor potentialCtor : clazz.getDeclaredConstructors()) {
                        if (potentialCtor.isAnnotationPresent(Inject.class)) {
                            if (ctor == null) {
                                ctor = potentialCtor;
                            } else {
                                addError(String.format("Class %s cannot have multiple injected constructors", clazz.getName()));
                                return;
                            }
                        }
                    }
                    if (ctor == null) {
                        ctor = clazz.getDeclaredConstructor();
                    }
                    constructor = ctor;

                    for (Parameter parameter : ctor.getParameters()) {
                        if (parameter.isAnnotationPresent(InjectNamed.class)) {
                            addError(String.format("Named injection not yet supported in injected constructors for class %s", clazz.getName()));
                            return;
                        }
                    }
                } catch (NoSuchMethodException ex) {
                    addError(String.format("Class %s is required to have a no-arg and/or injected constructor", clazz.getName()));
                    return;
                }

                // Find all named fields
                ImmutableSet.Builder<Field> namedFieldsBuilder = ImmutableSet.builder();

                // Iterate over base and parent classes and look for InjectNamed fields
                for (Class c = clazz; c != null; c = c.getSuperclass()) {
                    for (Field field : c.getDeclaredFields()) {
                        if (field.isAnnotationPresent(InjectNamed.class)) {
                            // Sanity check proper annotation usage
                            for (Annotation annotation : field.getAnnotations()) {
                                if (annotation.annotationType() == Inject.class || Annotations.isBindingAnnotation(annotation.annotationType())) {
                                    addError(String.format("Field %s in class %s has invalid combination of annotations %s and %s",
                                            field.getName(), c.getName(), InjectNamed.class.getName(), annotation.annotationType().getName()));
                                    return;
                                }
                            }
                            namedFieldsBuilder.add(field);
                        }
                    }
                }
                final ImmutableSet<Field> namedFields = namedFieldsBuilder.build();

                // Require bindings for all other injected properties
                // Ideally we should require bindings individually and exclude the clazz itself since clazz should never
                // be injected without a Named annotation.
                requireBinding(clazz);

                for (Field namedField : namedFields) {
                    requireBinding(Key.get(namedField.getGenericType(), name));
                }

                // Provider we need to get things bootstrapped:
                final Provider<Injector> injectorProvider = getProvider(Injector.class);

                // Now the main provider binding (note the singleton scope).
                ScopedBindingBuilder bindBuilder = bind(targetClazz)
                        .annotatedWith(name)
                        .toProvider((Provider<T>) () -> {
                            try {
                                // Finally create our instance
                                // Note: we cannot simply ask the injector to get an instance here because the class may be annotated with @Singleton
                                T instance;
                                if (!constructor.isAccessible()) {
                                    constructor.setAccessible(true);
                                }
                                if (constructor.getParameterCount() == 0) {
                                    instance = constructor.newInstance();
                                } else {
                                    // Inject all constructor arguments
                                    ArrayList constructorParams = new ArrayList(constructor.getParameterCount());
                                    for (Parameter parameter : constructor.getParameters()) {
                                        Annotation bindingAnnotation = null;
                                        for (Annotation parameterAnnotation : parameter.getAnnotations()) {
                                            if (Annotations.isBindingAnnotation(parameterAnnotation.annotationType())) {
                                                bindingAnnotation = parameterAnnotation;
                                                break;
                                            }
                                        }

                                        if (bindingAnnotation != null) {
                                            constructorParams.add(injectorProvider.get().getInstance(Key.get(parameter.getParameterizedType(), bindingAnnotation)));
                                        } else {
                                            constructorParams.add(injectorProvider.get().getInstance(Key.get(parameter.getParameterizedType())));
                                        }
                                    }
                                    instance = constructor.newInstance(constructorParams.toArray());
                                }

                                // Set the named fields on the obj
                                for (Field namedField : namedFields) {
                                    if (!namedField.isAccessible()) {
                                        namedField.setAccessible(true);
                                    }
                                    namedField.set(instance, injectorProvider.get().getInstance(Key.get(namedField.getGenericType(), name)));
                                }

                                // Inject dependencies managed directly by Guice
                                // Injected methods will be executed with all properties set
                                injectorProvider.get().injectMembers(instance);

                                return instance;
                            } catch (Exception ex) {
                                throw new RuntimeException(ex);
                            }
                        });
                // Set provider to the desired scope if the class has a defined scope
                Class<? extends Annotation> scopeAnnotation = Annotations.findScopeAnnotation(null, clazz);
                if (scopeAnnotation != null) {
                    bindBuilder.in(scopeAnnotation);
                }
            }

        };

    }
}
