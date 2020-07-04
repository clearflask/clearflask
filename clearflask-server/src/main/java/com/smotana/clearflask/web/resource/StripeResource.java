package com.smotana.clearflask.web.resource;

import com.google.gson.JsonSyntaxException;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.kik.config.ice.annotations.NoDefaultValue;
import com.smotana.clearflask.billing.StripeBilling;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.*;
import com.stripe.net.Webhook;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.time.Duration;

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

    @POST
    @Path("/webhook/stripe")
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    public void webhook(String payload) {
        Event event = stripeBilling.parseEvent(request);

        // Deserialize the nested object inside the event
        EventDataObjectDeserializer dataObjectDeserializer = event.getDataObjectDeserializer();
        StripeObject stripeObject = null;
        if (dataObjectDeserializer.getObject().isPresent()) {
            stripeObject = dataObjectDeserializer.getObject().get();
        } else {
            log.error("Stripe webhook deserialize failed probably due to API version mismatch {}", event.getApiVersion());
            throw new WebApplicationException(Response.Status.BAD_REQUEST);
        }

        // Handle the event
        switch (event.getType()) {
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
            case "customer.subscription.pending_update_applied":
            case "customer.subscription.pending_update_expired":
            case "customer.subscription.trial_will_end":
                Subscription subscription = (Subscription) stripeObject;
                Customer customer = subscription.getCustomerObject();
                stripeBilling.updatedSubscription(customer, subscription);
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
