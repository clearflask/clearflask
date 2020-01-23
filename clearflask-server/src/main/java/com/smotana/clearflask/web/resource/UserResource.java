package com.smotana.clearflask.web.resource;

import com.google.common.base.Strings;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
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
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.SearchUsersResponse;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.util.RealCookie;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.NotImplementedException;
import com.smotana.clearflask.web.security.ExtendedSecurityContext;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
public class UserResource extends AbstractResource implements UserApi, UserAdminApi {

    public interface Config {
        @DefaultValue("P300D")
        Duration sessionExpiry();

        @DefaultValue("P290D")
        Duration sessionRenewIfExpiringIn();

        @DefaultValue(value = "10", innerType = Integer.class)
        Optional<Integer> searchPageSize();
    }

    public static final String USER_AUTH_COOKIE_NAME = "cf_usr_auth";

    @Inject
    private Config config;
    @Inject
    private UserStore userStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private PasswordUtil passwordUtil;

    @PermitAll
    @Limit(requiredPermits = 100)
    @Override
    public UserMeWithBalance userCreate(String projectId, UserCreate userCreate) {
        String userId = userStore.genUserId();
        Optional<String> passwordHashed = Optional.empty();
        if (!Strings.isNullOrEmpty(userCreate.getPassword())) {
            passwordHashed = Optional.of(passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userCreate.getPassword(), userId));
        }
        UserStore.UserModel user = new UserStore.UserModel(
                projectId,
                userId,
                userCreate.getName(),
                userCreate.getEmail(),
                passwordHashed.orElse(null),
                userCreate.getEmail() != null,
                null,
                userCreate.getIosPushToken(),
                userCreate.getAndroidPushToken(),
                userCreate.getBrowserPushToken(),
                Instant.now());
        userStore.createUser(user);
        return user.toUserMeWithBalance();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userCreateAdmin(String projectId, UserCreateAdmin userCreateAdmin) {
        String userId = userStore.genUserId();
        Optional<String> passwordHashed = Optional.empty();
        if (!Strings.isNullOrEmpty(userCreateAdmin.getPassword())) {
            passwordHashed = Optional.of(passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userCreateAdmin.getPassword(), userId));
        }
        UserStore.UserModel user = new UserStore.UserModel(
                projectId,
                userId,
                userCreateAdmin.getName(),
                userCreateAdmin.getEmail(),
                passwordHashed.orElse(null),
                userCreateAdmin.getEmail() != null,
                userCreateAdmin.getBalance(),
                userCreateAdmin.getIosPushToken(),
                userCreateAdmin.getAndroidPushToken(),
                userCreateAdmin.getBrowserPushToken(),
                Instant.now());
        userStore.createUser(user);
        return user.toUserAdmin();
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1)
    @Override
    public void userDelete(String projectId, String userId) {
        userStore.deleteUsers(projectId, ImmutableList.of(userId));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void userDeleteAdmin(String projectId, String userId) {
        userStore.deleteUsers(projectId, ImmutableList.of(userId));
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public void userDeleteBulkAdmin(String projectId, UserSearchAdmin userSearchAdmin) {
        UserStore.SearchUsersResponse searchResponse = null;
        do {
            searchResponse = userStore.searchUsers(
                    projectId,
                    userSearchAdmin,
                    true,
                    searchResponse == null ? Optional.empty() : searchResponse.getCursorOpt(),
                    Optional.empty());
            userStore.deleteUsers(projectId, searchResponse.getUserIds());
        } while (!searchResponse.getCursorOpt().isPresent());
    }

    @RolesAllowed({Role.PROJECT_USER, Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public User userGet(String projectId, String userId) {
        UserStore.UserModel user = userStore.getUser(projectId, userId).get();
        return new User(user.getUserId(), user.getName());
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 5)
    @Override
    public UserMeWithBalance userLogin(String projectId, UserLogin userLogin) {
        Optional<UserStore.UserModel> userOpt = userStore.getUserByIdentifier(projectId, UserStore.IdentifierType.EMAIL, userLogin.getEmail());
        if (!userOpt.isPresent()) {
            log.info("User login with non-existent email {}", userLogin.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        UserStore.UserModel user = userOpt.get();

        String passwordSupplied = passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userLogin.getPassword(), user.getUserId());
        if (Strings.isNullOrEmpty(user.getPassword())) {
            // Password-less user
        } else if (!user.getPassword().equals(passwordSupplied)) {
            log.info("Account login incorrect password for email {}", user.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        log.debug("Successful user login for email {}", userLogin.getEmail());

        UserStore.UserSession session = userStore.createSession(
                projectId,
                user.getUserId(),
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        setAuthCookie(projectId, session);

        return user.toUserMeWithBalance();
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public void userLogout(String projectId) {
        Optional<ExtendedSecurityContext.ExtendedPrincipal> extendedPrincipal = getExtendedPrincipal();
        if (!extendedPrincipal.isPresent() || !extendedPrincipal.get().getUserSessionOpt().isPresent()) {
            log.trace("Cannot logout user, already not logged in");
            return;
        }
        UserStore.UserSession session = extendedPrincipal.get().getUserSessionOpt().get();

        log.debug("Logout session for user {}", session.getUserId());
        userStore.revokeSession(session);

        unsetAuthCookie();
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 100)
    @Override
    public UserMeWithBalance userSsoCreateOrLogin(String projectId, UserSsoCreateOrLogin userSsoCreateOrLogin) {
        throw new NotImplementedException();
        // TODO not yet implemented on client nor server
//        projectStore.getConfigAdmin(projectId).orElseThrow(InternalServerErrorException::new)
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1, challengeAfter = 2)
    @Override
    public UserMeWithBalance userUpdate(String projectId, String userId, UserUpdate userUpdate) {
        // TODO Sanity check userUpdate
        return userStore.updateUser(projectId, userId, userUpdate).getUser().toUserMeWithBalance();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userUpdateAdmin(String projectId, String userId, UserUpdate userUpdate) {
        // TODO Sanity check userUpdate
        return userStore.updateUser(projectId, userId, userUpdate).getUser().toUserAdmin();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userGetAdmin(String projectId, String userId) {
        return userStore.getUser(projectId, userId)
                .orElseThrow(() -> new ErrorWithMessageException(Response.Status.NOT_FOUND, "User not found"))
                .toUserAdmin();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 10)
    @Override
    public UserSearchResponse userSearchAdmin(String projectId, UserSearchAdmin userSearchAdmin, String cursor) {
        SearchUsersResponse searchUsersResponse = userStore.searchUsers(
                projectId,
                userSearchAdmin,
                false,
                Optional.ofNullable(Strings.emptyToNull(cursor)),
                config.searchPageSize());

        ImmutableMap<String, UserStore.UserModel> usersById = userStore.getUsers(projectId, searchUsersResponse.getUserIds());

        return new UserSearchResponse(
                searchUsersResponse.getCursorOpt().orElse(null),
                searchUsersResponse.getUserIds().stream()
                        .map(usersById::get)
                        .filter(Objects::nonNull)
                        .map(UserStore.UserModel::toUserAdmin)
                        .collect(ImmutableList.toImmutableList()));
    }

    private void setAuthCookie(String projectId, UserStore.UserSession session) {
        log.trace("Setting user auth cookie for user id {}", session.getUserId());
        RealCookie.builder()
                .name(USER_AUTH_COOKIE_NAME)
                .value(session.getSessionId())
                .path("/")
                .secure(securityContext.isSecure())
                .httpOnly(true)
                .expiry(session.getTtlInEpochSec())
                .sameSite(RealCookie.SameSite.STRICT)
                .build()
                .addToResponse(response);
    }

    private void unsetAuthCookie() {
        log.trace("Removing user auth cookie");
        RealCookie.builder()
                .name(USER_AUTH_COOKIE_NAME)
                .value("")
                .path("/")
                .secure(securityContext.isSecure())
                .httpOnly(true)
                .expiry(0L)
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
