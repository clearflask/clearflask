// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.smotana.clearflask.api.RobotsConnectApi;
import com.smotana.clearflask.api.SniConnectApi;
import com.smotana.clearflask.api.model.CertGetOrCreateResponse;
import com.smotana.clearflask.api.model.Challenge;
import com.smotana.clearflask.api.model.RobotsResult;
import com.smotana.clearflask.security.CertFetcher;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.CertStore;
import com.smotana.clearflask.store.CertStore.ChallengeModel;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.NotFoundException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Response;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class ConnectResource extends AbstractResource implements SniConnectApi, RobotsConnectApi {

    @Inject
    private ProjectStore projectStore;
    @Inject
    private AccountStore accountStore;
    @Inject
    private CertStore certStore;
    @Inject
    private CertFetcher certFetcher;

    @RolesAllowed({Role.CONNECT})
    @Override
    public Challenge certChallengeHttpGetConnect(String key) {
        return certStore.getHttpChallenge(key)
                .map(ChallengeModel::toChallenge)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public CertGetOrCreateResponse certGetOrCreateConnect(String domain) {
        return certFetcher.getOrCreateCertAndKeypair(domain)
                .orElseThrow(NotFoundException::new);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public RobotsResult robotsConnect(String slug) {
        Optional<Project> projectOpt = projectStore.getProjectBySlug(slug, false);

        boolean doIndex = false;
        if (projectOpt.isPresent()) {
            // Do not index if project explicitly says so
            doIndex = projectOpt.get().getVersionedConfigAdmin().getConfig().getNoIndex() != Boolean.TRUE;

            // Do not index if account is in trial or blocked
            if (doIndex) {
                Optional<AccountStore.Account> accountOpt = accountStore.getAccount(projectOpt.get().getAccountId(), true);
                if (accountOpt.isEmpty()) {
                    doIndex = false;
                    log.error("No account with id {} found for project {}, allowing indexing",
                            projectOpt.get().getAccountId(), projectOpt.get().getProjectId());
                } else {
                    switch (accountOpt.get().getStatus()) {
                        case BLOCKED:
                        case ACTIVETRIAL:
                            doIndex = false;
                            break;
                    }
                }
            }
        }

        return new RobotsResult(doIndex);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ConnectResource.class);
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(ConnectResource.class);
            }
        };
    }
}
