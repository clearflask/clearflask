// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web;

import com.smotana.clearflask.api.model.ErrorResponse;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;

/**
 * Turns an {@link ApiException} into its response inside Jersey.
 * <p>
 * Without this, the exception escapes the servlet and the container's error-page
 * ({@link ErrorHandler}) produces the same response — but only after Tomcat has
 * logged the escape at SEVERE with a full stack trace. Deliberate client errors
 * such as a 404 for a deleted project are routine, and on a public endpoint a
 * scanner can trigger thousands a day, burying real faults. Mapping them here
 * keeps the response identical while leaving SEVERE to mean an actual fault.
 * <p>
 * {@link ErrorHandler} remains the handler for anything thrown outside Jersey.
 */
@Slf4j
@Provider
public class ApiExceptionMapper implements ExceptionMapper<ApiException> {

    @Override
    public Response toResponse(ApiException ex) {
        switch (ex.getStatus().getFamily()) {
            case SERVER_ERROR:
            case OTHER:
                log.warn("Thrown API exception", ex);
                break;
            default:
                log.trace("Thrown API exception", ex);
                break;
        }

        Response.ResponseBuilder builder = Response
                .status(ex.getStatus())
                .type(MediaType.APPLICATION_JSON);
        // A body is only sent when there is something the user should read,
        // matching ErrorHandler.
        ex.getUserFacingMessageOpt().ifPresent(userFacingMessage ->
                builder.entity(new ErrorResponse(userFacingMessage)));
        return builder.build();
    }
}
