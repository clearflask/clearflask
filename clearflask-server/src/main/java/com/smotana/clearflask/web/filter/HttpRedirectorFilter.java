// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.filter;

import com.google.common.base.Strings;
import com.google.inject.Inject;
import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@Slf4j
public class HttpRedirectorFilter implements Filter {

    @Inject
    private ServiceInjector.Environment env;

    public HttpRedirectorFilter() {
        ServiceInjector.INSTANCE.get().injectMembers(this);
    }

    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws java.io.IOException, ServletException {

        if (!env.isProduction()) {
            chain.doFilter(request, response);
            return;
        }

        HttpServletRequest req = (HttpServletRequest) request;

        if (Strings.nullToEmpty(req.getHeader("x-forwarded-proto")).equalsIgnoreCase("http")
                && !Strings.nullToEmpty(req.getRequestURI()).startsWith("/api/health")) {
            HttpServletResponse res = (HttpServletResponse) response;

            String uri = req.getRequestURI();
            String getDomain = req.getServerName();

            // Set response content type
            res.setContentType("text/html");

            // New location to be redirected
            String site = "https" + "://" + getDomain + uri;

            log.debug("Redirecting non-https to {}", site);
            res.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
            res.setHeader("Location", site);
        }

        chain.doFilter(request, response);
    }

    @Override
    public void init(FilterConfig arg0) throws ServletException {
    }

    @Override
    public void destroy() {
    }
}
