package com.smotana.clearflask.antispam;

import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.api.model.UserCreate;

import javax.servlet.http.HttpServletRequest;

public interface AntiSpam {

    void onAccountSignup(HttpServletRequest request, AccountSignupAdmin form);

    void onUserSignup(HttpServletRequest request, String projectId, UserCreate userCreate);
}
