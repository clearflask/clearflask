/*
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS HEADER.
 *
 * Copyright (c) 2012-2017 Oracle and/or its affiliates. All rights reserved.
 *
 * The contents of this file are subject to the terms of either the GNU
 * General Public License Version 2 only ("GPL") or the Common Development
 * and Distribution License("CDDL") (collectively, the "License").  You
 * may not use this file except in compliance with the License.  You can
 * obtain a copy of the License at
 * https://oss.oracle.com/licenses/CDDL+GPL-1.1
 * or LICENSE.txt.  See the License for the specific
 * language governing permissions and limitations under the License.
 *
 * When distributing the software, include this License Header Notice in each
 * file and include the License file at LICENSE.txt.
 *
 * GPL Classpath Exception:
 * Oracle designates this particular file as subject to the "Classpath"
 * exception as provided by Oracle in the GPL Version 2 section of the License
 * file that accompanied this code.
 *
 * Modifications:
 * If applicable, add the following below the License Header, with the fields
 * enclosed by brackets [] replaced by your own identifying information:
 * "Portions Copyright [year] [name of copyright owner]"
 *
 * Contributor(s):
 * If you wish your version of this file to be governed by only the CDDL or
 * only the GPL Version 2, indicate your decision by adding "[Contributor]
 * elects to include this software in this distribution under the [CDDL or GPL
 * Version 2] license."  If you don't indicate a single choice of license, a
 * recipient has the option to distribute your version of this file under
 * either the CDDL, the GPL Version 2 or to extend the choice of license to
 * its licensees as provided above.  However, if you add GPL Version 2 code
 * and therefore, elected the GPL Version 2 license, then the option applies
 * only if the new code is made subject to such option by the copyright
 * holder.
 */

package com.smotana.clearflask.security.limiter;

import com.google.common.net.InetAddresses;
import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.common.Strings;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
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
            String remoteIp = getRemoteIp();
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

        private String getRemoteIp() {
            String remoteIp;
            switch (env) {
                case PRODUCTION_AWS:
                    String xForwardedFor = request.getHeader("x-forwarded-for");
                    if (Strings.isNullOrEmpty(xForwardedFor)) {
                        throw new InternalServerErrorException("X-Forwarded-For not set in AWS");
                    }
                    int indexOfFirstComma = xForwardedFor.indexOf(',');
                    if (indexOfFirstComma == -1) {
                        remoteIp = xForwardedFor.trim();
                    } else {
                        remoteIp = xForwardedFor.substring(0, indexOfFirstComma).trim();
                    }
                    break;
                case TEST:
                case DEVELOPMENT_LOCAL:
                    remoteIp = request.getRemoteAddr();
                    break;
                default:
                    throw new InternalServerErrorException("Unknown environment: " + env);
            }
            if (!InetAddresses.isInetAddress(remoteIp)) {
                throw new InternalServerErrorException("Not a valid remote IP: " + remoteIp);
            }
            return remoteIp;
        }
    }
}
