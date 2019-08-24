package com.smotana.clearflask.web.resource;

import com.smotana.clearflask.web.message.Error;

import javax.ws.rs.core.Response;
import java.util.function.Supplier;

public enum Responses {
    OK(() -> Response.ok().build()),
    RATE_LIMITED(() -> Response.status(Response.Status.TOO_MANY_REQUESTS)
            .entity(new Error("rate-limited", "You performed this action too many times, please try again later")).build()),
    UNAUTHORIZED(() -> Response.status(Response.Status.FORBIDDEN)
            .entity(new Error("unauthorized", "Not authorized to perform this action")).build()),
    UNAUTHORIZED_PASSWORD_REQUIRED(() -> Response.status(Response.Status.FORBIDDEN)
            .entity(new Error("unauthorized-password-required", "Password is required for access")).build()),
    AUTH_TOKEN_EXPIRED(() -> Response.status(Response.Status.FORBIDDEN)
            .entity(new Error("token-expired", "Need to relogin again")).build()),
    AUTH_FAILED_RESPONSE(() -> Response.status(Response.Status.FORBIDDEN)
            .entity(new Error("auth-failed", "Email or password is incorrect")).build()),
    NOT_FOUND(() -> Response.status(Response.Status.NOT_FOUND)
            .entity(new Error("not-found", "Not found")).build()),
    BAD_REQUEST(() -> Response.status(Response.Status.BAD_REQUEST)
            .entity(new Error("bad-request", "Communication error")).build()),
    EMAIL_TAKEN(() -> Response.status(Response.Status.EXPECTATION_FAILED)
            .entity(new Error("email-taken", "Email already in use by another user")).build()),
    INTERNAL_SERVER_ERROR(() -> Response.status(Response.Status.INTERNAL_SERVER_ERROR)
            .entity(new Error("internal-server-error", "Internal server error")).build());

    private final Supplier<Response> responseFactory;

    Responses(Supplier<Response> responseFactory) {
        this.responseFactory = responseFactory;
    }

    public Response getResponse() {
        return responseFactory.get();
    }
}
