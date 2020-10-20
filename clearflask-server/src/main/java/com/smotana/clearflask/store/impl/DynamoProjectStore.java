package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.*;
import com.amazonaws.services.dynamodbv2.document.spec.*;
import com.amazonaws.services.dynamodbv2.model.*;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ErrorWithMessageException;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

@Slf4j
@Singleton
public class DynamoProjectStore implements ProjectStore {

    public interface Config {
        @DefaultValue("true")
        boolean enableSlugCacheRead();

        @DefaultValue("PT1H")
        Duration slugCacheExpireAfterWrite();

        /**
         * During slug migration, how long to keep the old slug before releasing.
         * If changed, update documentation including in api-project.yaml.
         */
        @DefaultValue("P1D")
        Duration slugExpireAfterMigration();

        @DefaultValue("true")
        boolean enableConfigCacheRead();

        @DefaultValue("PT1M")
        Duration configCacheExpireAfterWrite();
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
    private IndexSchema<SlugModel> slugByProjectSchema;
    private Cache<String, String> slugCache;
    private Cache<String, Optional<Project>> projectCache;

    @Inject
    private void setup() {
        slugCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.slugCacheExpireAfterWrite())
                .build();
        projectCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();

        projectSchema = dynamoMapper.parseTableSchema(ProjectModel.class);
        slugSchema = dynamoMapper.parseTableSchema(SlugModel.class);
        slugByProjectSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(2, SlugModel.class);
    }

    @Extern
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

    @Extern
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
        if (projectIds.isEmpty()) {
            return ImmutableSet.of();
        }
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
    public Project createProject(String accountId, String projectId, VersionedConfigAdmin versionedConfigAdmin) {
        SlugModel slugModel = new SlugModel(
                versionedConfigAdmin.getConfig().getSlug(),
                projectId,
                null);
        ProjectModel projectModel = new ProjectModel(
                accountId,
                projectId,
                versionedConfigAdmin.getVersion(),
                gson.toJson(versionedConfigAdmin.getConfig()));
        try {
            dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(ImmutableList.<TransactWriteItem>builder()
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(slugSchema.tableName())
                            .withItem(slugSchema.toAttrMap(slugModel))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", slugSchema.partitionKeyName()))))
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(projectSchema.tableName())
                            .withItem(projectSchema.toAttrMap(projectModel))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", projectSchema.partitionKeyName()))))
                    .build()));
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
        Project project = getProject(projectId, false).get();
        String slugPrevious = project.getVersionedConfigAdmin().getConfig().getSlug();
        String slug = versionedConfigAdmin.getConfig().getSlug();
        boolean updateSlug = !slug.equals(slugPrevious);
        if (updateSlug) {
            if (LogUtil.rateLimitAllowLog("projectStore-slugChange")) {
                log.info("Project {} changing slug from {} to {}", projectId, slugPrevious, slug);
            }
            try {
                slugSchema.table().putItem(new PutItemSpec()
                        .withItem(slugSchema.toItem(new SlugModel(slug, projectId, null)))
                        .withConditionExpression("attribute_not_exists(#partitionKey)")
                        .withNameMap(Map.of("#partitionKey", slugSchema.partitionKeyName())));
                slugCache.invalidate(slug);
            } catch (ConditionalCheckFailedException ex) {
                throw new ErrorWithMessageException(Response.Status.CONFLICT, "Slug is already taken, please choose another.", ex);
            }
        }
        PutItemSpec putItemSpec = new PutItemSpec()
                .withItem(projectSchema.toItem(new ProjectModel(
                        project.getAccountId(),
                        projectId,
                        versionedConfigAdmin.getVersion(),
                        gson.toJson(versionedConfigAdmin.getConfig()))));
        previousVersionOpt.ifPresent(previousVersion -> putItemSpec
                .withConditionExpression("version = :previousVersion")
                .withValueMap(Map.of(":previousVersion", previousVersion)));
        try {
            projectSchema.table().putItem(putItemSpec);
        } catch (ConditionalCheckFailedException ex) {
            // Undo creating slug just now
            slugSchema.table()
                    .deleteItem(new DeleteItemSpec()
                            .withConditionExpression("attribute_exists(#partitionKey) and #projectId = :projectId")
                            .withNameMap(Map.of(
                                    "#partitionKey", slugSchema.partitionKeyName(),
                                    "#projectId", "projectId"))
                            .withValueMap(Map.of(
                                    ":projectId", projectId))
                            .withPrimaryKey(slugSchema.primaryKey(ImmutableMap.of(
                                    "slug", slug))));
            slugCache.invalidate(slug);
            throw new ErrorWithMessageException(Response.Status.CONFLICT, "Project was modified by someone else while you were editing. Cannot merge changes.", ex);
        }
        if (updateSlug) {
            try {
                slugSchema.table()
                        .putItem(new PutItemSpec()
                                .withConditionExpression("attribute_exists(#partitionKey) and #projectId = :projectId")
                                .withNameMap(Map.of(
                                        "#partitionKey", slugSchema.partitionKeyName(),
                                        "#projectId", "projectId"))
                                .withValueMap(Map.of(
                                        ":projectId", projectId))
                                .withItem(slugSchema.toItem(new SlugModel(
                                        slugPrevious,
                                        projectId,
                                        Instant.now().plus(config.slugExpireAfterMigration()).getEpochSecond()))));
                slugCache.invalidate(slugPrevious);
            } catch (ConditionalCheckFailedException ex) {
                log.warn("Updating slug, but previous slug already doesn't exist?", ex);
            }
        }
        projectCache.invalidate(projectId);
    }

    @Extern
    @Override
    public void deleteProject(String projectId) {
        // Delete project
        projectSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(projectSchema.primaryKey(ImmutableMap.of(
                        "projectId", projectId))));
        projectCache.invalidate(projectId);

        // Delete Slug
        Iterables.partition(StreamSupport.stream(slugByProjectSchema.index().query(new QuerySpec()
                .withHashKey(slugByProjectSchema.partitionKey(Map.of(
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(slugByProjectSchema.rangeKeyName())
                        .beginsWith(slugByProjectSchema.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(slugByProjectSchema::fromItem)
                .filter(slug -> projectId.equals(slug.getProjectId()))
                .map(SlugModel::getSlug)
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(slugsBatch -> {
                    slugCache.invalidateAll(slugsBatch);
                    TableWriteItems tableWriteItems = new TableWriteItems(slugSchema.tableName());
                    slugsBatch.stream()
                            .map(slug -> slugSchema.primaryKey(Map.of(
                                    "slug", slug)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    dynamoDoc.batchWriteItem(tableWriteItems);
                });
    }

    @EqualsAndHashCode(of = {"accountId", "projectId", "version"})
    @ToString(of = {"accountId", "projectId", "version"})
    private class ProjectImpl implements Project {
        private static final double EXPRESSION_WEIGHT_DEFAULT = 1d;
        private final String accountId;
        private final String projectId;
        private final String version;
        private final VersionedConfig versionedConfig;
        private final VersionedConfigAdmin versionedConfigAdmin;
        private final ImmutableMap<String, ImmutableMap<String, Double>> categoryExpressionToWeight;
        private final ImmutableMap<String, Category> categories;

        private ProjectImpl(ProjectModel projectModel) {
            this.accountId = projectModel.getAccountId();
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
        public String getAccountId() {
            return accountId;
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
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
