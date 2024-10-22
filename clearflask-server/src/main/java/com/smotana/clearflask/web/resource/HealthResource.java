// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.io.Resources;
import com.google.common.util.concurrent.ServiceManager;
import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/")
public class HealthResource {

    @Context
    private HttpServletRequest request;
    @Context
    private HttpServletResponse response;

    @Inject
    private ServiceManager serviceManager;

    @GET
    @Path("health")
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    public String health() {
        if (!serviceManager.isHealthy()) {
            throw new ApiException(Response.Status.SERVICE_UNAVAILABLE);
        }
        return "ok";
    }

    @GET
    @Path("version")
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    public String version(@Context ServletContext servletContext) {
        String gitPropertiesStr = Optional.ofNullable(Thread.currentThread().getContextClassLoader().getResource("git.properties"))
                .map(url -> {
                    try {
                        return Resources.toString(url, Charsets.UTF_8);
                    } catch (IOException ex) {
                        throw new RuntimeException(ex);
                    }
                })
                .orElse("Cannot find git.properties");

        String contextVersionStr = Optional.ofNullable(servletContext.getRealPath("/"))
                // Typical value: "/var/lib/tomcat/webapps/150clearflask/ROOT##202410110929-1.7.11-SNAPSHOT/"
                .map(path -> path.replaceAll(".*##([^/]+).*", "$1"))
                .map(Strings::emptyToNull)
                .orElse("Cannot find context version");

        return gitPropertiesStr + "\n" + contextVersionStr;
    }

    @GET
    @Path("contextPath")
    @Consumes(MediaType.WILDCARD)
    @Produces(MediaType.TEXT_PLAIN)
    public String contextPath(@Context ServletContext servletContext) {
        return Optional.ofNullable(servletContext.getContextPath()).toString();
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(HealthResource.class);
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(HealthResource.class);
            }
        };
    }
}
