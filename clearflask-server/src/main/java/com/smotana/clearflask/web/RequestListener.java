package com.smotana.clearflask.web;

import lombok.extern.slf4j.Slf4j;

import javax.servlet.ServletRequestEvent;
import javax.servlet.ServletRequestListener;
import javax.servlet.http.HttpServletRequest;

@Slf4j
public class RequestListener implements ServletRequestListener {
    public static final String REMOTE_ADDR_ATTR = "remoteAddr";

    @Override
    public void requestDestroyed(ServletRequestEvent servletRequestEvent) {
    }

    @Override
    public void requestInitialized(ServletRequestEvent servletRequestEvent) {
        HttpServletRequest servletRequest = (HttpServletRequest) servletRequestEvent.getServletRequest();
        servletRequest.getSession().setAttribute(REMOTE_ADDR_ATTR, servletRequest.getRemoteAddr());
    }
}
