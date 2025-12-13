// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.billing;

import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.web.ApiException;

import java.util.Optional;

public interface PlanVerifyStore {

    boolean verifyAccountAllowedDigest(Account account, String projectId) throws ApiException;

    void verifyAccountMeetsPlanRestrictions(String planId, String accountId) throws ApiException;

    void verifyPlanMeetsLicense(String planId, String accountId);

    void verifyAccountMeetsLimits(String planId, String accountId) throws ApiException;

    boolean isAccountExceedsPostLimit(String planId, String accountId);

    void verifyActionMeetsPlanRestrictions(String planId, String accountId, Action action) throws ApiException;

    void verifyConfigMeetsPlanRestrictions(String planId, String accountId, ConfigAdmin config) throws ApiException;

    void verifyConfigChangeMeetsRestrictions(boolean isSuperAdmin, Optional<ConfigAdmin> configAdminPreviousOpt, ConfigAdmin config) throws ApiException;

    void verifyTeammateInviteMeetsPlanRestrictions(String planId, String accountId, boolean addOne) throws ApiException;

    void verifyProjectCountMeetsPlanRestrictions(String planId, String accountId, boolean addOne) throws ApiException;

    enum Action {
        API_KEY,
        CREATE_PROJECT
    }
}
