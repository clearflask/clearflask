package com.smotana.clearflask.web.resource;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.model.AccountAdmin.SubscriptionStatusEnum;
import com.smotana.clearflask.billing.StripeBilling;
import com.smotana.clearflask.store.AccountStore;
import com.stripe.model.*;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import static com.smotana.clearflask.store.AccountStore.Account;

@Slf4j
@Singleton
@Path("/v1")
public class StripeResource {

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;
    @Inject
    private StripeBilling stripeBilling;
    @Inject
    private AccountStore accountStore;

    @POST
    @Path("/webhook/stripe")
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    public void webhook(String payload) {
        Event event = stripeBilling.parseWebhookEvent(request);

        // Deserialize the nested object inside the event
        EventDataObjectDeserializer dataObjectDeserializer = event.getDataObjectDeserializer();
        StripeObject stripeObject;
        if (dataObjectDeserializer.getObject().isPresent()) {
            stripeObject = dataObjectDeserializer.getObject().get();
        } else {
            log.error("Stripe webhook deserialize failed probably due to API version mismatch {}", event.getApiVersion());
            throw new WebApplicationException(Response.Status.BAD_REQUEST);
        }

        // Handle the event
        switch (event.getType()) {
            case "customer.subscription.trial_will_end":
                break;
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
            case "customer.subscription.pending_update_applied":
            case "customer.subscription.pending_update_expired":
                Subscription subscription = (Subscription) stripeObject;
                Customer customer = subscription.getCustomerObject();
                SubscriptionStatusEnum statusNew = stripeBilling.getSubscriptionStatusFrom(customer, subscription);
                String accountId = stripeBilling.getCustomerAccountId(customer).get();
                Account account = accountStore.getAccountByAccountId(accountId).get();
                if (statusNew != account.getStatus()) {
                    accountStore.updateStatus(accountId, statusNew);
                }
                break;
            default:
                log.error("Stripe webhook unexpected event type {}", event.getType());
                throw new WebApplicationException(Response.Status.INTERNAL_SERVER_ERROR);
        }

        response.setStatus(200);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(StripeResource.class);
            }
        };
    }
}
