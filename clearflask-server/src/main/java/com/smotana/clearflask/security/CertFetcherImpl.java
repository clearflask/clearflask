package com.smotana.clearflask.security;

import com.amazonaws.util.StringInputStream;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListeningExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.CertStore;
import com.smotana.clearflask.store.CertStore.CertModel;
import com.smotana.clearflask.store.CertStore.ChallengeModel;
import com.smotana.clearflask.store.CertStore.KeypairModel;
import com.smotana.clearflask.store.CertStore.KeypairModel.KeypairType;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.util.LogUtil;
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
import org.shredzone.acme4j.challenge.Http01Challenge;
import org.shredzone.acme4j.toolbox.AcmeUtils;
import org.shredzone.acme4j.util.CSRBuilder;
import org.shredzone.acme4j.util.KeyPairUtils;
import org.xbill.DNS.Lookup;
import org.xbill.DNS.TXTRecord;
import org.xbill.DNS.Type;

import java.io.StringWriter;
import java.security.KeyPair;
import java.security.Security;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Singleton
public class CertFetcherImpl extends ManagedService implements CertFetcher {

    public static final String KEYPAIR_ID_INTERNAL_WILD = "clearflask-wildcard";
    public static final Instant CHECK_PRIVATE_PUBLIC_CREATED_PRIOR_TO = Instant.ofEpochMilli(/* May 7, 2022 */1651932425000L);

    public interface Config {
        @DefaultValue("true")
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
    @Inject
    private ProjectStore projectStore;

    private ListeningExecutorService executor;
    private Duration renewWithExpiry;

    @Override
    protected void serviceStart() throws Exception {
        Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());

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

    @Override
    public Optional<CertAndKeypair> getOrCreateCertAndKeypair(String domain) {
        if (!config.enabled()) {
            return Optional.empty();
        }

        try {
            String domainToRequest;
            if (configApp.domain().equals(domain)
                    || domain.endsWith("." + configApp.domain())) {
                domainToRequest = "*." + configApp.domain();
            } else if (!projectStore.getProjectBySlug(domain, true).isPresent()) {
                return Optional.empty();
            } else {
                domainToRequest = domain;
            }

            Optional<CertModel> certModelOpt = certStore.getCert(domainToRequest);
            if (certModelOpt.isPresent() && Instant.now().isAfter(certModelOpt.get().getExpiresAt().minus(renewWithExpiry))) {
                executor.submit(() -> {
                    try {
                        createCert(domainToRequest);
                    } catch (Exception ex) {
                        log.warn("Failed to renew cert for domain {}", domain, ex);
                    }
                });
            }
            if (certModelOpt.isEmpty()) {
                try {
                    return Optional.of(createCert(domainToRequest));
                } catch (Exception ex) {
                    log.warn("Failed to create cert for domain {}", domain, ex);
                    return Optional.empty();
                }
            } else {
                Optional<KeypairModel> keypairModelOpt = certStore.getKeypair(KeypairType.CERT, domainToRequest);
                if (keypairModelOpt.isEmpty()) {
                    log.warn("No keypair found matching cert for domain {}, re-creating both", domainToRequest);
                    certStore.deleteCert(domainToRequest);
                    return Optional.of(createCert(domainToRequest));
                }

                // Because there were a few certs we created with the wrong private key,
                // Ensure the private key matches the cert otherwise throw it away
                if (certModelOpt.get().getIssuedAt().isBefore(CHECK_PRIVATE_PUBLIC_CREATED_PRIOR_TO)) {
                    boolean privatePublicMatches = checkPrivatePublicMatches(certModelOpt.get(), keypairModelOpt.get());
                    if (!privatePublicMatches) {
                        log.warn("Keypair doesn't match cert for domain {}, re-creating both", domainToRequest);
                        certStore.deleteKeypair(KeypairType.CERT, domainToRequest);
                        certStore.deleteCert(domainToRequest);
                        return Optional.of(createCert(domainToRequest));
                    }
                }

                return Optional.of(new CertAndKeypair(
                        certModelOpt.get(),
                        keypairModelOpt.get()));
            }
        } catch (Exception ex) {
            if (LogUtil.rateLimitAllowLog("WildCertFetcherImpl-failed-get-create-wildcart-cert")) {
                log.warn("Failed to get/create wildcard cert for domain {}", domain, ex);
            }
            return Optional.empty();
        }
    }

