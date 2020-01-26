package com.smotana.clearflask.core.push.provider;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.core.push.PushProvider;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.LogUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import nl.martijndwars.webpush.Urgency;
import nl.martijndwars.webpush.Utils;
import org.apache.http.Header;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.jose4j.lang.JoseException;
import rx.Observable;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Security;
import java.security.spec.InvalidKeySpecException;
import java.util.concurrent.ExecutionException;
import java.util.stream.Stream;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Singleton
public class BrowserPushProvider implements PushProvider {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("NORMAL")
        Urgency urgency();

        @NoDefaultValue
        String publicKey();

        Observable<String> publicKeyObservable();

        @NoDefaultValue
        String privateKey();

        Observable<String> privateKeyObservable();
    }

    @Value
    @Builder
    @AllArgsConstructor
    public static class Payload {
        @NonNull
        private final String notificationTitle;
        @NonNull
        private final Options notificationOptions;

        /**
         * See https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
         */
        @Value
        @Builder
        @AllArgsConstructor
        public static class Options {
            private final String body;
            private final Boolean silent;
        }
    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;
    @Inject
    private UserStore userStore;

    private final PushService browserPush = new PushService();

    @Inject
    private void setup() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }

        Stream.of(
                config.publicKeyObservable(),
                config.privateKeyObservable())
                .forEach(o -> o.subscribe(v -> setKeyPair(config.publicKey(), config.privateKey())));
        setKeyPair(config.publicKey(), config.privateKey());
    }

    private void setKeyPair(String publicKeyStr, String privateKeyStr) {
        PublicKey publicKey;
        PrivateKey privateKey;
        try {
            publicKey = Utils.loadPublicKey(publicKeyStr);
            privateKey = Utils.loadPrivateKey(privateKeyStr);
        } catch (NoSuchProviderException | NoSuchAlgorithmException | InvalidKeySpecException ex) {
            throw new RuntimeException(ex);
        }
        checkState(Utils.verifyKeyPair(privateKey, publicKey), "Configuration mismatch, public/private keys do not match");
        browserPush.setKeyPair(new KeyPair(publicKey, privateKey));
    }

    @Override
    public boolean send(NotificationModel notification, String subscriptionStr) {
        if (!config.enabled()) {
            return false;
        }

        Subscription subscription;
        try {
            subscription = gson.fromJson(subscriptionStr, Subscription.class);
        } catch (JsonSyntaxException ex) {
            throw new RuntimeException("Cannot parse browser subscription: " + subscriptionStr, ex);
        }
        HttpResponse response;
        try {
            response = browserPush.send(Notification.builder()
                    .endpoint(subscription.endpoint)
                    .userPublicKey(subscription.keys.p256dh)
                    .userAuth(subscription.keys.auth)
                    .urgency(config.urgency())
                    .payload(gson.toJson(Payload.builder()
                            .notificationTitle(notification.getTitle())
                            .notificationOptions(Payload.Options.builder()
                                    .silent(true)
                                    .body(notification.getBody())
                                    .build())
                            .build()))
                    .build());
        } catch (InterruptedException | ExecutionException | GeneralSecurityException | IOException | JoseException ex) {
            throw new RuntimeException("Cannot parse public key for subscription: " + subscriptionStr, ex);
        }

        switch (response.getStatusLine().getStatusCode()) {
            case 201:
                return true;
            case 429:
                Header retryAfterHeader = response.getFirstHeader("retry-after");
                String hostname;
                try {
                    hostname = new URL(subscription.endpoint).getHost();
                } catch (MalformedURLException exception) {
                    hostname = "unknown";
                }
                if (LogUtil.rateLimitAllowLog("browserpush-ratelimited")) {
                    log.warn("Push service limit reached, endpoint retry-after {} host {}",
                            retryAfterHeader == null ? null : retryAfterHeader.getValue(), hostname);
                }
                return false;
            case 400:
                if (LogUtil.rateLimitAllowLog("browserpush-invalidrequest")) {
                    log.warn("Invalid request, notification {} subscription {}",
                            notification, subscription);
                }
                return false;
            case 404:
                log.debug("Subscription expired for projectId {} userId {}",
                        notification.getProjectId(), notification.getUserId());
                userStore.updateUser(notification.getProjectId(), notification.getUserId(),
                        UserUpdate.builder().browserPushToken("").build());
                return false;
            case 410:
                log.debug("Subscription no longer valid for projectId {} userId {}",
                        notification.getProjectId(), notification.getUserId());
                userStore.updateUser(notification.getProjectId(), notification.getUserId(),
                        UserUpdate.builder().browserPushToken("").build());
                return false;
            case 413:
                if (LogUtil.rateLimitAllowLog("browserpush-payloadtoolarge")) {
                    log.warn("Payload too large, projectId, {} userId {}",
                            notification.getProjectId(), notification.getUserId());
                }
                return false;
            default:
                if (LogUtil.rateLimitAllowLog("browserpush-unknown")) {
                    log.warn("Failed to send notification, unknown reason with http code {} projectId, {} userId {}",
                            response.getStatusLine().getStatusCode(), notification.getProjectId(), notification.getUserId());
                }
                return false;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(PushProvider.class).annotatedWith(Names.named("Browser"))
                        .to(BrowserPushProvider.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
