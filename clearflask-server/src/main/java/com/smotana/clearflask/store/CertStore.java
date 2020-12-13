package com.smotana.clearflask.store;

import com.smotana.clearflask.api.model.Cert;
import com.smotana.clearflask.api.model.Challenge;
import com.smotana.clearflask.api.model.Keypair;
import com.smotana.clearflask.store.CertStore.KeypairModel.KeypairType;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface CertStore {

    Optional<KeypairModel> getKeypair(KeypairType type, String id);

    void setKeypair(KeypairModel keypair);

    void deleteKeypair(KeypairType type, String id);


    Optional<ChallengeModel> getChallenge(String key);

    void setChallenge(ChallengeModel challenge);

    void deleteChallenge(String key);


    Optional<CertModel> getCert(String domain);

    void setCert(CertModel cert);

    void deleteCert(String domain);


    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"id", "type"}, rangePrefix = "keypairById")
    class KeypairModel {
        /**
         * For KeyPairType.ACCOUNT: 'hostmaster@clearflask.com' email or 'default'
         * For KeyPairType.CERT: domain, or certificate id
         * See greenlock-store-clearflask.js for details
         */
        @NonNull
        String id;

        @NonNull
        KeypairType type;

        @NonNull
        String privateKeyPem;

        @NonNull
        String privateKeyJwkJson;

        public enum KeypairType {
            ACCOUNT,
            CERT
        }

        public Keypair toKeyPair() {
            return new Keypair(
                    getPrivateKeyPem(),
                    getPrivateKeyJwkJson());
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
