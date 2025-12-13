// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import org.killbill.billing.client.model.gen.Account;

import java.util.Optional;

public interface LocalLicenseStore {

    /**
     * License *is* the account ID
     */
    default String getAccountId(String license) {
        return license;
    }

    /**
     * Account ID *is* the license
     */
    default String getLicense(String accountId) {
        return accountId;
    }

    boolean validateLicenseLocally(
            String license,
            String clientIp,
            Optional<Account> accountKbOpt);
}