    @SneakyThrows
    @VisibleForTesting
    static boolean checkPrivatePublicMatches(CertModel certModel, KeypairModel keypairModel) {
        KeyPair keyPair = keypairModel.toJavaKeyPair();

        X509Certificate cert;
        try (StringInputStream sis = new StringInputStream(certModel.getCert())) {
            return CertificateFactory.getInstance("X.509").generateCertificate(sis)
                    .getPublicKey()
                    .equals(keyPair.getPublic());
        }
    }

    private CertAndKeypair createCert(String domain) throws Exception {
        log.info("Creating cert for domain {}", domain);

        KeypairModel accountKeypair = loadOrCreateKeyPair(KeypairType.ACCOUNT, domain);

        Session session = new Session("acme://letsencrypt.org");

        Account account = findOrRegisterAccount(session, accountKeypair.toJavaKeyPair());

        KeypairModel domainKeypair = loadOrCreateKeyPair(KeypairType.CERT, domain);

        // Order the certificate
        boolean isWild = domain.startsWith("*.");
        ImmutableSet<String> domains = isWild
                ? ImmutableSet.of(domain, domain.substring(2))
                : ImmutableSet.of(domain);
        Order order = account.newOrder()
                .domains(domains)
                .create();

        for (Authorization auth : order.getAuthorizations()) {
            authorize(auth);
        }

        if (!Status.VALID.equals(order.getStatus())) {
            // Generate a CSR for all of the domains, and sign it with the domain key pair.
            CSRBuilder csrBuilder = new CSRBuilder();
            csrBuilder.addDomains(domains);
            csrBuilder.sign(domainKeypair.toJavaKeyPair());

            // Order the certificate
            order.execute(csrBuilder.getEncoded());
        }

        // Wait for the order to complete
        int attempts = 10;
        while (!Status.VALID.equals(order.getStatus()) && attempts-- > 0) {
            // Did the order fail?
            if (Status.INVALID.equals(order.getStatus())) {
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

        CertModel certModel = new CertModel(
                domain,
                certToPemString(certificate.getCertificate()),
                certificate.getCertificateChain().stream()
                        .map(this::certToPemString)
                        .collect(Collectors.joining("\n\n")),
                domains.asList(),
                certificate.getCertificate().getNotBefore().toInstant(),
                certificate.getCertificate().getNotAfter().toInstant(),
                certificate.getCertificate().getNotAfter().toInstant().getEpochSecond());

        certStore.setCert(certModel);

        return new CertAndKeypair(certModel, domainKeypair);
    }

    @SneakyThrows
    private String certToPemString(X509Certificate cert) {
        try (StringWriter certWriter = new StringWriter()) {
            AcmeUtils.writeToPem(cert.getEncoded(), AcmeUtils.PemLabel.CERTIFICATE, certWriter);
            return certWriter.toString();
        }
    }

    private KeypairModel loadOrCreateKeyPair(KeypairType type, String id) {
        Optional<KeypairModel> keyPairOpt = certStore.getKeypair(
                type, id);
        if (keyPairOpt.isEmpty()) {
            KeyPair javaKeyPair = KeyPairUtils.createKeyPair();
            keyPairOpt = Optional.of(new KeypairModel(
                    id,
                    type,
                    javaKeyPair));
            certStore.setKeypair(keyPairOpt.get());
        }
        return keyPairOpt.get();
    }

    @SneakyThrows
    private Account findOrRegisterAccount(Session session, KeyPair accountKey) {
        return new AccountBuilder()
                .agreeToTermsOfService()
                .useKeyPair(accountKey)
                .create(session);
    }

    @SneakyThrows
    private void authorize(Authorization authorization) {
        if (Status.VALID.equals(authorization.getStatus())) {
            return;
        }

        Challenge challenge = challengeSetup(authorization);

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
            challengeTeardown(authorization, challenge);
        }
    }

    @SneakyThrows
    private Challenge challengeSetup(Authorization authorization) {
        Http01Challenge httpChallenge = authorization.findChallenge(Http01Challenge.TYPE);
        if (httpChallenge != null) {
            httpChallengeSetup(authorization, httpChallenge);
            return httpChallenge;
        }

        Dns01Challenge dnsChallenge = authorization.findChallenge(Dns01Challenge.TYPE);
        if (dnsChallenge != null) {
            dnsChallengeSetup(authorization, dnsChallenge);
            return dnsChallenge;
        }

        throw new RuntimeException("No appropriate challenges found, available ones: "
                + authorization.getChallenges().stream().map(Challenge::getType).collect(Collectors.joining(",")));
    }

    @SneakyThrows
    private void httpChallengeSetup(Authorization authorization, Http01Challenge challenge) {
        certStore.setHttpChallenge(new ChallengeModel(
                challenge.getToken(),
                challenge.getAuthorization()));
    }

    @SneakyThrows
    private void dnsChallengeSetup(Authorization authorization, Dns01Challenge challenge) {
        String challengeDomain = dnsChallengeDomainToHost(authorization.getIdentifier().getDomain());
        certStore.setDnsChallenge(
                challengeDomain,
                challenge.getDigest());

        // Poll to verify DNS entry.
        Lookup lookup = new Lookup(challengeDomain, Type.TXT);
        ImmutableList<String> txtStrings = ImmutableList.of();
        int attempts = 10;
        for (int i = 0; i < 10; i++) {
            txtStrings = Optional.ofNullable(lookup.run())
                    .stream()
                    .flatMap(Arrays::stream)
                    .filter(r -> r.getType() == Type.TXT)
                    .filter(r -> r instanceof TXTRecord)
                    .map(r -> (TXTRecord) r)
                    .map(TXTRecord::getStrings)
                    .flatMap(List::stream)
                    .collect(ImmutableList.toImmutableList());

            if (txtStrings.stream().anyMatch(challenge.getDigest()::equals)) {
                return;
            }

            // Wait for a few seconds
            Thread.sleep(3000L);
        }
        throw new Exception("Failed to verify own set DNS challenge for domain: " + authorization.getIdentifier().getDomain()
                + " expected string: " + challenge.getDigest()
                + " got strings: " + txtStrings);
    }

    private void challengeTeardown(Authorization authorization, Challenge challenge) {
        if (challenge instanceof Http01Challenge) {
            httpChallengeTeardown((Http01Challenge) challenge);
        } else if (challenge instanceof Dns01Challenge) {
            dnsChallengeTeardown(authorization, (Dns01Challenge) challenge);
        } else {
            log.warn("Failed to teardown unknown challenge type {}, continuing...", challenge.getType());
        }
    }

    private void httpChallengeTeardown(Http01Challenge challenge) {
        certStore.deleteHttpChallenge(challenge.getToken());
    }

    private void dnsChallengeTeardown(Authorization authorization, Dns01Challenge challenge) {
        String challengeDomain = dnsChallengeDomainToHost(authorization.getIdentifier().getDomain());
        try {
            certStore.deleteDnsChallenge(challengeDomain, challenge.getDigest());
        } catch (Exception ex) {
            log.warn("Failed to teardown challenge, but continuing certificate creation of host {} challenge {}",
                    challengeDomain, challenge.getDigest(), ex);
        }
    }

    private String dnsChallengeDomainToHost(String domain) {
        return "_acme-challenge." + domain;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(CertFetcher.class).to(CertFetcherImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(CertFetcherImpl.class);
            }
        };
    }
}
