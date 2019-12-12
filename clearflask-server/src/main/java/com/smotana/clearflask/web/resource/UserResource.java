package com.smotana.clearflask.web.resource;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.UserAdminApi;
import com.smotana.clearflask.api.UserApi;
import com.smotana.clearflask.api.model.User;
import com.smotana.clearflask.api.model.UserAdmin;
import com.smotana.clearflask.api.model.UserCreate;
import com.smotana.clearflask.api.model.UserCreateAdmin;
import com.smotana.clearflask.api.model.UserLogin;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserSearchResponse;
import com.smotana.clearflask.api.model.UserSsoCreateOrLogin;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Session;
import com.smotana.clearflask.store.PlanStore;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.util.RealCookie;
import com.smotana.clearflask.web.security.AuthCookieUtil;
import com.smotana.clearflask.web.security.AuthCookieUtil.AuthCookieValue;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.validation.Valid;
import javax.ws.rs.Path;
import java.time.Duration;
import java.time.Instant;

@Slf4j
@Singleton
@Path("/v1")
public class UserResource extends AbstractResource implements UserApi, UserAdminApi {

    private interface Config {
        @DefaultValue("P300D")
        Duration sessionExpiry();

        @DefaultValue("P290D")
        Duration sessionRenewIfExpiringIn();
    }

    public static final String ACCOUNT_AUTH_COOKIE_NAME = "cf_usr_auth";

    @Inject
    private Config config;
    @Inject
    private AccountStore accountStore;
    @Inject
    private PlanStore planStore;
    @Inject
    private AuthCookieUtil authCookieUtil;
    @Inject
    private PasswordUtil passwordUtil;

    @PermitAll
    @Override
    public UserMeWithBalance userCreate(String projectId, @Valid UserCreate userCreate) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_USER, Role.PROJECT_OWNER})
    @Override
    public void userDelete(String projectId, String userId) {

    }

    @RolesAllowed({Role.PROJECT_USER, Role.PROJECT_OWNER})
    @Override
    public User userGet(String projectId, String userId) {
        return null;
    }

    @PermitAll
    @Override
    public UserMeWithBalance userLogin(String projectId, @Valid UserLogin userLogin) {
        return null;
    }

    @PermitAll
    @Override
    public void userLogout(String projectId) {

    }

    @Override
    public UserMeWithBalance userSsoCreateOrLogin(String projectId, @Valid UserSsoCreateOrLogin userSsoCreateOrLogin) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_USER, Role.PROJECT_OWNER})
    @Override
    public UserMeWithBalance userUpdate(String projectId, String userId, @Valid UserUpdate userUpdate) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public UserAdmin userCreateAdmin(String projectId, @Valid UserCreateAdmin userCreateAdmin) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public void userDeleteAdmin(String projectId, String userId) {

    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public void userDeleteBulkAdmin(String projectId, @Valid UserSearchAdmin userSearchAdmin) {

    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public UserAdmin userGetAdmin(String projectId, String userId) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public UserSearchResponse userSearchAdmin(String projectId, @Valid UserSearchAdmin userSearchAdmin, String cursor) {
        return null;
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Override
    public UserAdmin userUpdateAdmin(String projectId, String userId, @Valid UserUpdate userUpdate) {
        return null;
    }

    private void setAuthCookie(Session session) {
        log.trace("Setting account auth cookie for account {}", session.getAccountId());
        RealCookie.builder()
                .name(ACCOUNT_AUTH_COOKIE_NAME)
                .value(new AuthCookieValue(
                        AuthCookieUtil.Type.ACCOUNT,
                        session.getSessionId(),
                        session.getAccountId(),
                        null))
                .path("/")
                .secure(securityContext.isSecure())
                .httpOnly(true)
                .expiry(session.getExpiry())
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

    private void unsetAuthCookie() {
        log.trace("Removing account auth cookie");
        RealCookie.builder()
                .name(ACCOUNT_AUTH_COOKIE_NAME)
                .value("")
                .path("/")
                .secure(securityContext.isSecure())
                .httpOnly(true)
                .expiry(Instant.EPOCH)
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(UserResource.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
