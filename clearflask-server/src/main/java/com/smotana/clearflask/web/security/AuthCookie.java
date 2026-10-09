// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.security;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public interface AuthCookie {

    void setAuthCookie(HttpServletRequest request, HttpServletResponse response, String cookieName, String sessionId, long ttlInEpochSec);

    void unsetAuthCookie(HttpServletRequest request, HttpServletResponse response, String cookieName);

    /**
     * Resolves the name a logical auth cookie is sent under on the wire.
     * <p>
     * Account-level cookies carry the {@code __Host-} prefix on secure deployments, which makes browsers refuse any
     * copy of the cookie that was set with a {@code Domain} attribute or from an insecure origin. This stops a project
     * subdomain (where customers run arbitrary JS) from planting or overriding the dashboard session cookie.
     */
    String wireName(String cookieName);
}
