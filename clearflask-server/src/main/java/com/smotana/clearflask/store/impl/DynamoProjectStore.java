package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.spec.BatchGetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.model.CancellationReason;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.amazonaws.services.dynamodbv2.model.Put;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItem;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsRequest;
import com.amazonaws.services.dynamodbv2.model.TransactionCanceledException;
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
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.NonNull;
import lombok.ToString;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.time.Duration;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

@Slf4j
@Singleton
public class DynamoProjectStore extends ManagedService implements ProjectStore {

    public interface Config {
        @DefaultValue("true")
        boolean enableSlugCacheRead();

        @DefaultValue("P1D")
        Duration slugCacheExpireAfterWrite();

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

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = "slug", rangePrefix = "projectBySlug")
    private static class SlugModel {
        @NonNull
        private final String slug;

        @NonNull
        private final String projectId;
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
    private TableSchema<SlugModel> slugSchema;
    private Cache<String, String> slugCache;
    private Cache<String, Optional<Project>> projectCache;

    @Inject
    private void setup() {
        slugCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();
        projectCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();

        projectSchema = dynamoMapper.parseTableSchema(ProjectModel.class);
        slugSchema = dynamoMapper.parseTableSchema(SlugModel.class);
    }

    @Override
    public Optional<Project> getProjectBySlug(String slug, boolean useCache) {
        if (config.enableSlugCacheRead() && useCache) {
            final String projectId = slugCache.getIfPresent(slug);
            if (projectId != null) {
                return getProject(projectId, useCache);
            }
        }
        Optional<String> projectIdOpt = Optional.ofNullable(slugSchema.fromItem(slugSchema.table()
                .getItem(new GetItemSpec()
                        .withPrimaryKey(slugSchema
                                .primaryKey(Map.of("slug", slug))))))
                .map(SlugModel::getProjectId);
        projectIdOpt.ifPresent(projectId -> slugCache.put(slug, projectId));
        return projectIdOpt.flatMap(projectId -> getProject(projectId, useCache));
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
        SlugModel slugModel = new SlugModel(
                versionedConfigAdmin.getConfig().getSlug(),
                projectId);
        ProjectModel projectModel = new ProjectModel(
                projectId,
                versionedConfigAdmin.getVersion(),
                gson.toJson(versionedConfigAdmin.getConfig()));
        try {
            dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(
                    new TransactWriteItem().withPut(new Put()
                            .withTableName(slugSchema.tableName())
                            .withItem(slugSchema.toAttrMap(slugModel))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", slugSchema.partitionKeyName()))),
                    new TransactWriteItem().withPut(new Put()
                            .withTableName(projectSchema.tableName())
                            .withItem(projectSchema.toAttrMap(projectModel))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", projectSchema.partitionKeyName())))));
        } catch (TransactionCanceledException ex) {
            if (ex.getCancellationReasons().stream().map(CancellationReason::getCode).anyMatch("ConditionalCheckFailed"::equals)) {
                throw new ErrorWithMessageException(Response.Status.CONFLICT, "Project name already taken, please choose another.", ex);
            }
            throw ex;
        }
        ProjectImpl project = new ProjectImpl(projectModel);
        projectCache.put(projectId, Optional.of(project));
        slugCache.put(slugModel.getSlug(), projectId);
        return project;
    }

    @Override
    public void updateConfig(String projectId, Optional<String> previousVersionOpt, VersionedConfigAdmin versionedConfigAdmin) {
        Optional<String> slugOptPrevious = Optional.ofNullable(getProject(projectId, false).get().getVersionedConfigAdmin().getConfig().getSlug());
        Optional<String> slugOpt = Optional.ofNullable(versionedConfigAdmin.getConfig().getSlug());
        if (!slugOpt.equals(slugOptPrevious)) {
            try {
                slugOpt.ifPresent(slug -> slugSchema.table().putItem(new PutItemSpec()
                        .withItem(slugSchema.toItem(new SlugModel(slug, projectId)))
                        .withConditionExpression("attribute_not_exists(#partitionKey)")
                        .withNameMap(Map.of("#partitionKey", slugSchema.partitionKeyName()))));
            } catch (ConditionalCheckFailedException ex) {
                throw new ErrorWithMessageException(Response.Status.CONFLICT, "Slug is already taken, please choose another.", ex);
            }
            slugOptPrevious.ifPresent(slugPrevious -> slugSchema.table().deleteItem(new DeleteItemSpec()
                    .withPrimaryKey(slugSchema.primaryKey(Map.of(
                            "slug", slugPrevious)))));
        }
        PutItemSpec putItemSpec = new PutItemSpec()
                .withItem(projectSchema.toItem(new ProjectModel(
                        projectId,
                        versionedConfigAdmin.getVersion(),
                        gson.toJson(versionedConfigAdmin.getConfig()))));
        previousVersionOpt.ifPresent(previousVersion -> putItemSpec
                .withConditionExpression("version = :previousVersion")
                .withValueMap(Map.of(":previousVersion", previousVersion)));
        try {
            projectSchema.table().putItem(putItemSpec);
        } catch (ConditionalCheckFailedException ex) {
            throw new ErrorWithMessageException(Response.Status.CONFLICT, "Project was modified by someone else while you were editing. Cannot merge changes.", ex);
        }
        slugOptPrevious.ifPresent(slugCache::invalidate);
        slugOpt.ifPresent(slugCache::invalidate);
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
        private final ImmutableMap<String, Category> categories;

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
            this.categories = this.versionedConfig.getConfig().getContent().getCategories().stream()
                    .collect(ImmutableMap.toImmutableMap(
                            Category::getCategoryId,
                            c -> c));
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

        @Override
        public Optional<Category> getCategory(String categoryId) {
            return Optional.ofNullable(categories.get(categoryId));
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
