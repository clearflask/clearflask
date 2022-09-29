// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web;

import com.google.inject.Injector;
import com.google.inject.servlet.GuiceServletContextListener;
import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.ServletContextEvent;
import javax.servlet.annotation.WebListener;

@Slf4j
@WebListener
public class ContextListener extends GuiceServletContextListener {

    @Override
    protected Injector getInjector() {
        return ServiceInjector.INSTANCE.get();
    }


    @Override
    public void contextInitialized(ServletContextEvent servletContextEvent) {
        super.contextInitialized(servletContextEvent);
        log.info("Context initialized, starting services");
        ServiceInjector.INSTANCE.startServices();
    }

    @Override
    public void contextDestroyed(ServletContextEvent servletContextEvent) {
        log.info("Context destroyed, shutting down services");
        ServiceInjector.INSTANCE.shutdownServices();
        super.contextDestroyed(servletContextEvent);
    }
}
