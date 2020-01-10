package com.smotana.clearflask.util;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import java.util.Base64;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

@Slf4j
@RunWith(Parameterized.class)
public class ServerSecretTest extends AbstractTest {

    @Inject
    @Named("testOne")
    private ServerSecret serverSecretOne;
    @Inject
    @Named("testTwo")
    private ServerSecret serverSecretTwo;

    @Override
    protected void configure() {
        super.configure();

        Named serverSecretNameOne = Names.named("testOne");
        Named serverSecretNameTwo = Names.named("testTwo");

        install(Modules.override(
                DefaultServerSecret.module(serverSecretNameOne),
                DefaultServerSecret.module(serverSecretNameTwo)
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, serverSecretNameOne, om -> {
                    om.override(om.id().sharedKey()).withValue(getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, serverSecretNameTwo, om -> {
                    om.override(om.id().sharedKey()).withValue(getRandomSharedKey());
                }));
            }
        }));
    }

    @Parameterized.Parameter(0)
    public String expected;

    @Parameterized.Parameters(name = "{0}")
    public static Object[][] data() {
        return new Object[][]{
                {"dctfvgh476589!@#$%^&*(][;.'>:"},
                {"a"},
                {"1"},
                {""},
                {" "}
        };
    }

    @Test(timeout = 5_000L)
    public void test() throws Exception {
        String cipherTextOne = serverSecretOne.encryptString(expected);
        String cipherTextTwo = serverSecretTwo.encryptString(expected);
        String actualOne = serverSecretOne.decryptString(cipherTextOne);
        String actualTwo = serverSecretTwo.decryptString(cipherTextTwo);
        assertEquals(expected, actualOne);
        assertEquals(expected, actualTwo);
        assertNotEquals(cipherTextOne, cipherTextTwo);
        assertNotEquals(serverSecretOne.encryptString(expected), serverSecretOne.encryptString(expected));
    }

    public static String getRandomSharedKey() {
        byte[] sharedKey = new byte[16];
        ThreadLocalRandom.current().nextBytes(sharedKey);
        return Base64.getEncoder().encodeToString(sharedKey);
    }
}