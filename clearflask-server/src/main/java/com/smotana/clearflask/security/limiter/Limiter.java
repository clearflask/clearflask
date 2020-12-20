package com.smotana.clearflask.security.limiter;

import javax.ws.rs.container.ContainerRequestContext;

public interface Limiter {

    void filter(ContainerRequestContext requestContext, Limit limit, String remoteIp, String target);
}
