package com.smotana.clearflask.web.filter;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import java.io.IOException;

@Slf4j
public class LogExFilter implements Filter {

    public interface Config {
        @DefaultValue("Broken pipe")
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
        } catch (Throwable ex) {
            if (ex.getMessage() == null || !ex.getMessage().matches(config.ignoreMessageRegex())) {
                log.error("Uncaught exception", ex);
            }
            throw ex;
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
