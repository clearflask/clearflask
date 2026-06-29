// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.security;

import com.amazonaws.util.StringInputStream;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Strings;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.util.concurrent.ListeningExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.CertGetOrCreateResponse;
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
import org.jetbrains.annotations.NotNull;
import org.shredzone.acme4j.*;
import org.shredzone.acme4j.challenge.Challenge;
import org.shredzone.acme4j.challenge.Dns01Challenge;
import org.shredzone.acme4j.challenge.Http01Challenge;
import org.shredzone.acme4j.exception.AcmeRateLimitedException;
import org.shredzone.acme4j.toolbox.AcmeUtils;
import org.shredzone.acme4j.util.CSRBuilder;
import org.shredzone.acme4j.util.KeyPairUtils;
import org.xbill.DNS.ARecord;
import org.xbill.DNS.Cache;
import org.xbill.DNS.Lookup;
import org.xbill.DNS.NSRecord;
import org.xbill.DNS.Record;
import org.xbill.DNS.Resolver;
import org.xbill.DNS.SimpleResolver;
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
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Singleton
public class CertFetcherImpl extends ManagedService implements CertFetcher {

    public static final String KEYPAIR_ID_INTERNAL_WILD = "clearflask-wildcard";

    public interface Config {
        @DefaultValue("true")
        boolean enabled();

        @DefaultValue("P30D")
        Duration renewWithExpiryRangeMin();

        @DefaultValue("P60D")
        Duration renewWithExpiryRangeMax();

        @DefaultValue("")
        String staticCert();

        /**
         * Before attempting an ACME HTTP-01 challenge for a customer's custom domain, verify the
         * domain's DNS actually resolves to us (the same A record(s) this target resolves to). This
         * avoids hammering Let's Encrypt and spamming error logs for domains that were set up once
         * but later re-pointed elsewhere. Should match {@code Sanitizer.Config.sniDomain()}, the
         * CNAME target customers are instructed to use. Leave empty to disable the check.
         */
        @DefaultValue("sni.clearflask.com")
        String customDomainExpectedCnameTarget();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private Gson gson;
    @Inject
    private CertStore certStore;
    @Inject
    private ProjectStore projectStore;

