// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.filter;

import com.google.common.base.Predicates;
import com.google.common.base.Strings;
import com.google.common.base.Throwables;
import com.google.common.collect.FluentIterable;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.*;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.util.Optional;

@Slf4j
public class ApiExceptionMapperFilter implements Filter {

    public interface Config {
        @DefaultValue("")
        String ignoreMessageRegex();
    }

    @Inject
    private Config config;
    @Inject
    private Gson gson;

    public ApiExceptionMapperFilter() {
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        ServiceInjector.INSTANCE.get().injectMembers(this);
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException {
        try {
            filterChain.doFilter(request, response);
        } catch (ServletException ex) {
            String ignoreMessageRegex = config.ignoreMessageRegex();
            Optional<ApiException> apiExceptionOpt = FluentIterable.from(Throwables.getCausalChain(ex))
                    .filter(Predicates.instanceOf(ApiException.class))
                    .first()
                    .toJavaUtil()
                    .map(ApiException.class::cast);
            if (apiExceptionOpt.isPresent()) {
                Response.Status status = apiExceptionOpt.get().getStatus();
                switch (status.getFamily()) {
                    case INFORMATIONAL:
                    case SUCCESSFUL:
                    case REDIRECTION:
                    case CLIENT_ERROR:
                        log.trace("Thrown API exception", ex);
                        break;
                    case SERVER_ERROR:
                    case OTHER:
                        log.warn("Thrown API exception", ex);
                        break;
                }
            } else if (Strings.isNullOrEmpty(ignoreMessageRegex)
                    || ex.getRootCause() == null
                    || ex.getRootCause().getMessage() == null
                    || !ex.getRootCause().getMessage().matches(ignoreMessageRegex)) {
                log.warn("Uncaught exception", ex);
            } else {
                log.trace("Uncaught exception", ex);
            }
            throw ex;
        } catch (IOException ex) {
            log.trace("Uncaught IO Exception", ex);
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
