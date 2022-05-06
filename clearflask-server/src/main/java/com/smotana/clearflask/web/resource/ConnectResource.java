// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.web.resource;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.RobotsConnectApi;
import com.smotana.clearflask.api.SniConnectApi;
import com.smotana.clearflask.api.model.Cert;
import com.smotana.clearflask.api.model.CertGetOrCreateResponse;
import com.smotana.clearflask.api.model.Challenge;
import com.smotana.clearflask.api.model.Keypair;
import com.smotana.clearflask.api.model.RobotsResult;
import com.smotana.clearflask.security.CertFetcher;
import com.smotana.clearflask.security.CertFetcher.CertAndKeypair;
import com.smotana.clearflask.store.CertStore;
import com.smotana.clearflask.store.CertStore.CertModel;
import com.smotana.clearflask.store.CertStore.ChallengeModel;
import com.smotana.clearflask.store.CertStore.KeypairModel;
import com.smotana.clearflask.store.CertStore.KeypairModel.KeypairType;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.Project;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Role;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.security.RolesAllowed;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.ClientErrorException;
import javax.ws.rs.NotFoundException;
import javax.ws.rs.Path;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.Response;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Singleton
@Path(Application.RESOURCE_VERSION)
public class ConnectResource extends AbstractResource implements SniConnectApi, RobotsConnectApi {

    public interface Config {
        @DefaultValue("^(.+\\.)?clearflask\\.com$")
        String domainWhitelist();
    }

    @Context
    private HttpHeaders headers;
    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private CertStore certStore;
    @Inject
    private ProjectStore projectStore;
    @Inject
    private CertFetcher certFetcher;

    @RolesAllowed({Role.CONNECT})
    @Override
    public void accountKeypairDeleteConnect(String id) {
        certStore.deleteKeypair(KeypairType.ACCOUNT, id);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public Keypair accountKeypairGetConnect(String id) {
        return certStore.getKeypair(KeypairType.ACCOUNT, id)
                .map(KeypairModel::toApiKeypair)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void accountKeypairPutConnect(String id, Keypair keypair) {
        certStore.setKeypair(new KeypairModel(
                id,
                KeypairType.ACCOUNT,
                keypair.getPrivateKeyPem(),
                keypair.getPrivateKeyJwkJson()));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certChallengeDnsDeleteConnect(String host, Challenge challenge) {
        certStore.deleteDnsChallenge(host, challenge.getResult());
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public Challenge certChallengeDnsGetConnect(String host) {
        return certStore.getDnsChallenge(host)
                .map(Challenge::new)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certChallengeDnsPutConnect(String host, Challenge challenge) {
        certStore.setDnsChallenge(host, challenge.getResult());
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certChallengeHttpDeleteConnect(String key) {
        certStore.deleteHttpChallenge(key);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public Challenge certChallengeHttpGetConnect(String key) {
        return certStore.getHttpChallenge(key)
                .map(ChallengeModel::toChallenge)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certChallengeHttpPutConnect(String key, Challenge challenge) {
        certStore.setHttpChallenge(new ChallengeModel(
                key,
                challenge.getResult()));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certDeleteConnect(String domain) {
        certStore.deleteCert(domain);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public Cert certGetConnect(String domain) {
        Optional<CertModel> certOpt = certStore.getCert(domain);
        if (certOpt.isPresent()) {
            return certOpt.get().toCert();
        }
        if (projectStore.getProjectBySlug(domain, true).isPresent()) {
            throw new ClientErrorException(Response.Status.NOT_FOUND);
        }
        if (domain.matches(config.domainWhitelist())) {
            Optional<Cert> wildCertOpt = certFetcher.getOrCreateCertAndKeypair(domain)
                    .map(CertAndKeypair::getCert)
                    .map(CertModel::toCert);
            if (wildCertOpt.isPresent()) {
                return wildCertOpt.get();
            }
        }
        throw new ClientErrorException(Response.Status.UNAUTHORIZED);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public CertGetOrCreateResponse certGetOrCreateConnect(String domain) {
        return certFetcher.getOrCreateCertAndKeypair(domain)
                .map(CertAndKeypair::toCertGetOrCreateResponse)
                .orElseThrow(NotFoundException::new);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certKeypairDeleteConnect(String id) {
        certStore.deleteKeypair(KeypairType.CERT, id);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public Keypair certKeypairGetConnect(String id) {
        return certStore.getKeypair(KeypairType.CERT, id)
                .map(KeypairModel::toApiKeypair)
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certKeypairPutConnect(String id, Keypair keypair) {
        certStore.setKeypair(new KeypairModel(
                id,
                KeypairType.CERT,
                keypair.getPrivateKeyPem(),
                keypair.getPrivateKeyJwkJson()));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certPutConnect(String domain, Cert cert) {
        certStore.setCert(new CertModel(
                domain,
                cert.getCert(),
                cert.getChain(),
                cert.getAltnames(),
                Instant.ofEpochMilli(cert.getIssuedAt()),
                Instant.ofEpochMilli(cert.getExpiresAt()),
                Instant.ofEpochMilli(cert.getExpiresAt()).getEpochSecond()));
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public RobotsResult robotsConnect(String slug) {
        Optional<Project> projectOpt = projectStore.getProjectBySlug(slug, false);

        boolean doIndex = false;
        if (projectOpt.isPresent()) {
            doIndex = projectOpt.get().getVersionedConfigAdmin().getConfig().getNoIndex() != Boolean.TRUE;
        }

        return new RobotsResult(doIndex);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ConnectResource.class);
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), Object.class, Names.named(Application.RESOURCE_NAME)).addBinding()
                        .to(ConnectResource.class);
            }
        };
    }
}
