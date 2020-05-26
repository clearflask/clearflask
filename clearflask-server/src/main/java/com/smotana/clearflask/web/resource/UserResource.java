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
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.ForgotPassword;
import com.smotana.clearflask.api.model.User;
import com.smotana.clearflask.api.model.UserAdmin;
import com.smotana.clearflask.api.model.UserBindResponse;
import com.smotana.clearflask.api.model.UserCreate;
import com.smotana.clearflask.api.model.UserCreateAdmin;
import com.smotana.clearflask.api.model.UserLogin;
import com.smotana.clearflask.api.model.UserMe;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserSearchResponse;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.api.model.UserUpdateAdmin;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.SearchUsersResponse;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.AuthCookieUtil;
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

        @DefaultValue("P7D")
        Duration sendOnEmailChangedEmailIfLastChangeGreaterThan();
    }

    public static final String USER_AUTH_COOKIE_NAME = "cf_usr_auth";

    @Inject
    private Config config;
    @Inject
    private UserStore userStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private PasswordUtil passwordUtil;
    @Inject
    private NotificationService notificationService;
    @Inject
    private AuthCookieUtil authCookieUtil;

    @PermitAll
    @Limit(requiredPermits = 100, challengeAfter = 3)
    @Override
    public void forgotPassword(String projectId, ForgotPassword forgotPassword) {
        Optional<Project> projectOpt = projectStore.getProject(projectId, true);
        if (!projectOpt.isPresent()) return;

        Optional<UserModel> userOpt = userStore.getUserByIdentifier(projectId, UserStore.IdentifierType.EMAIL, forgotPassword.getEmail());
        if (!userOpt.isPresent()) {
            return;
        }

        if (userOpt.get().getSsoGuid() != null) {
            log.info("Forgot password for sso user {}", userOpt.get().getEmail());
            return;
        }

        notificationService.onForgotPassword(
                projectOpt.get().getVersionedConfigAdmin().getConfig(),
                userOpt.get());
    }

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public UserBindResponse userBind(String projectId) {
        Optional<UserStore.UserModel> userOpt = getExtendedPrincipal().flatMap(ExtendedSecurityContext.ExtendedPrincipal::getUserSessionOpt)
                .map(UserStore.UserSession::getUserId)
                .flatMap(userId -> userStore.getUser(projectId, userId));

        return new UserBindResponse(userOpt
                .map(UserStore.UserModel::toUserMeWithBalance)
                .orElse(null));
    }

    @PermitAll
    @Limit(requiredPermits = 100)
    @Override
    public UserMeWithBalance userCreate(String projectId, UserCreate userCreate) {
        String userId = userStore.genUserId();
        Optional<String> passwordHashed = Optional.empty();
        if (!Strings.isNullOrEmpty(userCreate.getPassword())) {
            passwordHashed = Optional.of(passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userCreate.getPassword(), userId));
        }
        UserModel user = new UserModel(
                projectId,
                userId,
                null,
                null,
                userCreate.getName(),
                userCreate.getEmail(),
                null,
                passwordHashed.orElse(null),
                null,
                userCreate.getEmail() != null,
                0L,
                userCreate.getIosPushToken(),
                userCreate.getAndroidPushToken(),
                userCreate.getBrowserPushToken(),
                Instant.now(),
                null,
                null,
                null);
        userStore.createUser(user);

        UserStore.UserSession session = userStore.createSession(
                projectId,
                user.getUserId(),
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookieUtil.setAuthCookie(response, USER_AUTH_COOKIE_NAME, session.getSessionId(), session.getTtlInEpochSec());

        return user.toUserMeWithBalance();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userCreateAdmin(String projectId, UserCreateAdmin userCreateAdmin) {
        String userId = userStore.genUserId();
        Optional<String> passwordHashed = Optional.empty();
        if (!Strings.isNullOrEmpty(userCreateAdmin.getPassword())) {
            if (userCreateAdmin.getSsoGuid() != null) {
                throw new ErrorWithMessageException(Response.Status.BAD_REQUEST, "Cannot specify both password and ssoGuid");
            }
            passwordHashed = Optional.of(passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userCreateAdmin.getPassword(), userId));
        }
        UserModel user = new UserModel(
                projectId,
                userId,
                userCreateAdmin.getSsoGuid(),
                userCreateAdmin.getIsAdmin() == Boolean.TRUE ? true : null,
                userCreateAdmin.getName(),
                userCreateAdmin.getEmail(),
                null,
                passwordHashed.orElse(null),
                null,
                userCreateAdmin.getEmail() != null,
                userCreateAdmin.getBalance() == null ? 0 : userCreateAdmin.getBalance(),
                userCreateAdmin.getIosPushToken(),
                userCreateAdmin.getAndroidPushToken(),
                userCreateAdmin.getBrowserPushToken(),
                Instant.now(),
                null,
                null,
                null);
        userStore.createUser(user);
        if (user.getIsAdmin()) {
            ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
            notificationService.onAdminInvite(configAdmin, user);
        }
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
        UserModel user = userStore.getUser(projectId, userId).get();
        return new User(user.getUserId(), user.getName());
    }

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public UserMeWithBalance userLogin(String projectId, UserLogin userLogin) {
        Optional<UserModel> userOpt = userStore.getUserByIdentifier(projectId, UserStore.IdentifierType.EMAIL, userLogin.getEmail());
        if (!userOpt.isPresent()) {
            log.info("User login with non-existent email {}", userLogin.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        UserModel user = userOpt.get();

        if (user.getSsoGuid() != null) {
            log.info("Account login for sso user {}", user.getEmail());
            throw new ErrorWithMessageException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }

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
        authCookieUtil.setAuthCookie(response, USER_AUTH_COOKIE_NAME, session.getSessionId(), session.getTtlInEpochSec());

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

        authCookieUtil.unsetAuthCookie(response, USER_AUTH_COOKIE_NAME);
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1, challengeAfter = 20)
    @Override
    public UserMe userUpdate(String projectId, String userId, UserUpdate userUpdate) {
        // TODO Sanity check userUpdate also pass cannot be set by sso user
        if (userUpdate.getEmail() != null) {
            UserModel user = userStore.getUser(projectId, userId).get();
            if (!Strings.isNullOrEmpty(user.getEmail())
                    && (user.getEmailLastUpdated() == null || user.getEmailLastUpdated().plus(config.sendOnEmailChangedEmailIfLastChangeGreaterThan()).isBefore(Instant.now()))) {
                ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
                notificationService.onEmailChanged(configAdmin, user, user.getEmail());
            }
        }
        UserModel user = userStore.updateUser(projectId, userId, userUpdate).getUser();
        return user.toUserMe();
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userUpdateAdmin(String projectId, String userId, UserUpdateAdmin userUpdateAdmin) {
        // TODO Sanity check userUpdateAdmin
        if (userUpdateAdmin.getTransactionCreate() != null) {
            voteStore.balanceAdjustTransaction(
                    projectId,
                    userId,
                    userUpdateAdmin.getTransactionCreate().getAmount(),
                    Optional.ofNullable(Strings.emptyToNull(userUpdateAdmin.getTransactionCreate().getSummary())).orElse("Admin adjustment"));
            userStore.updateUserBalance(projectId, userId, userUpdateAdmin.getTransactionCreate().getAmount(), Optional.empty());
        }
        return userStore.updateUser(projectId, userId, userUpdateAdmin).getUser().toUserAdmin();
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

        final ImmutableMap<String, UserModel> usersById;
        if (searchUsersResponse.getUserIds().isEmpty()) {
            usersById = ImmutableMap.of();
        } else {
            usersById = userStore.getUsers(projectId, searchUsersResponse.getUserIds());
        }

        return new UserSearchResponse(
                searchUsersResponse.getCursorOpt().orElse(null),
                searchUsersResponse.getUserIds().stream()
                        .map(usersById::get)
                        .filter(Objects::nonNull)
                        .map(UserModel::toUserAdmin)
                        .collect(ImmutableList.toImmutableList()));
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
