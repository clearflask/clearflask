package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Expected;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.Table;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.CreateTableRequest;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ResourceNotFoundException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableList;
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
        @DefaultValue("project")
        String projectTableName();

        @DefaultValue("PT1M")
        Duration versionedConfigAdminCacheExpireAfterWrite();
    }

    private static final String PROJECT_ID = "projectId";
    private static final String PROJECT_VERSION = "version";
    private static final String PROJECT_DATA = "data";

    @Inject
    private Config config;
    @Inject
    private DynamoDB dynamo;
    @Inject
    private Gson gson;

    private Cache<String, Optional<VersionedConfigAdmin>> versionedConfigAdminCache;
    private Table projectTable;

    @Override
    protected void startUp() throws Exception {
        versionedConfigAdminCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.versionedConfigAdminCacheExpireAfterWrite())
                .build();

        projectTable = dynamo.getTable(config.projectTableName());
        try {
            projectTable.describe();
        } catch (ResourceNotFoundException ex) {
            dynamo.createTable(new CreateTableRequest()
                    .withTableName(config.projectTableName())
                    .withKeySchema(ImmutableList.of(
                            new KeySchemaElement().withAttributeName(PROJECT_ID).withKeyType(KeyType.HASH)))
                    .withAttributeDefinitions(ImmutableList.of(
                            new AttributeDefinition().withAttributeName(PROJECT_VERSION).withAttributeType(ScalarAttributeType.N),
                            new AttributeDefinition().withAttributeName(PROJECT_DATA).withAttributeType(ScalarAttributeType.S))));
        }
    }

    @Override
    protected void shutDown() throws Exception {
    }

    @Override
    public Optional<VersionedConfigAdmin> getConfig(String projectId, boolean useCache) {
        if (useCache) {
            final Optional<VersionedConfigAdmin> versionedConfigAdminCachedOpt = versionedConfigAdminCache.getIfPresent(projectId);
            //noinspection OptionalAssignedToNull
            if (versionedConfigAdminCachedOpt != null) {
                return versionedConfigAdminCachedOpt;
            }
        }

        final Item item = projectTable.getItem(PROJECT_ID, projectId);

        final Optional<VersionedConfigAdmin> versionedConfigAdminOpt;
        if (item == null) {
            versionedConfigAdminOpt = Optional.empty();
        } else {
            versionedConfigAdminOpt = Optional.of(new VersionedConfigAdmin(
                    gson.fromJson(item.getString(PROJECT_VERSION), ConfigAdmin.class),
                    item.getString(PROJECT_VERSION)));
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
        // TODO check result
        versionedConfigAdminCache.invalidate(projectId);
    }

    @Override
    public void updateConfig(String projectId, String previousVersion, VersionedConfigAdmin versionedConfigAdmin) {
        projectTable.putItem(new Item()
                        .withPrimaryKey(PROJECT_ID, projectId)
                        .withString(PROJECT_VERSION, versionedConfigAdmin.getVersion())
                        .withString(PROJECT_DATA, gson.toJson(versionedConfigAdmin.getConfig())),
                new Expected(PROJECT_VERSION).eq(previousVersion));
        // TODO check result
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
