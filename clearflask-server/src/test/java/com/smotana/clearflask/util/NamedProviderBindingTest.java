// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.util;

import com.google.common.base.Suppliers;
import com.google.inject.AbstractModule;
import com.google.inject.CreationException;
import com.google.inject.Guice;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.Key;
import com.google.inject.Singleton;
import com.google.inject.TypeLiteral;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.UUID;
import java.util.function.Supplier;

import static org.junit.Assert.*;

@Slf4j
public class NamedProviderBindingTest {

    interface NamedProviderBindingTestInterfaceGeneral {
        String getAString();

        String getANamedString();

        String getANamedStringFromSupplier();

        String getADynamicString();

        String getADynamicStringFromSupplier();

        boolean isInjectedCtorExecuted();

        boolean isInjectedMethodExecuted();
    }

    @Singleton
    private static class NamedProviderBindingTestClassGeneral implements NamedProviderBindingTestInterfaceGeneral {
        /**
         * Injected By Guice.
         */
        @Inject
        String aString;

        /**
         * Injected By Guice.
         */
        @Inject
        @Named("aNamedString")
        String aNamedString;

        /**
         * Injected By Guice.
         */
        @Inject
        @Named("aNamedSupplier")
        Supplier<String> aNamedSupplier;

        /**
         * Injected By provider. Requires a bind of String annotated with NAME.
         */
        @InjectNamed
        String aDynamicString;

        /**
         * Injected By provider.
         */
        @InjectNamed
        Supplier<String> aDynamicSupplier;

        boolean injectedCtorExecuted = false;

        @Inject
        private NamedProviderBindingTestClassGeneral() {
            injectedCtorExecuted = true;
        }

        boolean injectedMethodExecuted = false;

        @Inject
        private void injectMe() {
            injectedMethodExecuted = true;

            // Assert properties have been assigned already
            assertTestClassGeneralPropertiesPresent(this);
        }

        @Override
        public String getAString() {
            return aString;
        }

        @Override
        public String getANamedString() {
            return aNamedString;
        }

        @Override
        public String getANamedStringFromSupplier() {
            return aNamedSupplier.get();
        }

        @Override
        public String getADynamicString() {
            return aDynamicString;
        }

        @Override
        public String getADynamicStringFromSupplier() {
            return aDynamicSupplier.get();
        }

        @Override
        public boolean isInjectedCtorExecuted() {
            return injectedCtorExecuted;
        }

        @Override
        public boolean isInjectedMethodExecuted() {
            return injectedMethodExecuted;
        }

    }

