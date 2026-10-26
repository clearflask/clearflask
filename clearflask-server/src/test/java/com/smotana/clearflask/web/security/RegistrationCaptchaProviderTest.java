package com.smotana.clearflask.web.security;

import com.google.gson.Gson;
import com.smotana.clearflask.security.limiter.challenge.CaptchaChallenger;
import com.sun.net.httpserver.HttpServer;
import org.junit.Test;
import java.net.InetSocketAddress;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class RegistrationCaptchaProviderTest {
    @Test
    public void registrationFailsClosedEvenWhenOrdinaryCaptchaAllowsProviderOutage() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/verify", exchange -> {
            exchange.sendResponseHeaders(503, -1);
            exchange.close();
        });
        server.start();
        try {
            CaptchaChallenger challenger = new CaptchaChallenger();
            CaptchaChallenger.Config config = mock(CaptchaChallenger.Config.class);
            when(config.enabled()).thenReturn(true);
            when(config.allowOnUnavailable()).thenReturn(true);
            when(config.recaptchaV2Api()).thenReturn("http://127.0.0.1:" + server.getAddress().getPort() + "/verify");
            when(config.secretKey()).thenReturn("test-only");
            RegistrationCaptchaTest.inject(challenger, "config", config);
            RegistrationCaptchaTest.inject(challenger, "gson", new Gson());
            String solution = "{\"version\":\"RECAPTCHA_V2\",\"solution\":\"test-only\"}";
            assertTrue(challenger.verify("127.0.0.1", "normal", solution));
            assertFalse(challenger.verifyRegistration("127.0.0.1", "registration", solution));
            when(config.enabled()).thenReturn(false);
            assertFalse(challenger.verifyRegistration("127.0.0.1", "registration", solution));
        } finally {
            server.stop(0);
        }
    }
}
