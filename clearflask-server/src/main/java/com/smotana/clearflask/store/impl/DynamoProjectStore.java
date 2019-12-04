package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Expected;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.GetItemResult;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.util.concurrent.AbstractIdleService;
import com.google.common.util.concurrent.Service;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.store.ProjectStore;

import java.time.Duration;
import java.util.Optional;

@Singleton
public class DynamoProjectStore extends AbstractIdleService implements ProjectStore {

    private interface Config {
        @DefaultValue("true")
        boolean enableConfigCacheRead();

        @DefaultValue("PT1M")
        Duration configCacheExpireAfterWrite();
    }

    private static final String PROJECT_TABLE = "project";
    private static final String PROJECT_ID = "projectId";
    private static final String PROJECT_VERSION = "version";
    private static final String PROJECT_DATA = "data";

    @Inject
    private Config config;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private Gson gson;

    private Cache<String, Optional<VersionedConfigAdmin>> versionedConfigAdminCache;
    private Table projectTable;

    @Override
    protected void startUp() throws Exception {
        versionedConfigAdminCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();

        try {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(PROJECT_TABLE)
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName(PROJECT_ID).withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName(PROJECT_ID).withAttributeType(ScalarAttributeType.S)))
                    .withBillingMode(BillingMode.PAY_PER_REQUEST));
        } catch (ResourceInUseException ex) {
        }
        projectTable = dynamoDoc.getTable(PROJECT_TABLE);
    }

    @Override
    protected void shutDown() throws Exception {
    }

    @Override
    public Optional<VersionedConfigAdmin> getConfig(String projectId, boolean useCache) {
        if (config.enableConfigCacheRead() && useCache) {
            final Optional<VersionedConfigAdmin> versionedConfigAdminCachedOpt = versionedConfigAdminCache.getIfPresent(projectId);
            //noinspection OptionalAssignedToNull
            if (versionedConfigAdminCachedOpt != null) {
                return versionedConfigAdminCachedOpt;
            }
        }

        GetItemResult item = dynamo.getItem(PROJECT_TABLE, ImmutableMap.of(PROJECT_ID, new AttributeValue(projectId)));

        final Optional<VersionedConfigAdmin> versionedConfigAdminOpt;
        if (item.getItem() == null) {
            versionedConfigAdminOpt = Optional.empty();
        } else {
            versionedConfigAdminOpt = Optional.of(new VersionedConfigAdmin(
                    gson.fromJson(item.getItem().get(PROJECT_VERSION).getS(), ConfigAdmin.class),
                    item.getItem().get(PROJECT_VERSION).getS()));
        }

        versionedConfigAdminCache.put(projectId, versionedConfigAdminOpt);

        return versionedConfigAdminOpt;
    }

    @Override
    public void createConfig(String projectId, VersionedConfigAdmin versionedConfigAdmin) {
        projectTable.putItem(new Item()
                .withPrimaryKey(PROJECT_ID, projectId)
                .withString(PROJECT_VERSION, versionedConfigAdmin.getVersion())
                .withString(PROJECT_DATA, gson.toJson(versionedConfigAdmin.getConfig())));
        versionedConfigAdminCache.invalidate(projectId);
    }

    @Override
    public void updateConfig(String projectId, String previousVersion, VersionedConfigAdmin versionedConfigAdmin) {
        projectTable.putItem(new Item()
                        .withPrimaryKey(PROJECT_ID, projectId)
                        .withString(PROJECT_VERSION, versionedConfigAdmin.getVersion())
                        .withString(PROJECT_DATA, gson.toJson(versionedConfigAdmin.getConfig())),
                new Expected(PROJECT_VERSION).eq(previousVersion));
        versionedConfigAdminCache.invalidate(projectId);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ProjectStore.class).to(DynamoProjectStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), Service.class).addBinding().to(DynamoProjectStore.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
