package com.smotana.clearflask.web.resource;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.smotana.clearflask.api.SniConnectApi;
import com.smotana.clearflask.api.model.Cert;
import com.smotana.clearflask.api.model.Challenge;
import com.smotana.clearflask.api.model.Keypair;
import com.smotana.clearflask.store.CertStore;
import com.smotana.clearflask.store.CertStore.CertModel;
import com.smotana.clearflask.store.CertStore.ChallengeModel;
import com.smotana.clearflask.store.CertStore.KeypairModel;
import com.smotana.clearflask.store.CertStore.KeypairModel.KeypairType;
import com.smotana.clearflask.store.ProjectStore;
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
public class ConnectResource extends AbstractResource implements SniConnectApi {

    @Context
    private HttpHeaders headers;
    @Inject
    private CertStore certStore;
    @Inject
    private ProjectStore projectStore;

    @RolesAllowed({Role.CONNECT})
    @Override
    public void accountKeypairDeleteConnect(String id) {
        certStore.deleteKeypair(KeypairType.ACCOUNT, id);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public Keypair accountKeypairGetConnect(String id) {
        return certStore.getKeypair(KeypairType.ACCOUNT, id)
                .map(KeypairModel::toKeyPair)
                .orElseThrow(NotFoundException::new);
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
    public void certChallengeDeleteConnect(String key) {
        certStore.deleteChallenge(key);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public Challenge certChallengeGetConnect(String key) {
        return certStore.getChallenge(key)
                .map(ChallengeModel::toChallenge)
                .orElseThrow(NotFoundException::new);
    }

    @RolesAllowed({Role.CONNECT})
    @Override
    public void certChallengePutConnect(String key, Challenge challenge) {
        certStore.setChallenge(new ChallengeModel(
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
        Optional<Cert> certOpt = certStore.getCert(domain)
                .map(CertModel::toCert);
        if (certOpt.isPresent()) {
            return certOpt.get();
        } else if (projectStore.getProjectBySlug(domain, true).isPresent()) {
            throw new ClientErrorException(Response.Status.NOT_FOUND);
        } else {
            throw new ClientErrorException(Response.Status.UNAUTHORIZED);
        }
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
                .map(KeypairModel::toKeyPair)
                .orElseThrow(NotFoundException::new);
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
                cert.getExpiresAt()));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ConnectResource.class);
            }
        };
    }
}
