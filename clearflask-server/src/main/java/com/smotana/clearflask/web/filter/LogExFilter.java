package com.smotana.clearflask.web.filter;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.*;
import java.io.IOException;

@Slf4j
public class LogExFilter implements Filter {

    public interface Config {
        @DefaultValue("Broken pipe|Connection reset by peer")
        String ignoreMessageRegex();
    }

    @Inject
    private Config config;

    public LogExFilter() {
        ServiceInjector.INSTANCE.get().injectMembers(this);
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        try {
            filterChain.doFilter(servletRequest, servletResponse);
        } catch (Throwable th) {
            String ignoreMessageRegex = config.ignoreMessageRegex();
            if (Strings.isNullOrEmpty(ignoreMessageRegex)
                    || th.getMessage() == null
                    || !th.getMessage().matches(ignoreMessageRegex)) {
                log.warn("Uncaught exception", th);
            }
            throw th;
        }
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
    }

    @Override
    public void destroy() {
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
