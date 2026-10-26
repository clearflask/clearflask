// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security.limiter;

import javax.ws.rs.container.ContainerRequestContext;

public interface Limiter {

    default void filter(ContainerRequestContext requestContext, Limit limit, String remoteIp, String target) {
        rateLimit(requestContext, limit, remoteIp, target);
        challenge(requestContext, limit, remoteIp, target);
    }

    void rateLimit(ContainerRequestContext requestContext, Limit limit, String remoteIp, String target);

    void challenge(ContainerRequestContext requestContext, Limit limit, String remoteIp, String target);
}
