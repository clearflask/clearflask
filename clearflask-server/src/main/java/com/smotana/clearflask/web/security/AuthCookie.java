package com.smotana.clearflask.web.security;

import javax.servlet.http.HttpServletResponse;

public interface AuthCookie {

    void setAuthCookie(HttpServletResponse response, String cookieName, String sessionId, long ttlInEpochSec);

    void unsetAuthCookie(HttpServletResponse response, String cookieName);
}
