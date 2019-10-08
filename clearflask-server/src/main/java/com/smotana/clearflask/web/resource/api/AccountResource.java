package com.smotana.clearflask.web.resource.api;

import com.smotana.clearflask.api.AccountAdminApi;
import com.smotana.clearflask.api.model.AccountLogin;
import com.smotana.clearflask.api.model.AccountSignupAdmin;
import com.smotana.clearflask.web.resource.AbstractClearflaskResource;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.NotImplementedException;

import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.NotNull;
import javax.ws.rs.core.Context;

@Slf4j
@Singleton
public class AccountResource extends AbstractClearflaskResource implements AccountAdminApi {

    @Context
    private HttpServletRequest request;

    @Override
    public com.smotana.clearflask.api.model.AccountAdmin accountBindAdmin() {
        throw new NotImplementedException();
    }

    @Override
    public com.smotana.clearflask.api.model.AccountAdmin accountLoginAdmin(@NotNull AccountLogin credentials) {
        throw new NotImplementedException();
    }

    @Override
    public void accountLogoutAdmin() {
        throw new NotImplementedException();
    }

    @Override
    public com.smotana.clearflask.api.model.AccountAdmin accountSignupAdmin(@NotNull AccountSignupAdmin signup) {
        throw new NotImplementedException();
    }
}
