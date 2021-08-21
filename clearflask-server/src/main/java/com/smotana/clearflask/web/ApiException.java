// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

package com.smotana.clearflask.web;

import com.google.common.base.Strings;

import javax.ws.rs.core.Response;
import java.util.Optional;

public class ApiException extends RuntimeException {

    private final Response.Status status;
    private final Optional<String> userFacingMessageOpt;

    public ApiException(Response.Status status) {
        this(status, null, null);
    }

    public ApiException(Response.Status status, final Throwable cause) {
        this(status, null, cause);
    }

    public ApiException(Response.Status status, String userFacingMessage) {
        this(status, userFacingMessage, null);
    }

    public ApiException(Response.Status status, String userFacingMessage, final Throwable cause) {
        super(status.getStatusCode() + (userFacingMessage == null ? "" : ": " + userFacingMessage), cause);
        this.status = status;
        this.userFacingMessageOpt = Optional.ofNullable(Strings.emptyToNull(userFacingMessage));
    }

    public Response.Status getStatus() {
        return status;
    }

    public Optional<String> getUserFacingMessageOpt() {
        return userFacingMessageOpt;
    }
}
