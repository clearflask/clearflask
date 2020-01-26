package com.smotana.clearflask.core.push;

import com.amazonaws.auth.AWSCredentialsProvider;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.regions.Regions;
import com.google.common.util.concurrent.ControllableSleepingStopwatch;
import com.google.common.util.concurrent.GuavaRateLimiters;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.core.email.AmazonSimpleEmailServiceProvider;
import com.smotana.clearflask.core.push.provider.BrowserPushProvider;
import com.smotana.clearflask.core.push.provider.EmailPushProvider;
import com.smotana.clearflask.security.limiter.challenge.MockChallenger;
import com.smotana.clearflask.security.limiter.rate.LocalRateLimiter;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.testutil.AbstractTest;
import nl.martijndwars.webpush.Base64Encoder;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.spec.ECNamedCurveParameterSpec;
import org.junit.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;

import static nl.martijndwars.webpush.Utils.ALGORITHM;
import static nl.martijndwars.webpush.Utils.CURVE;
import static org.bouncycastle.jce.provider.BouncyCastleProvider.PROVIDER_NAME;

public class NotificationServiceTest extends AbstractTest {

    @Inject
    private NotificationService service;

    @Override
    protected void configure() {
        super.configure();

        bind(AWSCredentialsProvider.class).toInstance(new AWSStaticCredentialsProvider(new BasicAWSCredentials("", "")));
        bindMock(UserStore.class);

        install(Modules.override(
                NotificationServiceImpl.module(),
                MultiPushProviderImpl.module(),
                AmazonSimpleEmailServiceProvider.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(BrowserPushProvider.Config.class, om -> {
                    KeyPair keyPair = generateKeyPair();
                    om.override(om.id().publicKey()).withValue(encodePublicKey(keyPair));
                    om.override(om.id().privateKey()).withValue(encodePrivateKey(keyPair));
                    om.override(om.id().enabled()).withValue(false);
                }));
                install(ConfigSystem.overrideModule(EmailPushProvider.Config.class, om -> {
                    om.override(om.id().enabled()).withValue(false);
                }));
                install(ConfigSystem.overrideModule(AmazonSimpleEmailServiceProvider.Config.class, om -> {
                    om.override(om.id().region()).withValue(Regions.US_GOV_EAST_1.getName());
                }));
            }
        }));

        install(MockChallenger.module());

        install(LocalRateLimiter.module());
        ControllableSleepingStopwatch controllableSleepingStopwatch = new ControllableSleepingStopwatch();
        install(GuavaRateLimiters.testModule(controllableSleepingStopwatch));
        bind(ControllableSleepingStopwatch.class).toInstance(controllableSleepingStopwatch);
    }

    @Test(timeout = 5_000L)
    public void testOnStatusOrResponseChanged() throws Exception {
        service.onStatusOrResponseChanged(null, true, true);
    }

    @Test(timeout = 5_000L)
    public void testOnCommentReply() throws Exception {
        service.onCommentReply(null, null, null);
    }

    private KeyPair generateKeyPair() {
        try {
            Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());

            ECNamedCurveParameterSpec parameterSpec = ECNamedCurveTable.getParameterSpec(CURVE);

            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance(ALGORITHM, PROVIDER_NAME);
            keyPairGenerator.initialize(parameterSpec);

            return keyPairGenerator.generateKeyPair();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    private String encodePublicKey(KeyPair keyPair) {
        return Base64Encoder.encodeUrl(Utils.encode((ECPublicKey) keyPair.getPublic()));
    }

    private String encodePrivateKey(KeyPair keyPair) {
        return Base64Encoder.encodeUrl(Utils.encode((ECPrivateKey) keyPair.getPrivate()));
    }
}