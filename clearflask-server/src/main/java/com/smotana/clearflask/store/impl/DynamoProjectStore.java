package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Expected;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.BatchGetItemRequest;
import com.amazonaws.services.dynamodbv2.model.BillingMode;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.GetItemResult;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.KeysAndAttributes;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.ProjectStore;

import java.time.Duration;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

@Singleton
public class DynamoProjectStore extends ManagedService implements ProjectStore {

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

    private Cache<String, Optional<VersionedConfig>> versionedConfigAdminCache;
    private Table projectTable;

    @Override
    protected void serviceStart() throws Exception {
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
    public Optional<VersionedConfig> getConfig(String projectId, boolean useCache) {
        if (config.enableConfigCacheRead() && useCache) {
            final Optional<VersionedConfig> versionedConfigAdminCachedOpt = versionedConfigAdminCache.getIfPresent(projectId);
            //noinspection OptionalAssignedToNull
            if (versionedConfigAdminCachedOpt != null) {
                return versionedConfigAdminCachedOpt;
            }
        }
        final Optional<VersionedConfig> versionedConfigOpt = getConfigGeneric(projectId, VersionedConfig.class);
        versionedConfigAdminCache.put(projectId, versionedConfigOpt);
        return versionedConfigOpt;
    }

    @Override
    public Optional<VersionedConfigAdmin> getConfigAdmin(String projectId) {
        return getConfigGeneric(projectId, VersionedConfigAdmin.class);
    }

    private <T> Optional<T> getConfigGeneric(String projectId, Class<T> configClazz) {
        GetItemResult item = dynamo.getItem(PROJECT_TABLE, ImmutableMap.of(PROJECT_ID, new AttributeValue(projectId)));

        final Optional<T> configOpt;
        if (item.getItem() == null) {
            configOpt = Optional.empty();
        } else {
            configOpt = Optional.of(gson.fromJson(item.getItem().get(PROJECT_DATA).getS(), configClazz));
        }

        return configOpt;
    }

    @Override
    public ImmutableSet<VersionedConfigAdmin> getConfigAdmins(ImmutableSet<String> projectIds) {
        return dynamo.batchGetItem(new BatchGetItemRequest().addRequestItemsEntry(PROJECT_TABLE, new KeysAndAttributes()
                .withKeys(projectIds.stream()
                        .map(projectId -> ImmutableMap.of(PROJECT_ID, new AttributeValue(projectId)))
                        .collect(ImmutableList.toImmutableList()))
                .withAttributesToGet(PROJECT_DATA)
                .withConsistentRead(true)))
                .getResponses()
                .entrySet().stream()
                .map(Map.Entry::getValue)
                .flatMap(Collection::stream)
                .map(i -> i.get(PROJECT_DATA))
                .map(AttributeValue::getS)
                .map(configAdminStr -> gson.fromJson(configAdminStr, VersionedConfigAdmin.class))
                .collect(ImmutableSet.toImmutableSet());
    }

    @Override
    public void createConfig(String projectId, VersionedConfigAdmin versionedConfigAdmin) {
        projectTable.putItem(new Item()
                .withPrimaryKey(PROJECT_ID, projectId)
                .withString(PROJECT_VERSION, versionedConfigAdmin.getVersion())
                .withString(PROJECT_DATA, gson.toJson(versionedConfigAdmin)));
        versionedConfigAdminCache.invalidate(projectId);
    }

    @Override
    public void updateConfig(String projectId, String previousVersion, VersionedConfigAdmin versionedConfigAdmin) {
        projectTable.putItem(new Item()
                        .withPrimaryKey(PROJECT_ID, projectId)
                        .withString(PROJECT_VERSION, versionedConfigAdmin.getVersion())
                        .withString(PROJECT_DATA, gson.toJson(versionedConfigAdmin)),
                new Expected(PROJECT_VERSION).eq(previousVersion));
        versionedConfigAdminCache.invalidate(projectId);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ProjectStore.class).to(DynamoProjectStore.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoProjectStore.class);
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
