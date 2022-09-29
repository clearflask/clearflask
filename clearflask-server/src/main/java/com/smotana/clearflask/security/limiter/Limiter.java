// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security.limiter;

import javax.ws.rs.container.ContainerRequestContext;

public interface Limiter {

    void filter(ContainerRequestContext requestContext, Limit limit, String remoteIp, String target);
}
