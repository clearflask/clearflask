package com.smotana.clearflask.web.resource;

import lombok.extern.slf4j.Slf4j;

import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

@Slf4j
@Singleton
@Path("/")
public class HealthResource {

    @Context
    private HttpServletRequest request;

    @GET
    @Path("health")
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    public String health() {
        return "ok";
    }

    @GET
    @Path("error")
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    public String error() {
        InternalServerErrorException ex = new InternalServerErrorException("Testing internal error");
        log.error("Testing internal error", ex);
        throw ex;
    }
}