    @Test(timeout = 5000L)
    public void testGeneral() {
        final String NAME = UUID.randomUUID().toString();
        final String INAME = UUID.randomUUID().toString();

        Injector injector = Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassGeneral.class));
                install(NamedProviderBinding.namedModule(Names.named(INAME), NamedProviderBindingTestClassGeneral.class, NamedProviderBindingTestInterfaceGeneral.class));
                bind(String.class).toInstance("aString");
                bind(String.class).annotatedWith(Names.named("aNamedString")).toInstance("aNamedString");
                bind(new TypeLiteral<Supplier<String>>() {
                }).annotatedWith(Names.named("aNamedSupplier")).toInstance(Suppliers.ofInstance("aNamedSupplier"));
                bind(String.class).annotatedWith(Names.named(NAME)).toInstance("aDynamicString");
                bind(new TypeLiteral<Supplier<String>>() {
                }).annotatedWith(Names.named(NAME)).toInstance(Suppliers.ofInstance("aDynamicSupplier"));

                bind(String.class).annotatedWith(Names.named(INAME)).toInstance("aDynamicString");
                bind(new TypeLiteral<Supplier<String>>() {
                }).annotatedWith(Names.named(INAME)).toInstance(Suppliers.ofInstance("aDynamicSupplier"));
            }
        });
        NamedProviderBindingTestClassGeneral instance = injector.getInstance(Key.get(NamedProviderBindingTestClassGeneral.class, Names.named(NAME)));
        NamedProviderBindingTestInterfaceGeneral instanceDerivingInterface = injector.getInstance(Key.get(NamedProviderBindingTestInterfaceGeneral.class, Names.named(INAME)));
        assertNotEquals(instance, instanceDerivingInterface);

        assertTestClassGeneralPropertiesPresent(instance);
        assertTestInterfaceGeneralPropertiesPresent(instance);
        assertTestInterfaceGeneralPropertiesPresent(instanceDerivingInterface);

        // Ensure injected constructor and method was executed
        assertTrue(instance.injectedCtorExecuted);
        assertTrue(instance.injectedMethodExecuted);
        assertTrue(instance.isInjectedCtorExecuted());
        assertTrue(instance.isInjectedMethodExecuted());
        assertTrue(instanceDerivingInterface.isInjectedCtorExecuted());
        assertTrue(instanceDerivingInterface.isInjectedMethodExecuted());
    }

    private static void assertTestClassGeneralPropertiesPresent(NamedProviderBindingTestClassGeneral instance) {
        assertNotNull(instance);
        assertNotNull(instance.aString);
        assertEquals("aString", instance.aString);
        assertNotNull(instance.aNamedString);
        assertEquals("aNamedString", instance.aNamedString);
        assertNotNull(instance.aNamedSupplier);
        assertEquals("aNamedSupplier", instance.aNamedSupplier.get());
        assertNotNull(instance.aDynamicString);
        assertEquals("aDynamicString", instance.aDynamicString);
        assertNotNull(instance.aDynamicSupplier);
        assertEquals("aDynamicSupplier", instance.aDynamicSupplier.get());
    }

    private static void assertTestInterfaceGeneralPropertiesPresent(NamedProviderBindingTestInterfaceGeneral instance) {
        assertNotNull(instance);
        assertNotNull(instance.getAString());
        assertEquals("aString", instance.getAString());
        assertNotNull(instance.getANamedString());
        assertEquals("aNamedString", instance.getANamedString());
        assertNotNull(instance.getANamedStringFromSupplier());
        assertEquals("aNamedSupplier", instance.getANamedStringFromSupplier());
        assertNotNull(instance.getADynamicString());
        assertEquals("aDynamicString", instance.getADynamicString());
        assertNotNull(instance.getADynamicStringFromSupplier());
        assertEquals("aDynamicSupplier", instance.getADynamicStringFromSupplier());
    }

    @Singleton
    private static class NamedProviderBindingTestClassSingleton {
        boolean value = false;
    }

    private static class NamedProviderBindingTestClassNotSingleton {
        boolean value = false;
    }

    @Test(timeout = 5000L)
    public void testSingleton() {
        final String NAME = UUID.randomUUID().toString();
        final String NAME2 = UUID.randomUUID().toString();

        Injector injector = Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassSingleton.class));
                install(NamedProviderBinding.namedModule(Names.named(NAME2), NamedProviderBindingTestClassSingleton.class));
            }
        });
        NamedProviderBindingTestClassSingleton singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassSingleton.class, Names.named(NAME)));
        assertNotNull(singletonInstance);
        assertFalse(singletonInstance.value);
        singletonInstance.value = true;

        singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassSingleton.class, Names.named(NAME)));
        assertNotNull(singletonInstance);
        assertTrue(singletonInstance.value);

        singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassSingleton.class, Names.named(NAME2)));
        assertNotNull(singletonInstance);
        assertFalse(singletonInstance.value);
    }

    @Test(timeout = 5000L)
    public void testNotSingleton() {
        final String NAME = UUID.randomUUID().toString();
        final String NAME2 = UUID.randomUUID().toString();

        Injector injector = Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassNotSingleton.class));
                install(NamedProviderBinding.namedModule(Names.named(NAME2), NamedProviderBindingTestClassNotSingleton.class));
            }
        });
        NamedProviderBindingTestClassNotSingleton singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassNotSingleton.class, Names.named(NAME)));
        assertNotNull(singletonInstance);
        assertFalse(singletonInstance.value);
        singletonInstance.value = true;

        singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassNotSingleton.class, Names.named(NAME)));
        assertNotNull(singletonInstance);
        assertFalse(singletonInstance.value);

        singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassNotSingleton.class, Names.named(NAME2)));
        assertNotNull(singletonInstance);
        assertFalse(singletonInstance.value);
    }

    @Singleton
    private static class NamedProviderBindingTestClassNoArgCtor {
        private NamedProviderBindingTestClassNoArgCtor() {
        }
    }

    @Singleton
    private static class NamedProviderBindingTestClassNoArgInjectedCtor {
        @Inject
        private NamedProviderBindingTestClassNoArgInjectedCtor() {
        }
    }

    @Singleton
    private static class NamedProviderBindingTestClassInjectedCtor {
        final String aString;
        final String aNamedString;
        final Supplier<String> aNamedSupplier;

        @Inject
        private NamedProviderBindingTestClassInjectedCtor(String aString, @Named("aNamedString") String aNamedString, @Named("aNamedSupplier") Supplier<String> aNamedSupplier) {
            this.aString = aString;
            this.aNamedString = aNamedString;
            this.aNamedSupplier = aNamedSupplier;
        }
    }

    @Singleton
    private static class NamedProviderBindingTestClassMultipleInjectedCtor {
        @Inject
        private NamedProviderBindingTestClassMultipleInjectedCtor() {
        }

        @Inject
        private NamedProviderBindingTestClassMultipleInjectedCtor(String aString, @Named("aNamedString") String aNamedString) {
        }
    }

    @Test(timeout = 5000L)
    public void testNoArgCtor() {
        final String NAME = UUID.randomUUID().toString();

        Injector injector = Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassNoArgCtor.class));
            }
        });
        NamedProviderBindingTestClassNoArgCtor singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassNoArgCtor.class, Names.named(NAME)));
        assertNotNull(singletonInstance);
    }

    @Test(timeout = 5000L)
    public void testNoArgInjectedCtor() {
        final String NAME = UUID.randomUUID().toString();

        Injector injector = Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassNoArgInjectedCtor.class));
            }
        });
        NamedProviderBindingTestClassNoArgInjectedCtor singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassNoArgInjectedCtor.class, Names.named(NAME)));
        assertNotNull(singletonInstance);
    }

    @Test(timeout = 5000L)
    public void testInjectedCtor() {
        final String NAME = UUID.randomUUID().toString();

        Injector injector = Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassInjectedCtor.class));
                bind(String.class).toInstance("aString");
                bind(String.class).annotatedWith(Names.named("aNamedString")).toInstance("aNamedString");
                bind(new TypeLiteral<Supplier<String>>() {
                }).annotatedWith(Names.named("aNamedSupplier")).toInstance(Suppliers.ofInstance("aNamedSupplier"));
            }
        });
        NamedProviderBindingTestClassInjectedCtor singletonInstance = injector.getInstance(Key.get(NamedProviderBindingTestClassInjectedCtor.class, Names.named(NAME)));
        assertNotNull(singletonInstance);
        assertEquals("aString", singletonInstance.aString);
        assertEquals("aNamedString", singletonInstance.aNamedString);
        assertEquals("aNamedSupplier", singletonInstance.aNamedSupplier.get());
    }

    @Test(timeout = 5000L, expected = CreationException.class)
    public void testInjectedCtorMissingArgumentBinding() {
        final String NAME = UUID.randomUUID().toString();

        Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassInjectedCtor.class));
                bind(String.class).toInstance("aString");
                bind(String.class).annotatedWith(Names.named("aNamedString")).toInstance("aNamedString");
            }
        });
    }

    @Test(timeout = 5000L, expected = CreationException.class)
    public void testMultipleInjectedCtor() {
        final String NAME = UUID.randomUUID().toString();

        Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassMultipleInjectedCtor.class));
                bind(String.class).toInstance("aString");
                bind(String.class).annotatedWith(Names.named("aNamedString")).toInstance("aNamedString");
            }
        });
    }

    @Singleton
    private static class NamedProviderBindingTestClassDoubleNamed {
        /**
         * Double named object. Incorrect usage.
         */
        @InjectNamed
        @Named("aDynamicNamedString")
        String aDynamicNamedString;
    }

    @Test(timeout = 5000L, expected = CreationException.class)
    public void testDoubleNamed() {
        final String NAME = UUID.randomUUID().toString();

        Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassDoubleNamed.class));
                bind(String.class).annotatedWith(Names.named(NAME)).toInstance("aDynamicNamedString");
            }
        });
    }

    @Singleton
    private static class NamedProviderBindingTestClassDoubleInjected {
        /**
         * Double injected object. Incorrect usage.
         */
        @Inject
        @InjectNamed
        String aDynamicInjectedString;
    }

    @Test(timeout = 5000L, expected = CreationException.class)
    public void testDoubleInjected() {
        final String NAME = UUID.randomUUID().toString();

        Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassDoubleInjected.class));
                bind(String.class).annotatedWith(Names.named(NAME)).toInstance("aDynamicInjectedString");
            }
        });
    }

    @Singleton
    private static class NamedProviderBindingTestClassExtraInject {
        @Inject
        @InjectNamed
        String aString;
    }

    @Test(timeout = 5000L, expected = CreationException.class)
    public void testExtraInject() {
        final String NAME = UUID.randomUUID().toString();

        Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassExtraInject.class));
                bind(String.class).annotatedWith(Names.named(NAME)).toInstance("aString");
            }
        });
    }

    @Singleton
    private static class NamedProviderBindingTestClassNamedField {
        @InjectNamed
        Supplier<String> aDynamicSupplier;
    }

    @Test(timeout = 5000L, expected = CreationException.class)
    public void testMissingFieldBinding() {
        final String NAME = UUID.randomUUID().toString();

        Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassNamedField.class));
            }
        });
    }

    private static abstract class NamedProviderBindingTestClassAbstractClass {
        @InjectNamed
        String aStringAbstract;
    }

    @Singleton
    private static class NamedProviderBindingTestClassImplClass extends NamedProviderBindingTestClassAbstractClass {
        @InjectNamed
        Long aLongImpl;
    }

    @Test(timeout = 5000L)
    public void testInheritance() {
        final String NAME = UUID.randomUUID().toString();

        Injector injector = Guice.createInjector(new AbstractModule() {
            @Override
            protected void configure() {
                install(NamedProviderBinding.namedModule(Names.named(NAME), NamedProviderBindingTestClassImplClass.class));
                bind(String.class).annotatedWith(Names.named(NAME)).toInstance("aString");
                bind(Long.class).annotatedWith(Names.named(NAME)).toInstance(4L);
            }
        });

        NamedProviderBindingTestClassImplClass instance = injector.getInstance(Key.get(NamedProviderBindingTestClassImplClass.class, Names.named(NAME)));
        assertEquals("aString", instance.aStringAbstract);
        assertEquals(Long.valueOf(4L), instance.aLongImpl);
    }
}