package com.smotana.clearflask.web;

import com.google.inject.Injector;
import com.google.inject.servlet.GuiceServletContextListener;
import com.smotana.clearflask.core.ClearFlaskInjector;
import com.smotana.clearflask.core.VeruvInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.ServletContextEvent;
import javax.servlet.annotation.WebListener;

@Slf4j
@WebListener
public class VeruvContextListener extends GuiceServletContextListener {

    @Override
    protected Injector getInjector() {
        return VeruvInjector.INSTANCE.get();
    }


    @Override
    public void contextInitialized(ServletContextEvent servletContextEvent) {
        super.contextInitialized(servletContextEvent);
        log.info("Context initialized, starting services");
        ClearFlaskInjector.INSTANCE.startServices();
    }

    @Override
    public void contextDestroyed(ServletContextEvent servletContextEvent) {
        log.info("Context destroyed, shutting down services");
        ClearFlaskInjector.INSTANCE.shutdownServices();
        super.contextDestroyed(servletContextEvent);
    }
}
