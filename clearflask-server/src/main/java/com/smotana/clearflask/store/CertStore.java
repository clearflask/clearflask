// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.smotana.clearflask.api.model.Cert;
import com.smotana.clearflask.api.model.Challenge;
import com.smotana.clearflask.api.model.Keypair;
import com.smotana.clearflask.store.CertStore.KeypairModel.KeypairType;
import io.dataspray.singletable.DynamoTable;
import lombok.*;
import org.jetbrains.annotations.NotNull;
import org.shredzone.acme4j.util.KeyPairUtils;

import java.io.StringReader;
import java.io.StringWriter;
import java.security.KeyPair;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static io.dataspray.singletable.TableType.Primary;

public interface CertStore {

    Optional<KeypairModel> getKeypair(KeypairType type, String id);

    void setKeypair(KeypairModel keypair);

    void deleteKeypair(KeypairType type, String id);


    Optional<ChallengeModel> getHttpChallenge(String key);

    void setHttpChallenge(ChallengeModel challenge);

    void deleteHttpChallenge(String key);


    Optional<String> getDnsChallenge(String host);

    void setDnsChallenge(String host, String value);

    void deleteDnsChallenge(String host, String value);


    Optional<CertModel> getCert(String domain);

    void setCert(CertModel cert);

    void deleteCert(String domain);


    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"id", "type"}, rangePrefix = "keypairById")
    class KeypairModel {
        /**
         * For KeyPairType.ACCOUNT: 'hostmaster@clearflask.com' email, 'default' or WildCertFetcherImpl.KEYPAIR_ID_INTERNAL_WILD
         * For KeyPairType.CERT: domain, or certificate id
         */
        @NonNull
        String id;

        @NonNull
        KeypairType type;

        @NonNull
        String privateKeyPem;

        public enum KeypairType {
            ACCOUNT,
            CERT
        }

        public Keypair toApiKeypair() {
            return new Keypair(getPrivateKeyPem());
        }

        @SneakyThrows
        public KeyPair toJavaKeyPair() {
            try (StringReader stringReader = new StringReader(this.privateKeyPem)) {
                return KeyPairUtils.readKeyPair(stringReader);
            }
        }

        @SneakyThrows
        public KeypairModel(@NotNull String id, @NotNull KeypairType type, @NotNull KeyPair javaKeyPair) {
            this.id = id;
            this.type = type;
            try (StringWriter stringWriter = new StringWriter()) {
                KeyPairUtils.writeKeyPair(javaKeyPair, stringWriter);
                this.privateKeyPem = stringWriter.toString();
            }
        }
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"key"}, rangePrefix = "challengeByKey")
    class ChallengeModel {
        @NonNull
        String key;

        @NonNull
        String result;

        public Challenge toChallenge() {
            return new Challenge(
                    getResult());
        }
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"domain"}, rangePrefix = "certByDomain")
    class CertModel {
        @NonNull
        String domain;

        @NonNull
        String cert;

        @NonNull
        String chain;

        @NonNull
        List<String> altnames;

        @NonNull
        Instant issuedAt;

        @NonNull
        Instant expiresAt;

        @NonNull
        long ttlInEpochSec;

        public Cert toCert() {
            return new Cert(
                    getCert(),
                    getChain(),
                    getDomain(),
                    getAltnames(),
                    getIssuedAt().toEpochMilli(),
                    getExpiresAt().toEpochMilli());
        }
    }
}
