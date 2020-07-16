package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.billing.KillBillSync;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.Application;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.ObjectType;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.TenantApi;
import org.killbill.billing.client.model.gen.Account;
import org.killbill.billing.client.model.gen.Subscription;
import org.killbill.billing.client.model.gen.TenantKeyValue;
import org.killbill.billing.notification.plugin.api.ExtBusEventType;
import rx.Observable;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class KillBillResource extends ManagedService {

    public static final String WEBHOOK_PATH = "/webhook/killbill";

    public interface Config {
        @DefaultValue(value = "", innerType = String.class)
        Set<String> eventsToListenFor();

        Observable<Set<String>> eventsToListenForObservable();

        @DefaultValue(value = "1", innerType = Long.class)
        Optional<Long> warnIfWebhookCountNotEquals();

        @DefaultValue("true")
        boolean logWhenEventIsUnnecessary();
    }

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;
    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Gson gson;
    @Inject
    private AccountStore accountStore;
    @Inject
    private Billing billing;
    @Inject
    private TenantApi kbTenant;

    private ImmutableSet<ExtBusEventType> eventsToListenForCached = ImmutableSet.of();

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(KillBillSync.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        String webhookPath = "https://" + configApp.domain() + Application.RESOURCE_VERSION + WEBHOOK_PATH;
        log.info("Registering KillBill webhook on {}", webhookPath);
        TenantKeyValue tenantKeyValue = kbTenant.registerPushNotificationCallback(webhookPath, RequestOptions.empty());
        Optional<Long> expectedWebhookCount = config.warnIfWebhookCountNotEquals();
        if (expectedWebhookCount.isPresent() && expectedWebhookCount.get() != tenantKeyValue.getValues().size()) {
            log.warn("Expecting {} webhooks but found {}",
                    expectedWebhookCount.get(), tenantKeyValue.getValues());
        }

        config.eventsToListenForObservable().subscribe(eventsToListenFor -> {
            updateEventsToListenFor(eventsToListenFor, false);
        });
        updateEventsToListenFor(config.eventsToListenFor(), true);
    }

    @POST
    @Path(WEBHOOK_PATH)
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    @Limit(requiredPermits = 1)
    public void webhook(String payload) {
        Event event = gson.fromJson(payload, Event.class);

        if (!eventsToListenForCached.contains(event.eventType)) {
            if (config.logWhenEventIsUnnecessary() && LogUtil.rateLimitAllowLog("killbillresource-eventUnnecessary")) {
                log.info("KillBill event {} was really unnecessary {}", event.getEventType(), event);
            }
            return;
        }

        String accountId = event.getAccountId().toString();

        Account kbAccount = billing.getAccount(accountId);
        if (kbAccount == null) {
            log.warn("Received event for non-existent KillBill account with id {}", accountId);
            return;
        }
        Subscription kbSubscription = billing.getSubscription(accountId);
        if (kbSubscription == null) {
            log.warn("Received event for non-existent KillBill subscription, KillBill account exists, with account id {}", accountId);
            return;
        }
        Optional<AccountStore.Account> accountOpt = accountStore.getAccountByAccountId(accountId);
        if (!accountOpt.isPresent()) {
            log.warn("Received event for non-existent account, KillBill account and subscription exist, with account id {}", accountId);
            return;
        }
        SubscriptionStatusEnum newStatus = billing.getSubscriptionStatusFrom(kbAccount, kbSubscription);
        if (accountOpt.get().getStatus().equals(newStatus)) {
            if (config.logWhenEventIsUnnecessary() && LogUtil.rateLimitAllowLog("killbillresource-eventUnnecessary")) {
                log.info("KillBill event {} was unnecessary {}", event.getEventType(), event);
            }
            return;
        }

        log.info("KillBill event {} caused accountId {} to state change {} -> {}",
                event.getEventType(), accountId, accountOpt.get().getStatus(), newStatus);
        accountStore.updateStatus(accountId, newStatus);
    }

    private void updateEventsToListenFor(Set<String> eventsToListenForStr, boolean doThrow) {
        ImmutableSet.Builder<ExtBusEventType> eventsToListenForBuilder = ImmutableSet.builderWithExpectedSize(eventsToListenForStr.size());
        for (String eventToListenFor : eventsToListenForStr) {
            try {
                eventsToListenForBuilder.add(ExtBusEventType.valueOf(eventToListenFor));
            } catch (IllegalArgumentException ex) {
                log.error("Misconfiguration of eventsToListenForStr");
                if (doThrow) {
                    throw ex;
                }
                return;
            }
        }
        eventsToListenForCached = eventsToListenForBuilder.build();
    }

    @Value
    @AllArgsConstructor
    private static class Event {
        @NonNull
        @GsonNonNull
        private final ExtBusEventType eventType;

        @NonNull
        @GsonNonNull
        private final ObjectType objectType;

        @NonNull
        @GsonNonNull
        private final UUID objectId;

        @NonNull
        @GsonNonNull
        private final UUID accountId;

        private final String metaData;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(KillBillResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(KillBillResource.class);
            }
        };
    }
}
