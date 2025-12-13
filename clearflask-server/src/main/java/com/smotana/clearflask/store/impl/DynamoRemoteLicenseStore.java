package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.util.concurrent.ListeningScheduledExecutorService;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.billing.SelfHostPlanStore;
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

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

import static com.smotana.clearflask.api.model.SubscriptionStatus.*;

@Slf4j
@Singleton
public class DynamoRemoteLicenseStore implements RemoteLicenseStore {

    @Inject
    private SingleTable singleTable;

    @VisibleForTesting
    final Cache<String, Boolean> successfulValidationCache = CacheBuilder.newBuilder().expireAfterWrite(3, TimeUnit.DAYS).build();
    @VisibleForTesting
    final Cache<String, Boolean> lastValidationCache = CacheBuilder.newBuilder().expireAfterWrite(1, TimeUnit.DAYS).build();
    private TableSchema<License> licenseSchema;
    private ListeningScheduledExecutorService executor;

    @Inject
    private void setup() {
        licenseSchema = singleTable.parseTableSchema(License.class);
    }

    @Extern
    public String getLicenseExtern() {
        return getLicense().orElse("<empty>");
    }

    @Override
    public Optional<String> getLicense() {
        return Optional.ofNullable(licenseSchema.fromItem(licenseSchema.table().getItem(new GetItemSpec().withPrimaryKey(licenseSchema.primaryKey(Map.of("type", Type.PRIMARY)))))).map(License::getLicense);
    }

    @Extern
    @Override
    public void setLicense(String license) {
        licenseSchema.table().putItem(licenseSchema.toItem(new License(Type.PRIMARY, license)));
    }

    @Extern
    @Override
    public void clearLicense() {
        licenseSchema.table().deleteItem(licenseSchema.primaryKey(Map.of("type", Type.PRIMARY)));
    }

    @Override
    @SneakyThrows
    public Optional<Boolean> validateLicenseRemotely(boolean useCache) {
        return validateLicenseRemotely(useCache, this::validateExternally);
    }

    @VisibleForTesting
    Optional<Boolean> validateLicenseRemotely(boolean useCache, Function<String, Optional<Boolean>> validator) {
        Optional<String> licenseOpt = getLicense();

        // No license = not valid
        if (licenseOpt.isEmpty()) {
            return Optional.empty();
        }
        String license = licenseOpt.get();

        // Use cache if present
        if (useCache) {
            Boolean cachedValid = lastValidationCache.getIfPresent(license);
            if (cachedValid != null) {
                return Optional.of(cachedValid);
            }
        }

        // Validate remotely
        Optional<Boolean> isValid = validator.apply(license);

        // On success, update all caches and return
        if (isValid.orElse(false)) {
            lastValidationCache.put(license, Boolean.TRUE);
            successfulValidationCache.put(license, Boolean.TRUE);
            return Optional.of(Boolean.TRUE);
        }

        // If we failed to fetch a license due to network connectivity and if we are using a cache,
        // we want to give a grace period for failure
        // In this case first check if we passed in the long-term cache
        if (useCache
                && isValid.isEmpty()
                && Boolean.TRUE.equals(successfulValidationCache.getIfPresent(license))) {
            // If so, record a success in short-term cache, although we failed.
            lastValidationCache.put(license, Boolean.TRUE);
            // And return as if we passed
            return Optional.of(Boolean.TRUE);
        }

        // Otherwise record a failure and return a failure
        lastValidationCache.put(license, Boolean.FALSE);
        return Optional.of(Boolean.FALSE);
    }

    /**
     * Externally validates against license server. An empty optional signifies a failure to check, likely due to
     * network connectivity.
     */
    private Optional<Boolean> validateExternally(String license) {
        try (CloseableHttpClient client = HttpClientBuilder.create().build(); CloseableHttpResponse res = client.execute(new HttpPost("https://clearflask.com/api/v1/license/check?license=" + license))) {
            if (res.getStatusLine().getStatusCode() >= 200 && res.getStatusLine().getStatusCode() <= 299) {
                log.info("License is valid");
                return Optional.of(true);
            } else if (res.getStatusLine().getStatusCode() == 401) {
                log.error("License is invalid");
                return Optional.of(false);
            } else {
                log.error("Failed to validate license: {}", res.getStatusLine().getStatusCode());
                return Optional.empty();
            }
        } catch (Exception ex) {
            log.error("Failed to validate license", ex);
            return Optional.empty();
        }
    }

    @Override
    public SubscriptionStatus getSelfhostEntitlementStatus(String planId) {
        return getSelfhostEntitlementStatus(planId, validateLicenseRemotely(true));
    }

    private SubscriptionStatus getSelfhostEntitlementStatus(String planId, Optional<Boolean> licenseValidation) {
        boolean requireLicense = SelfHostPlanStore.SELF_HOST_LICENSED_PLAN.getBasePlanId().equals(planId);
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
        successfulValidationCache.invalidateAll();
        lastValidationCache.invalidateAll();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(RemoteLicenseStore.class).to(DynamoRemoteLicenseStore.class).asEagerSingleton();
            }
        };
    }
}
