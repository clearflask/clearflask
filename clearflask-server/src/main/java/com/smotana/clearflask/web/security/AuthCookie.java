// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import javax.servlet.http.HttpServletResponse;

public interface AuthCookie {

    void setAuthCookie(HttpServletResponse response, String cookieName, String sessionId, long ttlInEpochSec);

    void unsetAuthCookie(HttpServletResponse response, String cookieName);
}
