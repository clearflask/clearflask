/*
 * Copyright (c) 2012, 2017 Oracle and/or its affiliates. All rights reserved.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0, which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the
 * Eclipse Public License v. 2.0 are satisfied: GNU General Public License,
 * version 2 with the GNU Classpath Exception, which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 */

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
