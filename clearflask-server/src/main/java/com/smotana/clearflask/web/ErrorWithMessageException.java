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

import com.smotana.clearflask.api.model.ErrorResponse;
import com.smotana.clearflask.util.IdUtil;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;

/**
 * A runtime exception indicating an error with a user facing message.
 */
public class ErrorWithMessageException extends WebApplicationException {

    /**
     * Construct a new web exception.
     *
     * @param status            HTTP status code.
     * @param userFacingMessage the detailed message shown to user
     */
    public ErrorWithMessageException(Response.Status status, String userFacingMessage) {
        this(status, userFacingMessage, null);
    }

    /**
     * Construct a new web exception.
     *
     * @param status            HTTP status code.
     * @param userFacingMessage the detailed message shown to user
     * @param cause             the underlying cause of the exception.
     */
    public ErrorWithMessageException(Response.Status status, String userFacingMessage, final Throwable cause) {
        super(userFacingMessage + " #" + IdUtil.randomId(4), cause, Response.status(status)
                .entity(new ErrorResponse(userFacingMessage))
                .build());
    }
}
