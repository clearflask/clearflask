package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.CertStore;
import com.smotana.clearflask.store.CertStore.KeypairModel.KeypairType;
import com.smotana.clearflask.store.dynamo.DynamoUtil;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.util.Extern;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.Optional;

@Slf4j
@Singleton
public class DynamoCertStore implements CertStore {

    public interface Config {
    }

    @Inject
    private Config config;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    private DynamoUtil dynamoUtil;
    @Inject
    private Gson gson;

    private TableSchema<KeypairModel> keypairSchema;
    private TableSchema<ChallengeModel> challengeSchema;
    private TableSchema<CertModel> certSchema;

    @Inject
    private void setup() {
        keypairSchema = dynamoMapper.parseTableSchema(KeypairModel.class);
        challengeSchema = dynamoMapper.parseTableSchema(ChallengeModel.class);
        certSchema = dynamoMapper.parseTableSchema(CertModel.class);
    }

    @Extern
    @Override
    public Optional<KeypairModel> getKeypair(KeypairType type, String id) {
        return Optional.ofNullable(keypairSchema.fromItem(keypairSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(keypairSchema.primaryKey(Map.of(
                        "id", id,
                        "type", type))))));
    }

    @Extern
    @Override
    public void setKeypair(KeypairModel keypair) {
        keypairSchema.table().putItem(new PutItemSpec()
                .withItem(keypairSchema.toItem(keypair)));
    }

    @Extern
    @Override
    public void deleteKeypair(KeypairType type, String id) {
        keypairSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(keypairSchema.primaryKey(Map.of(
                        "id", id,
                        "type", type))));
    }

    @Extern
    @Override
    public Optional<ChallengeModel> getChallenge(String key) {
        return Optional.ofNullable(challengeSchema.fromItem(challengeSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(challengeSchema.primaryKey(Map.of(
                        "key", key))))));
    }

    @Extern
    @Override
    public void setChallenge(ChallengeModel challenge) {
        challengeSchema.table().putItem(new PutItemSpec()
                .withItem(challengeSchema.toItem(challenge)));
    }

    @Extern
    @Override
    public void deleteChallenge(String key) {
        challengeSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(challengeSchema.primaryKey(Map.of(
                        "key", key))));
    }

    @Extern
    @Override
    public Optional<CertModel> getCert(String domain) {
        return Optional.ofNullable(certSchema.fromItem(certSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(certSchema.primaryKey(Map.of(
                        "domain", domain))))));
    }

    @Extern
    @Override
    public void setCert(CertModel cert) {
        certSchema.table().putItem(new PutItemSpec()
                .withItem(certSchema.toItem(cert)));
    }

    @Extern
    @Override
    public void deleteCert(String domain) {
        certSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(certSchema.primaryKey(Map.of(
                        "domain", domain))));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(CertStore.class).to(DynamoCertStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
