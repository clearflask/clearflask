// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