    private final LoadingCache<String, CertGetOrCreateResponse> staticCertCache = CacheBuilder.newBuilder()
            .maximumSize(1)
            .build(new CacheLoader<>() {
                @Override
                public CertGetOrCreateResponse load(@NotNull String certStr) throws Exception {
                    // Replace literal '\n' into new line
                    certStr = certStr.replaceAll("\\\\n", "\n");
                    // Parse from JSON
                    return gson.fromJson(certStr, CertGetOrCreateResponse.class);
                }
            });
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
    public Optional<CertGetOrCreateResponse> getOrCreateCertAndKeypair(String domain) {
        if (!config.enabled()) {
            return Optional.empty();
        }

        // Static cert handling
        String staticCert = config.staticCert();
        if (!Strings.isNullOrEmpty(staticCert)) {
            try {
                return Optional.of(staticCertCache.get(staticCert));
            } catch (ExecutionException ex) {
                throw new RuntimeException("Failed to parse static from configuration, check for 'staticCert' property", ex);
            }
        }

        // Dynamic cert handling
        try {
            String domainToRequest;
            // Custom domains (a customer's own domain pointed at us) use the ACME HTTP-01 challenge,
            // which only succeeds if their DNS resolves to us. Our own (sub)domains use a wildcard
            // cert via the DNS-01 challenge and never need this check.
            boolean isCustomDomain;
            if (configApp.domain().equals(domain)
                    || domain.endsWith("." + configApp.domain())) {
                domainToRequest = "*." + configApp.domain();
                isCustomDomain = false;
            } else if (!projectStore.getProjectBySlug(domain, true).isPresent()) {
                return Optional.empty();
            } else {
                domainToRequest = domain;
                isCustomDomain = true;
            }

            Optional<CertModel> certModelOpt = certStore.getCert(domainToRequest, false);
            if (certModelOpt.isPresent()
                    && Instant.now().isAfter(certModelOpt.get().getExpiresAt().minus(renewWithExpiry))
                    && (certModelOpt.get().getRetryAfter() == null || Instant.now().isAfter(certModelOpt.get().getRetryAfter()))) {
                if (isCustomDomain && !isCustomDomainPointingToUs(domain)) {
                    if (LogUtil.rateLimitAllowLog("CertFetcher-custom-domain-dns-mismatch-" + domain)) {
                        log.info("Skipping cert renewal for custom domain {}, its DNS no longer resolves to us (expected to match {}); serving existing cert until it does",
                                domain, config.customDomainExpectedCnameTarget());
                    }
                } else {
                    executor.submit(() -> {
                        try {
                            createCert(domainToRequest);
                        } catch (AcmeRateLimitedException ex) {
                            log.warn("Acme rate limit for domain {}", domain, ex);
                            ex.getRetryAfter().ifPresent(retryAfter -> certStore.setCertRetryAfter(domainToRequest, retryAfter));
                        } catch (Exception ex) {
                            log.warn("Failed to renew cert for domain {}", domain, ex);
                        }
                    });
                }
            }
            if (certModelOpt.isEmpty()) {
                if (isCustomDomain && !isCustomDomainPointingToUs(domain)) {
                    if (LogUtil.rateLimitAllowLog("CertFetcher-custom-domain-dns-mismatch-" + domain)) {
                        log.info("Skipping cert creation for custom domain {}, its DNS does not resolve to us (expected to match {})",
                                domain, config.customDomainExpectedCnameTarget());
                    }
                    return Optional.empty();
                }
                synchronized (this) {
                    certModelOpt = certStore.getCert(domainToRequest, true);
                    if (certModelOpt.isEmpty()) {
                        try {
                            return Optional.of(createCert(domainToRequest))
                                    .map(CertAndKeypair::toCertGetOrCreateResponse);
                        } catch (Exception ex) {
                            log.warn("Failed to create cert for domain {}", domain, ex);
                            return Optional.empty();
                        }
                    }
                }
            }
            Optional<KeypairModel> keypairModelOpt = certStore.getKeypair(KeypairType.CERT, domainToRequest);
            if (keypairModelOpt.isEmpty()) {
                log.warn("No keypair found matching cert for domain {}, re-creating both", domainToRequest);
                certStore.deleteCert(domainToRequest);
                return Optional.of(createCert(domainToRequest))
                        .map(CertAndKeypair::toCertGetOrCreateResponse);
            }

            return Optional.of(new CertAndKeypair(
                            certModelOpt.get(),
                            keypairModelOpt.get()))
                    .map(CertAndKeypair::toCertGetOrCreateResponse);
        } catch (Exception ex) {
            if (LogUtil.rateLimitAllowLog("WildCertFetcherImpl-failed-get-create-wildcart-cert")) {
                log.warn("Failed to get/create wildcard cert for domain {}", domain, ex);
            }
            return Optional.empty();
        }
    }

    /**
     * Returns whether the custom domain currently resolves to us, i.e. shares at least one A record
     * with our expected CNAME target. This predicts whether an ACME HTTP-01 challenge can succeed
     * before we bother attempting it. Fails open (returns true) if our own target can't be resolved,
     * so a transient resolver hiccup never blocks legitimate renewals.
     */
    private boolean isCustomDomainPointingToUs(String domain) {
        String target = config.customDomainExpectedCnameTarget();
        if (Strings.isNullOrEmpty(target)) {
            // Check disabled
            return true;
        }

        ImmutableSet<String> ourIps;
        try {
            ourIps = resolveARecords(target);
        } catch (Exception ex) {
            log.warn("Custom domain DNS pre-check: failed to resolve our own target {}, proceeding without check", target, ex);
            return true;
        }
        if (ourIps.isEmpty()) {
            log.warn("Custom domain DNS pre-check: our own target {} resolved to no A records, proceeding without check", target);
            return true;
        }

        ImmutableSet<String> domainIps;
        try {
            domainIps = resolveARecords(domain);
        } catch (Exception ex) {
            // Domain doesn't resolve at all; it cannot pass an HTTP-01 challenge, so treat as not pointing to us
            return false;
        }
        return domainIps.stream().anyMatch(ourIps::contains);
    }

