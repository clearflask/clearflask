package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.util.concurrent.ListeningScheduledExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.RemoteLicenseStore;
import com.smotana.clearflask.util.Extern;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static com.smotana.clearflask.api.model.SubscriptionStatus.*;

@Slf4j
@Singleton
public class DynamoRemoteLicenseStore extends ManagedService implements RemoteLicenseStore {

    @Inject
    private SingleTable singleTable;

    private final Cache<Long, Optional<Boolean>> isValidCache = CacheBuilder.newBuilder()
            .expireAfterWrite(1, TimeUnit.DAYS)
            .build();
    private TableSchema<License> licenseSchema;
    private ListeningScheduledExecutorService executor;

    @Inject
    private void setup() {
        licenseSchema = singleTable.parseTableSchema(License.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadScheduledExecutor(new ThreadFactoryBuilder()
                .setNameFormat("LicenseValidator-worker-%d").build()));
        executor.scheduleAtFixedRate(isValidCache::invalidateAll, Duration.ofMinutes(1), Duration.ofDays(1));
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
    }

    @Extern
    private String getLicenseExtern() {
        return getLicense().orElse("<empty>");
    }

    @Override
    public Optional<String> getLicense() {
        return Optional.ofNullable(licenseSchema.fromItem(licenseSchema.table().getItem(new GetItemSpec()
                        .withPrimaryKey(licenseSchema.primaryKey(Map.of(
                                "type", Type.PRIMARY))))))
                .map(License::getLicense);
    }

    @Extern
    @Override
    public void setLicense(String license) {
        licenseSchema.table().putItem(licenseSchema.toItem(new License(Type.PRIMARY, license)));
        isValidCache.invalidateAll();
    }

    @Extern
    @Override
    public void clearLicense() {
        licenseSchema.table().deleteItem(licenseSchema.primaryKey(Map.of("type", Type.PRIMARY)));
        isValidCache.invalidateAll();
    }

    @Override
    @SneakyThrows
    public Optional<Boolean> validateLicenseRemotely(boolean useCache) {
        if (!useCache) {
            isValidCache.invalidateAll();
        }
        return isValidCache.get(0L, () -> getLicense().map(this::validateInternal));
    }

    private boolean validateInternal(String license) {
        try (CloseableHttpClient client = HttpClientBuilder.create().build();
             CloseableHttpResponse res = client.execute(new HttpPost("https://clearflask.com/api/v1/license/check?license=" + license))) {
            if (res.getStatusLine().getStatusCode() >= 200
                    && res.getStatusLine().getStatusCode() <= 299) {
                log.info("License is valid");
                return true;
            } else if (res.getStatusLine().getStatusCode() == 401) {
                log.error("License is invalid");
                return false;
            } else {
                log.error("Failed to validate license: {}", res.getStatusLine().getStatusCode());
                return false;
            }
        } catch (Exception ex) {
            log.error("Failed to validate license", ex);
            return false;
        }
    }

    @Override
    public SubscriptionStatus getSelfhostEntitlementStatus(String planId) {
        return getSelfhostEntitlementStatus(planId, validateLicenseRemotely(true));
    }

    private SubscriptionStatus getSelfhostEntitlementStatus(String planId, Optional<Boolean> licenseValidation) {
        boolean requireLicense = !"selfhost-free".equals(planId) && !"self-host".equals(planId);
        if (!requireLicense) {
            return ACTIVE;
        } else if (!licenseValidation.isPresent()) {
            return CANCELLED;
        } else if (licenseValidation.get()) {
            return ACTIVE;
        } else {
            return BLOCKED;
        }
    }

    @Extern
    public void clearCache() {
        isValidCache.invalidateAll();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(RemoteLicenseStore.class).to(DynamoRemoteLicenseStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoRemoteLicenseStore.class).asEagerSingleton();
            }
        };
    }
}
