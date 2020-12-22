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
import com.smotana.clearflask.api.model.Credits;
import com.smotana.clearflask.api.model.CreditsCreditOnSignup;
import com.smotana.clearflask.api.model.EmailSignup;
import com.smotana.clearflask.api.model.ForgotPassword;
import com.smotana.clearflask.api.model.Hits;
import com.smotana.clearflask.api.model.SubscriptionListenerUser;
import com.smotana.clearflask.api.model.User;
import com.smotana.clearflask.api.model.UserAdmin;
import com.smotana.clearflask.api.model.UserBind;
import com.smotana.clearflask.api.model.UserBindResponse;
import com.smotana.clearflask.api.model.UserCreate;
import com.smotana.clearflask.api.model.UserCreateAdmin;
import com.smotana.clearflask.api.model.UserCreateResponse;
import com.smotana.clearflask.api.model.UserLogin;
import com.smotana.clearflask.api.model.UserMe;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.UserSearchAdmin;
import com.smotana.clearflask.api.model.UserSearchResponse;
import com.smotana.clearflask.api.model.UserUpdate;
import com.smotana.clearflask.api.model.UserUpdateAdmin;
import com.smotana.clearflask.billing.Billing;
import com.smotana.clearflask.core.push.NotificationService;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.store.ProjectStore.WebhookListener.ResourceType;
import com.smotana.clearflask.store.TokenVerifyStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.SearchUsersResponse;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.store.UserStore.UserSession;
import com.smotana.clearflask.store.VoteStore;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.util.PasswordUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.AuthCookie;
import com.smotana.clearflask.web.security.ExtendedSecurityContext.ExtendedPrincipal;
import com.smotana.clearflask.web.security.Role;
import com.smotana.clearflask.web.security.UserBindUtil;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class UserResource extends AbstractResource implements UserApi, UserAdminApi {

    public interface Config {
        @DefaultValue("P300D")
        Duration sessionExpiry();

        @DefaultValue("P150D")
        Duration sessionRenewIfExpiringIn();

        @DefaultValue(value = "10", innerType = Integer.class)
        Optional<Integer> searchPageSize();

        @DefaultValue("P7D")
        Duration sendOnEmailChangedEmailIfLastChangeGreaterThan();
    }

    public static final String USER_AUTH_COOKIE_NAME_PREFIX = "cf_usr_auth_";

    @Inject
    private Config config;
    @Inject
    private UserStore userStore;
    @Inject
    private VoteStore voteStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private TokenVerifyStore tokenVerifyStore;
    @Inject
    private PasswordUtil passwordUtil;
    @Inject
    private NotificationService notificationService;
    @Inject
    private AuthCookie authCookie;
    @Inject
    private Billing billing;
    @Inject
    private UserBindUtil userBindUtil;

    @PermitAll
    @Limit(requiredPermits = 100, challengeAfter = 3)
    @Override
    public void forgotPassword(String projectId, ForgotPassword forgotPassword) {
        sanitizer.email(forgotPassword.getEmail());

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
    public UserBindResponse userBind(String projectId, UserBind userBind) {
        Optional<UserStore.UserModel> loggedInUserOpt = userBindUtil.userBind(
                response,
                projectId,
                getExtendedPrincipal(),
                Optional.ofNullable(Strings.emptyToNull(userBind.getSsoToken())),
                Optional.ofNullable(Strings.emptyToNull(userBind.getAuthToken())),
                Optional.ofNullable(Strings.emptyToNull(userBind.getBrowserPushToken())));

        Project project = projectStore.getProject(projectId, true).get();
        return new UserBindResponse(loggedInUserOpt
                .map(loggedInUser -> loggedInUser.toUserMeWithBalance(project.getIntercomEmailToIdentityFun()))
                .orElse(null));
    }

    @PermitAll
    @Limit(requiredPermits = 100)
    @Override
    public UserCreateResponse userCreate(String projectId, UserCreate userCreate) {
        if (!Strings.isNullOrEmpty(userCreate.getName())) {
            sanitizer.userName(userCreate.getName());
        }
        if (!Strings.isNullOrEmpty(userCreate.getEmail())) {
            sanitizer.email(userCreate.getEmail());
        }

        Project project = projectStore.getProject(projectId, true).get();
        Optional<EmailSignup> emailSignupOpt = Optional.ofNullable(project.getVersionedConfigAdmin()
                .getConfig()
                .getUsers()
                .getOnboarding()
                .getNotificationMethods()
                .getEmail());

        boolean emailVerificationRequired = false;

        if (EmailSignup.VerificationEnum.REQUIRED.equals(emailSignupOpt
                .map(EmailSignup::getVerification).orElse(null))) {
            emailVerificationRequired = true;
        }
        Optional<List<String>> allowedDomainsOpt = emailSignupOpt.map(EmailSignup::getAllowedDomains);
        if (allowedDomainsOpt.isPresent() && !Strings.isNullOrEmpty(userCreate.getEmail())) {
            String domain = userCreate.getEmail().substring(userCreate.getEmail().indexOf("@") + 1);
            if (!allowedDomainsOpt.get().contains(domain)) {
                throw new ApiException(
                        Response.Status.BAD_REQUEST,
                        "Allowed domains are " + allowedDomainsOpt.get().stream().collect(Collectors.joining(", ")));
            }
            emailVerificationRequired = true;
        }

        boolean emailVerified = false;
        if (emailVerificationRequired && !Strings.isNullOrEmpty(userCreate.getEmail())) {
            if (Strings.isNullOrEmpty(userCreate.getEmailVerification())) {
                TokenVerifyStore.Token token = tokenVerifyStore.createToken(userCreate.getEmail());
                notificationService.onEmailVerify(
                        project.getVersionedConfigAdmin().getConfig(),
                        userCreate.getEmail(),
                        token.getToken());
                return new UserCreateResponse(true, null);
            } else {
                emailVerified = tokenVerifyStore.useToken(userCreate.getEmailVerification(), userCreate.getEmail());
                if (!emailVerified) {
                    throw new ApiException(
                            Response.Status.BAD_REQUEST,
                            "Invalid code");
                }
            }
        }

        long balance = 0;
        Optional<CreditsCreditOnSignup> creditOnSignupOpt = Optional.ofNullable(project
                .getVersionedConfigAdmin()
                .getConfig()
                .getUsers()
                .getCredits())
                .map(Credits::getCreditOnSignup);
        if (creditOnSignupOpt.isPresent() && creditOnSignupOpt.get().getAmount() > 0L) {
            balance = creditOnSignupOpt.get().getAmount();
        }

        // Now we're ready to create the user
        String userId = userStore.genUserId(Optional.ofNullable(Strings.emptyToNull(userCreate.getName())));
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
                emailVerified ? true : null,
                null,
                passwordHashed.orElse(null),
                null,
                userCreate.getEmail() != null,
                balance,
                userCreate.getIosPushToken(),
                userCreate.getAndroidPushToken(),
                userCreate.getBrowserPushToken(),
                Instant.now(),
                null,
                null,
                null,
                null);
        userStore.createUser(user);

        UserSession session = userStore.createSession(
                user,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME_PREFIX + projectId, session.getSessionId(), session.getTtlInEpochSec());

        if (balance > 0L) {
            voteStore.balanceAdjustTransaction(
                    user.getProjectId(),
                    user.getUserId(),
                    balance,
                    creditOnSignupOpt.map(CreditsCreditOnSignup::getSummary).orElse("Sign-up credit"),
                    Optional.of("signup-credit"));
        }

        return new UserCreateResponse(null, user.toUserMeWithBalance(project.getIntercomEmailToIdentityFun()));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userCreateAdmin(String projectId, UserCreateAdmin userCreateAdmin) {
        if (!Strings.isNullOrEmpty(userCreateAdmin.getName())) {
            sanitizer.userName(userCreateAdmin.getName());
        }
        if (!Strings.isNullOrEmpty(userCreateAdmin.getEmail())) {
            sanitizer.email(userCreateAdmin.getEmail());
        }

        String userId = userStore.genUserId(Optional.ofNullable(Strings.emptyToNull(userCreateAdmin.getName())));
        Optional<String> passwordHashed = Optional.empty();
        if (!Strings.isNullOrEmpty(userCreateAdmin.getPassword())) {
            if (userCreateAdmin.getSsoGuid() != null) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot specify both password and ssoGuid");
            }
            passwordHashed = Optional.of(passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userCreateAdmin.getPassword(), userId));
        }
        UserModel user = new UserModel(
                projectId,
                userId,
                userCreateAdmin.getSsoGuid(),
                userCreateAdmin.getIsMod() == Boolean.TRUE ? true : null,
                userCreateAdmin.getName(),
                userCreateAdmin.getEmail(),
                null,
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
                null,
                null);
        userStore.createUser(user);
        if (user.getIsMod() == Boolean.TRUE) {
            ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
            notificationService.onAdminInvite(configAdmin, user);
        }
        Project project = projectStore.getProject(projectId, true).get();
        return user.toUserAdmin(project.getIntercomEmailToIdentityFun());
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1)
    @Override
    public void userDelete(String projectId, String userId) {
        userStore.deleteUsers(projectId, ImmutableList.of(userId));
    }

    @RolesAllowed({Role.PROJECT_ANON})
    @Limit(requiredPermits = 10)
    @Override
    public User userGet(String projectId, String userId) {
        return userStore.getUser(projectId, userId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"))
                .toUser();
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void userDeleteAdmin(String projectId, String userId) {
        userStore.deleteUsers(projectId, ImmutableList.of(userId));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void userDeleteBulkAdmin(String projectId, UserSearchAdmin userSearchAdmin) {
        sanitizer.searchText(userSearchAdmin.getSearchText());

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

    @PermitAll
    @Limit(requiredPermits = 10, challengeAfter = 15)
    @Override
    public UserMeWithBalance userLogin(String projectId, UserLogin userLogin) {
        sanitizer.email(userLogin.getEmail());

        Optional<UserModel> userOpt = userStore.getUserByIdentifier(projectId, UserStore.IdentifierType.EMAIL, userLogin.getEmail());
        if (!userOpt.isPresent()) {
            log.info("User login with non-existent email {}", userLogin.getEmail());
            throw new ApiException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        UserModel user = userOpt.get();

        if (user.getSsoGuid() != null) {
            log.info("Account login for sso user {}", user.getEmail());
            throw new ApiException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }

        String passwordSupplied = passwordUtil.saltHashPassword(PasswordUtil.Type.USER, userLogin.getPassword(), user.getUserId());
        if (Strings.isNullOrEmpty(user.getPassword())) {
            // Password-less user
        } else if (!user.getPassword().equals(passwordSupplied)) {
            log.info("Account login incorrect password for email {}", user.getEmail());
            throw new ApiException(Response.Status.UNAUTHORIZED, "Email or password incorrect");
        }
        log.debug("Successful user login for email {}", userLogin.getEmail());

        UserSession session = userStore.createSession(
                user,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME_PREFIX + projectId, session.getSessionId(), session.getTtlInEpochSec());

        Project project = projectStore.getProject(projectId, true).get();
        return user.toUserMeWithBalance(project.getIntercomEmailToIdentityFun());
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public UserMeWithBalance userLoginAdmin(String projectId, String userId) {
        Optional<UserModel> userOpt = userStore.getUser(projectId, userId);
        if (!userOpt.isPresent()) {
            throw new ApiException(Response.Status.NOT_FOUND, "User does not exist");
        }
        UserModel user = userOpt.get();
        log.debug("Successful user login by admin for userId {}", userId);

        UserSession session = userStore.createSession(
                user,
                Instant.now().plus(config.sessionExpiry()).getEpochSecond());
        authCookie.setAuthCookie(response, USER_AUTH_COOKIE_NAME_PREFIX + projectId, session.getSessionId(), session.getTtlInEpochSec());

        Project project = projectStore.getProject(projectId, true).get();
        return user.toUserMeWithBalance(project.getIntercomEmailToIdentityFun());
    }

    @PermitAll
    @Limit(requiredPermits = 1)
    @Override
    public void userLogout(String projectId) {
        Optional<ExtendedPrincipal> extendedPrincipal = getExtendedPrincipal();
        if (!extendedPrincipal.isPresent() || !extendedPrincipal.get().getUserSessionOpt().isPresent()) {
            log.trace("Cannot logout user, already not logged in");
            return;
        }
        UserSession session = extendedPrincipal.get().getUserSessionOpt().get();

        log.debug("Logout session for user {}", session.getUserId());
        userStore.revokeSession(session);

        authCookie.unsetAuthCookie(response, USER_AUTH_COOKIE_NAME_PREFIX + projectId);
    }

    @RolesAllowed({Role.PROJECT_USER})
    @Limit(requiredPermits = 1, challengeAfter = 20)
    @Override
    public UserMe userUpdate(String projectId, String userId, UserUpdate userUpdate) {
        sanitizer.userName(userUpdate.getName());
        sanitizer.email(userUpdate.getEmail());

        UserModel user = userStore.getUser(projectId, userId).get();

        if (!Strings.isNullOrEmpty(user.getSsoGuid())) {
            if (!Strings.isNullOrEmpty(userUpdate.getEmail())) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot change email when using Single Sign-On");
            }
            if (!Strings.isNullOrEmpty(userUpdate.getName())) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot change name when using Single Sign-On");
            }
            if (!Strings.isNullOrEmpty(userUpdate.getPassword())) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot set a password when using Single Sign-On");
            }
        }

        if (!Strings.isNullOrEmpty(userUpdate.getEmail())) {
            if (!Strings.isNullOrEmpty(user.getEmail())
                    && (user.getEmailLastUpdated() == null || user.getEmailLastUpdated().plus(config.sendOnEmailChangedEmailIfLastChangeGreaterThan()).isBefore(Instant.now()))) {
                ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
                notificationService.onEmailChanged(configAdmin, user, user.getEmail());
            }
        }

        user = userStore.updateUser(projectId, userId, userUpdate).getUser();

        Project project = projectStore.getProject(projectId, true).get();
        return user.toUserMe(project.getIntercomEmailToIdentityFun());
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE, Role.PROJECT_MODERATOR_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userUpdateAdmin(String projectId, String userId, UserUpdateAdmin userUpdateAdmin) {
        sanitizer.userName(userUpdateAdmin.getName());
        sanitizer.email(userUpdateAdmin.getEmail());

        if (userUpdateAdmin.getTransactionCreate() != null) {
            TransactionModel transaction = voteStore.balanceAdjustTransaction(
                    projectId,
                    userId,
                    userUpdateAdmin.getTransactionCreate().getAmount(),
                    Optional.ofNullable(Strings.emptyToNull(userUpdateAdmin.getTransactionCreate().getSummary())).orElse("Admin adjustment"),
                    Optional.empty());
            userStore.updateUserBalance(projectId, userId, userUpdateAdmin.getTransactionCreate().getAmount(), Optional.empty());
            ConfigAdmin configAdmin = projectStore.getProject(projectId, true).get().getVersionedConfigAdmin().getConfig();
            UserModel user = userStore.getUser(projectId, userId).get();
            notificationService.onCreditChanged(configAdmin, user, transaction);
        }
        Project project = projectStore.getProject(projectId, true).get();
        return userStore.updateUser(projectId, userId, userUpdateAdmin)
                .getUser()
                .toUserAdmin(project.getIntercomEmailToIdentityFun());
    }

    @RolesAllowed({Role.PROJECT_OWNER, Role.PROJECT_MODERATOR})
    @Limit(requiredPermits = 1)
    @Override
    public UserAdmin userGetAdmin(String projectId, String userId) {
        Project project = projectStore.getProject(projectId, true).get();
        return userStore.getUser(projectId, userId)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "User not found"))
                .toUserAdmin(project.getIntercomEmailToIdentityFun());
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 10)
    @Override
    public UserSearchResponse userSearchAdmin(String projectId, UserSearchAdmin userSearchAdmin, String cursor) {
        sanitizer.searchText(userSearchAdmin.getSearchText());

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

        Project project = projectStore.getProject(projectId, true).get();
        return new UserSearchResponse(
                searchUsersResponse.getCursorOpt().orElse(null),
                searchUsersResponse.getUserIds().stream()
                        .map(usersById::get)
                        .filter(Objects::nonNull)
                        .map(loggedInUser -> loggedInUser.toUserAdmin(project.getIntercomEmailToIdentityFun()))
                        .collect(ImmutableList.toImmutableList()),
                new Hits(
                        searchUsersResponse.getTotalHits(),
                        searchUsersResponse.isTotalHitsGte() ? true : null));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 100)
    @Override
    public void userSubscribeAdmin(String projectId, SubscriptionListenerUser subscriptionListener) {
        projectStore.addWebhookListener(projectId, new ProjectStore.WebhookListener(
                ResourceType.USER,
                subscriptionListener.getEventType().name(),
                subscriptionListener.getListenerUrl()));
    }

    @RolesAllowed({Role.PROJECT_OWNER_ACTIVE})
    @Limit(requiredPermits = 1)
    @Override
    public void userUnsubscribeAdmin(String projectId, SubscriptionListenerUser subscriptionListener) {
        projectStore.removeWebhookListener(projectId, new ProjectStore.WebhookListener(
                ResourceType.USER,
                subscriptionListener.getEventType().name(),
                subscriptionListener.getListenerUrl()));
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
