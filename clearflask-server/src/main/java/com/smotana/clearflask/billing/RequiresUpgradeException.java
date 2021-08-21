// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only

package com.smotana.clearflask.billing;

import com.smotana.clearflask.web.ApiException;

import javax.ws.rs.core.Response;

public class RequiresUpgradeException extends ApiException {

    private final String requiredPlanId;

    public RequiresUpgradeException(String requiredPlanId, String userFacingMessage) {
        super(Response.Status.BAD_REQUEST, userFacingMessage);
        this.requiredPlanId = requiredPlanId;
    }

    public String getRequiredPlanId() {
        return requiredPlanId;
    }
}
