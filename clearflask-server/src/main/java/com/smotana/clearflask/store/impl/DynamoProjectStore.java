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
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Expression;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.NonNull;
import lombok.ToString;
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
    private Cache<String, Optional<Project>> projectCache;


    @Inject
    private void setup() {
        projectCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();

        projectSchema = dynamoMapper.parseTableSchema(ProjectModel.class);
    }

    @Override
    public Optional<Project> getProject(String projectId, boolean useCache) {
        if (config.enableConfigCacheRead() && useCache) {
            final Optional<Project> projectCachedOpt = projectCache.getIfPresent(projectId);
            //noinspection OptionalAssignedToNull
            if (projectCachedOpt != null) {
                return projectCachedOpt;
            }
        }
        Optional<Project> projectOpt = Optional.ofNullable(projectSchema.fromItem(projectSchema.table()
                .getItem(new GetItemSpec()
                        .withPrimaryKey(projectSchema
                                .primaryKey(Map.of("projectId", projectId))))))
                .map(ProjectImpl::new);
        projectCache.put(projectId, projectOpt);
        return projectOpt;
    }

    @Override
    public ImmutableSet<Project> getProjects(ImmutableSet<String> projectIds, boolean useCache) {
        ImmutableSet<Project> projects = dynamoDoc.batchGetItem(new BatchGetItemSpec()
                .withTableKeyAndAttributes(new TableKeysAndAttributes(projectSchema.tableName())
                        .withConsistentRead(!useCache)
                        .withPrimaryKeys(projectIds.stream()
                                .map(projectId -> projectSchema.primaryKey(Map.of("projectId", projectId)))
                                .toArray(PrimaryKey[]::new))))
                .getTableItems()
                .values()
                .stream()
                .flatMap(Collection::stream)
                .map(projectSchema::fromItem)
                .map(ProjectImpl::new)
                .collect(ImmutableSet.toImmutableSet());
        projects.forEach(project -> projectCache.put(project.getProjectId(), Optional.of(project)));
        return projects;
    }

    @Override
    public Project createProject(String projectId, VersionedConfigAdmin versionedConfigAdmin) {
        ProjectModel projectModel = new ProjectModel(
                projectId,
                versionedConfigAdmin.getVersion(),
                gson.toJson(versionedConfigAdmin.getConfig()));
        projectSchema.table().putItem(new PutItemSpec().withItem(projectSchema.toItem(projectModel)));
        ProjectImpl project = new ProjectImpl(projectModel);
        projectCache.put(projectId, Optional.of(project));
        return project;
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
        projectCache.invalidate(projectId);
    }

    @EqualsAndHashCode(of = {"projectId", "version"})
    @ToString(of = {"projectId", "version"})
    private class ProjectImpl implements Project {
        private static final double EXPRESSION_WEIGHT_DEFAULT = 1d;
        private final String projectId;
        private final String version;
        private final VersionedConfig versionedConfig;
        private final VersionedConfigAdmin versionedConfigAdmin;
        private final ImmutableMap<String, ImmutableMap<String, Double>> categoryExpressionToWeight;

        private ProjectImpl(ProjectModel projectModel) {
            this.projectId = projectModel.getProjectId();
            this.version = projectModel.getVersion();
            this.versionedConfig = new VersionedConfig(gson.fromJson(projectModel.getConfigJson(), com.smotana.clearflask.api.model.Config.class), projectModel.getVersion());
            this.versionedConfigAdmin = new VersionedConfigAdmin(gson.fromJson(projectModel.getConfigJson(), ConfigAdmin.class), projectModel.getVersion());
            this.categoryExpressionToWeight = this.versionedConfig.getConfig().getContent().getCategories().stream()
                    .filter(category -> category.getSupport().getExpress() != null)
                    .filter(category -> category.getSupport().getExpress().getLimitEmojiSet() != null)
                    .collect(ImmutableMap.toImmutableMap(
                            Category::getCategoryId,
                            category -> category.getSupport().getExpress().getLimitEmojiSet().stream()
                                    .collect(ImmutableMap.toImmutableMap(
                                            Expression::getDisplay,
                                            e -> e.getWeight().doubleValue()))));
        }

        @Override
        public String getProjectId() {
            return projectId;
        }

        @Override
        public String getVersion() {
            return version;
        }

        public VersionedConfig getVersionedConfig() {
            return versionedConfig;
        }

        public VersionedConfigAdmin getVersionedConfigAdmin() {
            return versionedConfigAdmin;
        }

        @Override
        public double getCategoryExpressionWeight(String category, String expression) {
            ImmutableMap<String, Double> expressionToWeight = categoryExpressionToWeight.get(category);
            if (expressionToWeight == null) {
                return EXPRESSION_WEIGHT_DEFAULT;
            }
            return expressionToWeight.getOrDefault(expression, EXPRESSION_WEIGHT_DEFAULT);
        }
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
