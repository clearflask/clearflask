// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.security;

import com.smotana.clearflask.web.ApiException;

public interface EmailValidator {

    void assertValid(String email) throws ApiException;

    EmailValidResult checkValid(String email);

    enum EmailValidResult {
        VALID,
        INVALID,
        DISPOSABLE
    }
}
