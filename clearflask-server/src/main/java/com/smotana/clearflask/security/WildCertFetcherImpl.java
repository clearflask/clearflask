package com.smotana.clearflask.security;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListeningExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.CertStore;
import com.smotana.clearflask.store.CertStore.CertModel;
import com.smotana.clearflask.store.CertStore.KeypairModel.KeypairType;
import com.smotana.clearflask.web.Application;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.shredzone.acme4j.Account;
import org.shredzone.acme4j.AccountBuilder;
import org.shredzone.acme4j.Authorization;
import org.shredzone.acme4j.Certificate;
import org.shredzone.acme4j.Order;
import org.shredzone.acme4j.Session;
import org.shredzone.acme4j.Status;
import org.shredzone.acme4j.challenge.Challenge;
import org.shredzone.acme4j.challenge.Dns01Challenge;
import org.shredzone.acme4j.util.CSRBuilder;
import org.shredzone.acme4j.util.KeyPairUtils;

import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
public class WildCertFetcherImpl extends ManagedService implements WildCertFetcher {

    public static final String KEYPAIR_ID_INTERNAL_WILD = "clearflask-wildcard";

    public interface Config {
        @DefaultValue("false")
        boolean enabled();

        @DefaultValue("P30D")
        Duration renewWithExpiryRangeMin();

        @DefaultValue("P60D")
        Duration renewWithExpiryRangeMax();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private CertStore certStore;

    private ListeningExecutorService executor;
    private Duration renewWithExpiry;

    @Override
    protected void serviceStart() throws Exception {
        executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadExecutor(new ThreadFactoryBuilder()
                .setNameFormat("WildCertManager-worker-%d").build()));
        Duration expiryRange = config.renewWithExpiryRangeMax()
                .minus(config.renewWithExpiryRangeMin());
        renewWithExpiry = config.renewWithExpiryRangeMin()
                .plus((long) (expiryRange.toSeconds() * ThreadLocalRandom.current().nextDouble()), ChronoUnit.SECONDS);
    }

    @Override
    protected void serviceStop() throws Exception {
        executor.shutdownNow();
        executor.awaitTermination(30, TimeUnit.SECONDS);
    }

    @SneakyThrows
    @Override
    public Optional<CertModel> getCert() {
        if (!config.enabled()) {
            return Optional.empty();
        }

        String domainWildcard = "*." + configApp.domain();
        Optional<CertModel> certModelOpt = certStore.getCert(domainWildcard);

        if (certModelOpt.isEmpty()) {
            KeyPair keyPair = loadOrCreateKeyPair(KeypairType.ACCOUNT, KEYPAIR_ID_INTERNAL_WILD);

            Session session = new Session("acme://letsencrypt.org");

            Account account = findOrRegisterAccount(session, keyPair);

            KeyPair domainKeyPair = loadOrCreateKeyPair(KeypairType.CERT, configApp.domain());

            // Order the certificate
            ImmutableSet<String> domains = ImmutableSet.of(
                    configApp.domain(),
                    domainWildcard);
            Order order = account.newOrder()
                    .domains(domains)
                    .create();

            for (Authorization auth : order.getAuthorizations()) {
                authorize(auth);
            }

            // Generate a CSR for all of the domains, and sign it with the domain key pair.
            CSRBuilder csrBuilder = new CSRBuilder();
            csrBuilder.addDomains(domains);
            csrBuilder.sign(domainKeyPair);

            // Order the certificate
            order.execute(csrBuilder.getEncoded());

            // Wait for the order to complete
            int attempts = 10;
            while (order.getStatus() != Status.VALID && attempts-- > 0) {
                // Did the order fail?
                if (order.getStatus() == Status.INVALID) {
                    log.warn("Order has failed, reason: {}", order.getError());
                    throw new Exception("Order failed... Giving up.");
                }

                // Wait for a few seconds
                Thread.sleep(3000L);

                // Then update the status
                order.update();
            }

            // Get the certificate
            Certificate certificate = order.getCertificate();
            certModelOpt = Optional.of(new CertModel(
                    configApp.domain(),
                    certificate.getCertificate().toString(),
                    certificate.getCertificateChain().stream()
                            .map(java.security.cert.Certificate::toString)
                            .collect(Collectors.joining("\n\n")),
                    ImmutableList.of(domainWildcard),
                    certificate.getCertificate().getNotBefore().toInstant(),
                    certificate.getCertificate().getNotAfter().toInstant(),
                    certificate.getCertificate().getNotAfter().toInstant().getEpochSecond()));

            certStore.setCert(certModelOpt.get());
        }

        return certModelOpt;
    }

    private KeyPair loadOrCreateKeyPair(KeypairType type, String id) {
        Optional<KeyPair> keyPairOpt = certStore.getKeypair(
                        type, id)
                .map(CertStore.KeypairModel::toJavaKeyPair);
        if (keyPairOpt.isEmpty()) {
            keyPairOpt = Optional.of(KeyPairUtils.createKeyPair());
            certStore.setKeypair(new CertStore.KeypairModel(
                    id,
                    type,
                    keyPairOpt.get()));
        }
        return keyPairOpt.get();
    }

    @SneakyThrows
    private Account findOrRegisterAccount(Session session, KeyPair accountKey) {
        Account account = new AccountBuilder()
                .agreeToTermsOfService()
                .useKeyPair(accountKey)
                .create(session);
        return account;
    }

    @SneakyThrows
    private void authorize(Authorization authorization) {
        if (Status.VALID.equals(authorization.getStatus())) {
            return;
        }

        Dns01Challenge challenge = dnsChallengeSetup(authorization);

        try {

            if (Status.VALID.equals(challenge.getStatus())) {
                return;
            }

            challenge.trigger();

            // Poll for the challenge to complete.
            int attempts = 10;
            while (challenge.getStatus() != Status.VALID && attempts-- > 0) {
                // Did the authorization fail?
                if (challenge.getStatus() == Status.INVALID) {
                    log.error("Challenge has failed, reason: {}", challenge.getError());
                    throw new Exception("Challenge failed... Giving up.");
                }

                // Wait for a few seconds
                Thread.sleep(3000L);

                challenge.update();
            }

            if (challenge.getStatus() != Status.VALID) {
                throw new Exception("Failed to pass the challenge for domain "
                        + authorization.getIdentifier().getDomain() + ", ... Giving up.");
            }

        } finally {
            dnsChallengeTeardown(authorization, challenge);
        }
    }


    private Dns01Challenge dnsChallengeSetup(Authorization authorization) {
        Dns01Challenge challenge = authorization.findChallenge(Dns01Challenge.TYPE);
        if (challenge == null) {
            throw new RuntimeException("No DNS challenge found, available ones: "
                    + authorization.getChallenges().stream().map(Challenge::getType).collect(Collectors.joining(",")));
        }
        certStore.setDnsChallenge(
                dnsChallengeDomainToHost(authorization.getIdentifier().getDomain()),
                challenge.getDigest());
        return challenge;
    }

    private void dnsChallengeTeardown(Authorization authorization, Dns01Challenge challenge) {
        certStore.deleteDnsChallenge(
                dnsChallengeDomainToHost(authorization.getIdentifier().getDomain()),
                challenge.getDigest());
    }

    private String dnsChallengeDomainToHost(String domain) {
        return "_acme-challenge." + domain + ".";
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(WildCertFetcherImpl.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(WildCertFetcherImpl.class);
            }
        };
    }
}
