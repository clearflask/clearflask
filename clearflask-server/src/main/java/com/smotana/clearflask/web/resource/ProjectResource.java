package com.smotana.clearflask.web.resource;

import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.common.util.concurrent.Futures;
import com.smotana.clearflask.api.ProjectAdminApi;
import com.smotana.clearflask.api.ProjectApi;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.ConfigAndBindResult;
import com.smotana.clearflask.api.model.ConfigGetAllResult;
import com.smotana.clearflask.api.model.NewProjectResult;
import com.smotana.clearflask.api.model.UserMeWithBalance;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.security.limiter.Limit;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.AccountStore.Account;
import com.smotana.clearflask.store.AccountStore.Session;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.util.ModelUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.PermitAll;
import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.util.Optional;

@Slf4j
@Singleton
@Path("/v1")
public class ProjectResource extends AbstractResource implements ProjectApi, ProjectAdminApi {

    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private UserStore userStore;
    @Inject
    private UserStore ideaStore;

    @PermitAll
    @Limit(requiredPermits = 10)
    @Override
    public ConfigAndBindResult configGetAndUserBind(String projectId) {
        Optional<VersionedConfig> configOpt = projectStore.getConfig(projectId, true);
        if (!configOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Project not found");
        }

        UserMeWithBalance user = null; // TODO add binding here

        return new ConfigAndBindResult(configOpt.get(), user);
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configGetAdmin(String projectId) {
        Optional<VersionedConfigAdmin> configAdminOpt = projectStore.getConfigAdmin(projectId);
        if (!configAdminOpt.isPresent()) {
            throw new ErrorWithMessageException(Response.Status.NOT_FOUND, "Project not found");
        }
        return configAdminOpt.get();
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public ConfigGetAllResult configGetAllAdmin() {
        Session session = getExtendedPrincipal().get().getAccountSessionOpt().get();
        Account account = accountStore.getAccount(session.getAccountId()).orElseThrow(() -> {
            log.error("Account not found for session, account {}", session.getAccountId());
            return new InternalServerErrorException();
        });
        ImmutableSet<VersionedConfigAdmin> configAdmins = projectStore.getConfigAdmins(account.getProjectIds());
        if (account.getProjectIds().size() != configAdmins.size()) {
            log.error("ProjectIds on account not found in project table, account {} missing projects {}",
                    account.getAccountId(), Sets.difference(account.getProjectIds(), configAdmins.stream()
                            .map(c -> c.getConfig().getProjectId()).collect(ImmutableSet.toImmutableSet())));
        }
        return new ConfigGetAllResult(configAdmins.asList());
    }

    @RolesAllowed({Role.PROJECT_OWNER})
    @Limit(requiredPermits = 1)
    @Override
    public VersionedConfigAdmin configSetAdmin(String projectId, String versionLast, ConfigAdmin configAdmin) {
        VersionedConfigAdmin versionedConfigAdmin = new VersionedConfigAdmin(configAdmin, ModelUtil.createConfigVersion());
        projectStore.updateConfig(projectId, versionLast, versionedConfigAdmin);
        return versionedConfigAdmin;
    }

    @RolesAllowed({Role.ADMINISTRATOR})
    @Limit(requiredPermits = 1)
    @Override
    public NewProjectResult projectCreateAdmin(String projectId) {
        // TODO sanity check, projectId alphanumeric
        VersionedConfigAdmin configAdmin = ModelUtil.createEmptyConfig(projectId);
        projectStore.createConfig(projectId, configAdmin);
        Futures.allAsList(
                userStore.createIndex(projectId),
                ideaStore.createIndex(projectId)
        );
        return new NewProjectResult(projectId, configAdmin);
    }
}
