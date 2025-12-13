// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.push.provider;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.LogUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.*;
import org.apache.http.Header;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.jose4j.lang.JoseException;
import rx.Observable;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.*;
import java.security.spec.InvalidKeySpecException;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.stream.Stream;

import static com.google.common.base.Preconditions.checkState;

@Slf4j
@Singleton
public class BrowserPushServiceImpl implements BrowserPushService {

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        Observable<Boolean> enabledObservable();

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

    private final PushService pushService = new PushService();

    @Inject
    private void setup() {
        Optional<String> providerInfoOpt = Optional.ofNullable(Security.getProvider(BouncyCastleProvider.PROVIDER_NAME))
                .map(Provider::getInfo);
        if (!providerInfoOpt.equals(Optional.of("BouncyCastle Security Provider v1.70"))) {
            BouncyCastleProvider bouncyCastleProvider = new BouncyCastleProvider();
            Security.insertProviderAt(bouncyCastleProvider, 1);
            log.info("Inserted Security Provider {}; existing info {} new info {}",
                    BouncyCastleProvider.PROVIDER_NAME, providerInfoOpt, bouncyCastleProvider.getInfo());
        }
        Provider[] providers = Security.getProviders();
        for (int i = 0; i < providers.length; i++) {
            log.info("Security Provider {}: {} ", i + 1, providers[i].getName());
        }

        Stream.of(
                        config.enabledObservable(),
                        config.publicKeyObservable(),
                        config.privateKeyObservable())
                .forEach(o -> o.subscribe(v -> setKeyPair(config.publicKey(), config.privateKey())));
        setKeyPair(config.publicKey(), config.privateKey());
    }

    private void setKeyPair(String publicKeyStr, String privateKeyStr) {
        if (!config.enabled()) {
            log.debug("Not enabled, not setting keypair");
            return;
        }

        PublicKey publicKey;
        PrivateKey privateKey;
        try {
            publicKey = Utils.loadPublicKey(publicKeyStr);
            privateKey = Utils.loadPrivateKey(privateKeyStr);
        } catch (NoSuchProviderException | NoSuchAlgorithmException | InvalidKeySpecException ex) {
            throw new RuntimeException(ex);
        }
        checkState(Utils.verifyKeyPair(privateKey, publicKey), "Configuration mismatch, public/private keys do not match");
        pushService.setKeyPair(new KeyPair(publicKey, privateKey));
    }

    @Override
    public void send(BrowserPush browserPush) {
        if (!config.enabled()) {
            log.debug("Not enabled, skipping");
            return;
        }

        Subscription subscription;
        try {
            subscription = gson.fromJson(browserPush.getSubscription(), Subscription.class);
        } catch (JsonSyntaxException ex) {
            throw new RuntimeException("Cannot parse browser subscription: " + browserPush.getSubscription(), ex);
        }
        HttpResponse response;
        try {
            response = pushService.send(Notification.builder()
                    .endpoint(subscription.endpoint)
                    .userPublicKey(subscription.keys.p256dh)
                    .userAuth(subscription.keys.auth)
                    .urgency(config.urgency())
                    .payload(gson.toJson(Payload.builder()
                            .notificationTitle(browserPush.getTitle())
                            .notificationOptions(Payload.Options.builder()
                                    .silent(true)
                                    .body(browserPush.getBody())
                                    .build())
                            .build()))
                    .build());
        } catch (InterruptedException | ExecutionException | GeneralSecurityException | IOException |
                 JoseException ex) {
            throw new RuntimeException("Cannot parse public key for subscription: " + browserPush.getSubscription(), ex);
        }

        switch (response.getStatusLine().getStatusCode()) {
            case 201:
                break;
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
                break;
            case 400:
                if (LogUtil.rateLimitAllowLog("browserpush-invalidrequest")) {
                    log.warn("Invalid request, notification {} subscription {}",
                            browserPush, subscription);
                }
                break;
            case 404:
                log.debug("Subscription expired for projectId {} userId {}",
                        browserPush.getProjectId(), browserPush.getUserId());
                userStore.updateUser(browserPush.getProjectId(), browserPush.getUserId(),
                        UserUpdate.builder().browserPushToken("").build());
                break;
            case 410:
                log.debug("Subscription no longer valid for projectId {} userId {}",
                        browserPush.getProjectId(), browserPush.getUserId());
                userStore.updateUser(browserPush.getProjectId(), browserPush.getUserId(),
                        UserUpdate.builder().browserPushToken("").build());
                break;
            case 413:
                if (LogUtil.rateLimitAllowLog("browserpush-payloadtoolarge")) {
                    log.warn("Payload too large, projectId, {} userId {}",
                            browserPush.getProjectId(), browserPush.getUserId());
                }
                break;
            default:
                if (LogUtil.rateLimitAllowLog("browserpush-unknown")) {
                    log.warn("Failed to send notification, unknown reason with http code {} browserPush {}",
                            response.getStatusLine().getStatusCode(), browserPush);
                }
                break;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(BrowserPushService.class).to(BrowserPushServiceImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
