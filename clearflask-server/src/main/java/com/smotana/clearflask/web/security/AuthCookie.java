// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public interface AuthCookie {

    void setAuthCookie(HttpServletRequest request, HttpServletResponse response, String cookieName, String sessionId, long ttlInEpochSec);

    void unsetAuthCookie(HttpServletRequest request, HttpServletResponse response, String cookieName);
}