    private ImmutableSet<String> resolveARecords(String host) throws Exception {
        // Use a fresh, cache-less lookup so DNS changes are picked up immediately (mirrors dnsChallengeSetup)
        Cache cache = new Cache();
        cache.setMaxCache(0);
        cache.setMaxNCache(0);
        cache.setMaxEntries(0);
        Lookup lookup = new Lookup(host, Type.A);
        lookup.setCache(cache);
        org.xbill.DNS.Record[] records = lookup.run();
        if (records == null) {
            return ImmutableSet.of();
        }
        return Arrays.stream(records)
                .filter(r -> r instanceof ARecord)
                .map(r -> ((ARecord) r).getAddress().getHostAddress())
                .collect(ImmutableSet.toImmutableSet());
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
                certificate.getCertificate().getNotAfter().toInstant().getEpochSecond(),
                null);

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
        Optional<Http01Challenge> httpChallengeOpt = authorization.findChallenge(Http01Challenge.TYPE);
        if (httpChallengeOpt.isPresent()) {
            httpChallengeSetup(authorization, httpChallengeOpt.get());
            return httpChallengeOpt.get();
        }

        Optional<Dns01Challenge> dnsChallengeOpt = authorization.findChallenge(Dns01Challenge.TYPE);
        if (dnsChallengeOpt.isPresent()) {
            dnsChallengeSetup(authorization, dnsChallengeOpt.get());
            return dnsChallengeOpt.get();
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

        // Disable JVM DNS caching
        try {
            java.security.Security.setProperty("networkaddress.cache.ttl", "0");
        } catch (Exception ignored) {
        }

        // Verify the challenge record is visible before triggering Let's Encrypt validation.
        //
        // We query the zone's AUTHORITATIVE nameservers directly rather than going through a
        // recursive resolver: recursive resolvers negatively-cache the (previously absent)
        // _acme-challenge name for the zone's negative-cache TTL, and our DNS provider
        // (Porkbun) can take a couple of minutes to propagate a freshly-created record to its
        // own authoritative nameservers. Querying the authoritative servers avoids the
        // negative-cache trap and reflects exactly what Let's Encrypt will check. We also poll
        // for several minutes to allow that propagation to complete (the record stays in place
        // until the challenge is torn down).
        Optional<Resolver> authoritativeResolverOpt = authoritativeResolver(authorization.getIdentifier().getDomain());

        ImmutableList<String> txtStrings = ImmutableList.of();
        int attempts = 80;
        for (int i = 0; i < attempts; i++) {
            // Fresh Lookup + empty cache each iteration so we actually re-query rather than
            // returning the first (likely empty) result.
            Cache cache = new Cache();
            cache.setMaxCache(0);
            cache.setMaxNCache(0);
            cache.setMaxEntries(0);
            Lookup lookup = new Lookup(challengeDomain, Type.TXT);
            lookup.setCache(cache);
            authoritativeResolverOpt.ifPresent(lookup::setResolver);

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

            // Wait a few seconds before re-checking
            Thread.sleep(3000L);
        }
        throw new Exception("Failed to verify own set DNS challenge for domain: " + authorization.getIdentifier().getDomain()
                + " expected string: " + challenge.getDigest()
                + " got strings: " + txtStrings);
    }

    /**
     * Returns a resolver that queries the authoritative nameservers for the given domain's
     * zone, so challenge verification is unaffected by recursive-resolver negative caching.
     * Walks up the labels until an NS record set is found (so subdomains resolve to their zone
     * apex's nameservers). Returns empty on failure, in which case the caller falls back to the
     * default resolver.
     */
    private Optional<Resolver> authoritativeResolver(String domain) {
        try {
            String name = domain.endsWith(".") ? domain : domain + ".";
            // Stop once only the TLD label remains (don't query the TLD/root for NS).
            while (name.indexOf('.') != name.lastIndexOf('.')) {
                Record[] records = new Lookup(name, Type.NS).run();
                if (records != null) {
                    for (Record record : records) {
                        if (record instanceof NSRecord) {
                            String ns = ((NSRecord) record).getTarget().toString();
                            log.info("Verifying DNS challenge against authoritative nameserver {} for {}", ns, domain);
                            return Optional.of(new SimpleResolver(ns));
                        }
                    }
                }
                // Try the parent zone.
                name = name.substring(name.indexOf('.') + 1);
            }
        } catch (Exception ex) {
            log.warn("Could not resolve authoritative nameserver for {}; falling back to default resolver", domain, ex);
        }
        return Optional.empty();
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
            log.info("Failed to teardown challenge, but continuing certificate creation of host {} challenge {}",
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
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(CertFetcherImpl.class).asEagerSingleton();
            }
        };
    }
}
