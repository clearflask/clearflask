package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.NotificationStore.NotificationListResponse;
import com.smotana.clearflask.store.NotificationStore.NotificationModel;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoNotificationStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ServerSecretTest;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Base64Encoder;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.spec.ECNamedCurveParameterSpec;
import org.junit.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.stream.LongStream;

import static nl.martijndwars.webpush.Utils.ALGORITHM;
import static nl.martijndwars.webpush.Utils.CURVE;
import static org.bouncycastle.jce.provider.BouncyCastleProvider.PROVIDER_NAME;
import static org.junit.Assert.*;

@Slf4j
public class NotificationStoreTest extends AbstractTest {

    @Inject
    private NotificationStore store;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DynamoNotificationStore.module(),
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                DefaultServerSecret.module(Names.named("cursor"))
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoNotificationStore.Config.class, om -> {
                    om.override(om.id().searchFetchMax()).withValue(10);
                }));
            }
        }));
    }

    @Test(timeout = 5_000L)
    public void test() throws Exception {
        String projectId = IdUtil.randomId();
        String userId = IdUtil.randomId();

        NotificationModel notification1 = randomNotification(projectId, userId, "description 1");
        store.notificationCreate(notification1);
        assertEquals(ImmutableList.of(notification1), store.notificationList(projectId, userId, Optional.empty()).getNotifications());

        NotificationModel notification2 = randomNotification(projectId, userId, "description 2");
        store.notificationCreate(notification2);
        assertEquals(ImmutableList.of(notification2, notification1), store.notificationList(projectId, userId, Optional.empty()).getNotifications());

        NotificationModel notification3 = randomNotification(projectId, userId, "description 3");
        store.notificationCreate(notification3);
        assertEquals(ImmutableList.of(notification3, notification2, notification1), store.notificationList(projectId, userId, Optional.empty()).getNotifications());

        configSet(DynamoNotificationStore.Config.class, "searchFetchMax", "2");
        NotificationListResponse result = store.notificationList(projectId, userId, Optional.empty());
        assertEquals(ImmutableList.of(notification3, notification2), result.getNotifications());
        assertTrue(result.getCursorOpt().isPresent());

        result = store.notificationList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(notification1), result.getNotifications());
        assertFalse(result.getCursorOpt().isPresent());

        store.notificationClear(projectId, userId, notification2.getNotificationId());
        result = store.notificationList(projectId, userId, Optional.empty());
        assertEquals(ImmutableList.of(notification3, notification1), result.getNotifications());
        assertTrue(result.getCursorOpt().isPresent());

        result = store.notificationList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(), result.getNotifications());
        assertFalse(result.getCursorOpt().isPresent());

        store.notificationClearAll(projectId, userId);
        assertEquals(ImmutableList.of(), store.notificationList(projectId, userId, Optional.empty()).getNotifications());
    }

    private NotificationModel randomNotification(String projectId, String userId, String description) {
        return new NotificationModel(
                projectId,
                userId,
                store.genNotificationId(),
                IdUtil.randomId(),
                null,
                Instant.now(),
                Instant.now().plus(1, ChronoUnit.HOURS),
                description
        );
    }

    @Test(timeout = 5_000L)
    public void testestset() throws Exception {
        LongStream.range(0, 40).forEach(a -> {
            try {
                Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());
                ECNamedCurveParameterSpec parameterSpec = ECNamedCurveTable.getParameterSpec(CURVE);

                KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance(ALGORITHM, PROVIDER_NAME);
                keyPairGenerator.initialize(parameterSpec);

                KeyPair keyPair = keyPairGenerator.generateKeyPair();

                ECPublicKey publicKey = (ECPublicKey) keyPair.getPublic();
                ECPrivateKey privateKey = (ECPrivateKey) keyPair.getPrivate();

                byte[] encodedPublicKey = Utils.encode(publicKey);
                byte[] encodedPrivateKey = Utils.encode(privateKey);

                String pub = Base64Encoder.encodeUrl(encodedPublicKey);
                String pri = Base64Encoder.encodeUrl(encodedPrivateKey);
                log.info("AAAAA pub {}", pub);
                log.info("AAAAA pri {}", pri);

                new PushService().setKeyPair(new KeyPair(Utils.loadPublicKey(pub), Utils.loadPrivateKey(pri)));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

    }
}