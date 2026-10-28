// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import com.google.common.base.Strings;
import com.smotana.clearflask.api.model.ErrorResponse;
import com.smotana.clearflask.core.ServiceInjector.Environment;
import com.smotana.clearflask.security.limiter.challenge.CaptchaChallenger;
import com.smotana.clearflask.util.IpUtil;
import lombok.extern.slf4j.Slf4j;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.Optional;

/** Mandatory CAPTCHA at public registration boundaries, independent of IP history. */
@Slf4j
@Singleton
public class RegistrationCaptcha {
    private static final String VERIFIED_ATTRIBUTE = RegistrationCaptcha.class.getName() + ".verified";
    @Inject
    private Environment env;
    @Inject
    private CaptchaChallenger challenger;
    @Inject
    private RegistrationAbusePolicy abusePolicy;

    public void require(HttpServletRequest request, Optional<ExtendedSecurityContext.ExtendedPrincipal> principal) {
        abusePolicy.requireRegistrationsEnabled();
        requireCaptcha(request, principal);
    }

    /** Preflight for flows that may sign in an existing user or register a new one. */
    public void requireCaptcha(HttpServletRequest request, Optional<ExtendedSecurityContext.ExtendedPrincipal> principal) {
        if (Boolean.TRUE.equals(request.getAttribute(VERIFIED_ATTRIBUTE))) {
            return;
        }
        if (!abusePolicy.get().getRegistrationCaptchaEnabled()) {
            return;
        }
        // Preserve the existing exemption for an authenticated, server-validated superadmin.
        if (principal.flatMap(ExtendedSecurityContext.ExtendedPrincipal::getAuthenticatedSuperAccountIdOpt).isPresent()) {
            return;
        }
        String ip = IpUtil.getRemoteIp(request, env);
        String target = ip + "-registration-" + request.getRequestURI();
        String solution = Strings.emptyToNull(request.getHeader("x-cf-solution"));
        if (solution != null && challenger.verifyRegistration(ip, target, solution)) {
            request.setAttribute(VERIFIED_ATTRIBUTE, Boolean.TRUE);
            log.info("REGISTRATION_CAPTCHA_VERIFIED ip={} path={}", ip, request.getRequestURI());
            return;
        }
        throw new WebApplicationException(Response.status(Response.Status.TOO_MANY_REQUESTS)
                .type(MediaType.APPLICATION_JSON)
                .header("x-cf-challenge", challenger.issue(ip, target))
                .entity(new ErrorResponse("Solve the challenge to register"))
                .build());
    }
}
