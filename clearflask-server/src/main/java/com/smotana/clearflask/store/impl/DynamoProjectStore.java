package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.spec.BatchGetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableSet;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

// TODO move to single table dynamo mapper
@Slf4j
@Singleton
public class DynamoProjectStore extends ManagedService implements ProjectStore {

    public interface Config {
        @DefaultValue("true")
        boolean enableConfigCacheRead();

        @DefaultValue("PT1M")
        Duration configCacheExpireAfterWrite();
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "projectId", rangePrefix = "project")
    private static class ProjectModel {
        @NonNull
        private final String projectId;

        @NonNull
        private final String version;

        @NonNull
        private final String configJson;
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
    private Gson gson;

    private TableSchema<ProjectModel> projectSchema;
    private Cache<String, Optional<VersionedConfig>> versionedConfigAdminCache;


    @Inject
    private void setup() {
        versionedConfigAdminCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();

        projectSchema = dynamoMapper.parseTableSchema(ProjectModel.class);
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
        Optional<VersionedConfig> versionedConfigOpt = Optional.ofNullable(projectSchema
                .fromItem(projectSchema.table()
                        .getItem(projectSchema
                                .primaryKey(Map.of(
                                        "projectId", projectId)))))
                .map(project -> new VersionedConfig(
                        gson.fromJson(project.getConfigJson(), com.smotana.clearflask.api.model.Config.class),
                        project.getVersion()));
        versionedConfigAdminCache.put(projectId, versionedConfigOpt);
        return versionedConfigOpt;
    }

    @Override
    public Optional<VersionedConfigAdmin> getConfigAdmin(String projectId) {
        return Optional.ofNullable(projectSchema
                .fromItem(projectSchema.table().getItem(new GetItemSpec()
                        .withPrimaryKey(projectSchema
                                .primaryKey(Map.of(
                                        "projectId", projectId)))
                        .withConsistentRead(true))))
                .map(project -> new VersionedConfigAdmin(
                        gson.fromJson(project.getConfigJson(), ConfigAdmin.class),
                        project.getVersion()));
    }

    @Override
    public ImmutableSet<VersionedConfigAdmin> getConfigAdmins(ImmutableSet<String> projectIds) {
        return dynamoDoc.batchGetItem(new BatchGetItemSpec()
                .withTableKeyAndAttributes(new TableKeysAndAttributes(projectSchema.tableName())
                        .withConsistentRead(true)
                        .withPrimaryKeys(projectIds.stream()
                                .map(projectId -> projectSchema.primaryKey(Map.of("projectId", projectId)))
                                .toArray(PrimaryKey[]::new))))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(projectSchema::fromItem)
                .map(project -> new VersionedConfigAdmin(
                        gson.fromJson(project.getConfigJson(), ConfigAdmin.class),
                        project.getVersion()))
                .collect(ImmutableSet.toImmutableSet());
    }

    @Override
    public void createConfig(String projectId, VersionedConfigAdmin versionedConfigAdmin) {
        projectSchema.table().putItem(new PutItemSpec().withItem(projectSchema.toItem(new ProjectModel(
                projectId,
                versionedConfigAdmin.getVersion(),
                gson.toJson(versionedConfigAdmin.getConfig())))));
        versionedConfigAdminCache.invalidate(projectId);
    }

    @Override
    public void updateConfig(String projectId, String previousVersion, VersionedConfigAdmin versionedConfigAdmin) {
        projectSchema.table().putItem(new PutItemSpec()
                .withItem(projectSchema.toItem(new ProjectModel(
                        projectId,
                        versionedConfigAdmin.getVersion(),
                        gson.toJson(versionedConfigAdmin.getConfig()))))
                .withConditionExpression("version = :previousVersion")
                .withValueMap(Map.of(":previousVersion", previousVersion)));
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
