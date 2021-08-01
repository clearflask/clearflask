// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web.security;

import javax.servlet.http.HttpServletResponse;

public interface AuthCookie {

    void setAuthCookie(HttpServletResponse response, String cookieName, String sessionId, long ttlInEpochSec);

    void unsetAuthCookie(HttpServletResponse response, String cookieName);
}
