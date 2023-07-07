// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.smotana.clearflask.web.ApiException;

import javax.ws.rs.core.Response;

public class RequiresUpgradeException extends ApiException {

    private final String requiredPlanId;

    public RequiresUpgradeException(String userFacingMessage) {
        this(KillBillPlanStore.DEFAULT_UPGRADE_REQUIRED_PLAN, userFacingMessage);
    }

    public RequiresUpgradeException(String requiredPlanId, String userFacingMessage) {
        super(Response.Status.BAD_REQUEST, userFacingMessage);
        this.requiredPlanId = requiredPlanId;
    }

    public String getRequiredPlanId() {
        return requiredPlanId;
    }
}
