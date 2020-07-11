package com.smotana.clearflask.web.resource;

import com.google.gson.Gson;
import com.google.gson.GsonNonNull;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.web.Application;
import com.stripe.model.*;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.killbill.billing.ObjectType;
import org.killbill.billing.client.RequestOptions;
import org.killbill.billing.client.api.gen.TenantApi;
import org.killbill.billing.client.model.gen.TenantKeyValue;
import org.killbill.billing.notification.plugin.api.ExtBusEventType;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.UUID;

import static com.smotana.clearflask.store.AccountStore.Account;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class KillBillResource extends ManagedService {

    public static final String WEBHOOK_PATH = "/webhook/killbill";

    public interface Config {
        @DefaultValue("1")
        long warnIfWebhookCountNotEquals();
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
    private TenantApi kbTenant;

    @Override
    protected void serviceStart() throws Exception {
        String webhookPath = "https://" + configApp.domain() + Application.RESOURCE_VERSION + WEBHOOK_PATH;
        log.info("Registering KillBill webhook on {}", webhookPath);
        TenantKeyValue tenantKeyValue = kbTenant.registerPushNotificationCallback(webhookPath, RequestOptions.empty());
        if (config.warnIfWebhookCountNotEquals() != tenantKeyValue.getValues().size()) {
            log.warn("Expecting {} webhooks but found {}",
                    config.warnIfWebhookCountNotEquals(), tenantKeyValue.getValues());
        }
    }

    @POST
    @Path(WEBHOOK_PATH)
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    @Limit(requiredPermits = 1)
    public void webhook(String payload) {
        Event event = gson.fromJson(payload, Event.class);
        switch (event.getEventType()) {
            case SUBSCRIPTION_PHASE:
            case SUBSCRIPTION_CHANGE:
            case SUBSCRIPTION_CANCEL:
            case SUBSCRIPTION_UNCANCEL:
            case SUBSCRIPTION_BCD_CHANGE:
                // TODO
                Subscription subscription = (Subscription) stripeObject;
                Customer customer = subscription.getCustomerObject();
                SubscriptionStatusEnum statusNew = stripeBilling.getSubscriptionStatusFrom(customer, subscription);
                String accountId = stripeBilling.getCustomerAccountId(customer).get();
                Account account = accountStore.getAccountByAccountId(accountId).get();
                if (statusNew != account.getStatus()) {
                    accountStore.updateStatus(accountId, statusNew);
                }
                break;
            case SUBSCRIPTION_CREATION:
            case ACCOUNT_CREATION:
            case ACCOUNT_CHANGE:
            case BLOCKING_STATE:
            case BROADCAST_SERVICE:
            case ENTITLEMENT_CREATION:
            case ENTITLEMENT_CANCEL:
            case BUNDLE_PAUSE:
            case BUNDLE_RESUME:
            case OVERDUE_CHANGE:
            case INVOICE_CREATION:
            case INVOICE_ADJUSTMENT:
            case INVOICE_NOTIFICATION:
            case INVOICE_PAYMENT_SUCCESS:
            case INVOICE_PAYMENT_FAILED:
            case PAYMENT_SUCCESS:
            case PAYMENT_FAILED:
            case TAG_CREATION:
            case TAG_DELETION:
            case CUSTOM_FIELD_CREATION:
            case CUSTOM_FIELD_DELETION:
            case TENANT_CONFIG_CHANGE:
            case TENANT_CONFIG_DELETION:
                break;
            default:
                log.error("KillBill webhook unexpected event type {} event {}", event.getEventType(), event);
                throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
        }

        response.setStatus(200);
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
