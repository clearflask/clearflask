// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security.limiter;

import com.smotana.clearflask.core.ServiceInjector;
import com.smotana.clearflask.util.IpUtil;
import javax.inject.Inject;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.Priorities;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.DynamicFeature;
import javax.ws.rs.container.ResourceInfo;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.FeatureContext;
import java.io.IOException;
import java.lang.annotation.Annotation;
import java.security.Principal;
import java.util.Optional;

@Slf4j
public class LimiterDynamicFeature implements DynamicFeature {

    private enum TargetType {
        IP,
        SESSION_PRINCIPAL
    }

    @Inject
    private ServiceInjector.Environment env;
    @Inject
    private Limiter limiter;
    @Context
    private ResourceInfo resourceInfo;
    @Context
    private HttpServletRequest request;

    @Override
    public void configure(final ResourceInfo resourceInfo, final FeatureContext configuration) {
        Optional<Limit> limitOpt = getAnnotation(Limit.class, resourceInfo);
        if (!limitOpt.isPresent()) {
            return;
        }
        Limit limit = limitOpt.get();

        configuration.register(
                new LimiterFilter(TargetType.IP, limit),
                // Execute before authentication
                Priorities.AUTHENTICATION - 10);

        Optional<RolesAllowed> rolesAllowedOpt = getAnnotation(RolesAllowed.class, resourceInfo);
        if (!rolesAllowedOpt.isPresent() || rolesAllowedOpt.get().value().length <= 0) {
            return;
        }

        configuration.register(
                new LimiterFilter(TargetType.SESSION_PRINCIPAL, limit),
                // Execute after authentication
                Priorities.AUTHENTICATION + 10);
    }

    private <T extends Annotation> Optional<T> getAnnotation(Class<T> annotationClazz, ResourceInfo resourceInfo) {
        // Method annotation overrides class annotation
        T methodAnnotation = resourceInfo.getResourceMethod().getAnnotation(annotationClazz);
        if (methodAnnotation != null) {
            return Optional.of(methodAnnotation);
        }

        // Use class annotation if present
        T classAnnotation = resourceInfo.getResourceClass().getAnnotation(annotationClazz);
        if (classAnnotation != null) {
            return Optional.of(classAnnotation);
        }

        return Optional.empty();
    }

    public class LimiterFilter implements ContainerRequestFilter {

        private final TargetType targetType;
        private final Limit limit;

        private LimiterFilter(TargetType targetType, Limit limit) {
            this.targetType = targetType;
            this.limit = limit;
        }

        @Override
        public void filter(ContainerRequestContext requestContext) throws IOException {
            String remoteIp = IpUtil.getRemoteIp(request, env);
            String target;
            switch (targetType) {
                case IP:
                    target = remoteIp;
                    break;
                case SESSION_PRINCIPAL:
                    Principal userPrincipal = requestContext.getSecurityContext().getUserPrincipal();
                    if (userPrincipal == null) {
                        log.trace("Not rate limiting by principal since no session was authenticated");
                        return;
                    }
                    target = userPrincipal.getName();
                    break;
                default:
                    throw new InternalServerErrorException("Unknown target type: " + targetType);
            }

            limiter.filter(requestContext, limit, remoteIp, target);
        }
    }
}
