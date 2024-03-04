// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.filter;

import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.*;
import javax.servlet.http.HttpServletResponse;

@Slf4j
public class NoCacheFilter implements Filter {

    public NoCacheFilter() {
        ServiceInjector.INSTANCE.get().injectMembers(this);
    }

    public void doFilter(ServletRequest request, ServletResponse response,
            FilterChain chain) throws java.io.IOException, ServletException {

        HttpServletResponse res = (HttpServletResponse) response;
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Expires", "0");

        chain.doFilter(request, response);
    }

    @Override
    public void init(FilterConfig arg0) throws ServletException {
    }

    @Override
    public void destroy() {
    }
}
