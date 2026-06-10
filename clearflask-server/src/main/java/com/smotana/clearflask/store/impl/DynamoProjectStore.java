// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.*;
import com.amazonaws.services.dynamodbv2.document.spec.*;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.model.*;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Strings;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.*;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.*;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.WebhookListener.ResourceType;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.util.*;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.IndexSchema;
import io.dataspray.singletable.ShardPageResult;
import io.dataspray.singletable.SingleTable;
import io.dataspray.singletable.TableSchema;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_READ_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.util.ProjectUpgraderImpl.PROJECT_VERSION_LATEST;

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

        @DefaultValue("P30D")
        Duration invitationExpireAfterCreation();

        @DefaultValue("P1D")
        Duration invitationExpireAfterAccepted();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private SingleTable singleTable;
    @Inject
    private Gson gson;
    @Inject
    private Sanitizer sanitizer;
    @Inject
    private ProjectUtil projectUtil;
    @Inject
    private ConfigSchemaUpgrader configSchemaUpgrader;
    @Inject
    private ProjectUpgrader projectUpgrader;
    @Inject
    private IntercomUtil intercomUtil;

    private TableSchema<ProjectModel> projectSchema;
    private IndexSchema<ProjectModel> projectShardedSchema;
    private TableSchema<SlugModel> slugSchema;
    private IndexSchema<SlugModel> slugByProjectSchema;
    private TableSchema<InvitationModel> invitationSchema;
    private IndexSchema<InvitationModel> invitationByProjectSchema;
    private Cache<String, Optional<String>> slugCache;
    private Cache<String, Optional<Project>> projectCache;

    @Inject
    private void setup() {
        slugCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.slugCacheExpireAfterWrite())
                .build();
        projectCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();

        projectSchema = singleTable.parseTableSchema(ProjectModel.class);
        projectShardedSchema = singleTable.parseGlobalSecondaryIndexSchema(2, ProjectModel.class);
        slugSchema = singleTable.parseTableSchema(SlugModel.class);
        slugByProjectSchema = singleTable.parseGlobalSecondaryIndexSchema(2, SlugModel.class);
        invitationSchema = singleTable.parseTableSchema(InvitationModel.class);
        invitationByProjectSchema = singleTable.parseGlobalSecondaryIndexSchema(1, InvitationModel.class);
    }

    @Extern
    @Override
    public Optional<Project> getProjectBySlug(String slug, boolean useCache) {
        Optional<String> slugAltOpt = Optional.empty();
        if (slug.endsWith("." + configApp.domain())) {
            slugAltOpt = Optional.of(slug.substring(0, slug.indexOf('.')));
        }

        boolean isCached = false;
        boolean isAltCached = false;
        if (config.enableSlugCacheRead() && useCache) {
            Optional<String> projectIdOpt = slugCache.getIfPresent(slug);
            isCached = projectIdOpt != null;
            if (isCached) {
                if (projectIdOpt.isPresent()) {
                    // Main is present, return it
                    return getProject(projectIdOpt.get(), useCache);
                } else if (slugAltOpt.isEmpty()) {
                    // Main is empty and there is no alt so return empty
                    return Optional.empty();
                } else {
                    // Main is empty, but need to first check alt as well
                }
            }
            if (slugAltOpt.isPresent()) {
                Optional<String> projectIdAltOpt = slugCache.getIfPresent(slugAltOpt.get());
                isAltCached = projectIdAltOpt != null;
                if (isAltCached) {
                    if (projectIdAltOpt.isPresent()) {
                        // Alt is present, return it
                        return getProject(projectIdAltOpt.get(), useCache);
                    } else if (projectIdOpt != null && projectIdOpt.isEmpty()) {
                        // Only if both are cached and empty, return empty
                        return Optional.empty();
                    } else {
                        // Alt is empty, main one is not cached, continue
                    }
                }
            }
        }
        if (!isCached) {
            Optional<SlugModel> slugModelOpt = Optional.ofNullable(slugSchema.fromItem(slugSchema.table()
                    .getItem(new GetItemSpec().withPrimaryKey(slugSchema
                            .primaryKey(Map.of("slug", slug))))));
            slugCache.put(slug, slugModelOpt.map(SlugModel::getProjectId));
            if (slugModelOpt.isPresent()) {
                return slugModelOpt.flatMap(slugModel -> getProject(slugModel.getProjectId(), useCache));
            }
        }
        if (!isAltCached && slugAltOpt.isPresent()) {
            Optional<SlugModel> slugModelOpt = Optional.ofNullable(slugSchema.fromItem(slugSchema.table()
                    .getItem(new GetItemSpec().withPrimaryKey(slugSchema
                            .primaryKey(Map.of("slug", slugAltOpt.get()))))));
            slugCache.put(slugAltOpt.get(), slugModelOpt.map(SlugModel::getProjectId));
            if (slugModelOpt.isPresent()) {
                return slugModelOpt.flatMap(slugModel -> getProject(slugModel.getProjectId(), useCache));
            }
        }
        return Optional.empty();
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
                .map(this::getProjectWithUpgrade);
        projectCache.put(projectId, projectOpt);
        return projectOpt;
    }

    @Override
    public ImmutableSet<Project> getProjects(ImmutableSet<String> projectIds, boolean useCache) {
        if (projectIds.isEmpty()) {
            return ImmutableSet.of();
        }
        ImmutableSet<Project> projects = singleTable.retryUnprocessed(dynamoDoc.batchGetItem(new BatchGetItemSpec()
                        .withTableKeyAndAttributes(new TableKeysAndAttributes(projectSchema.tableName())
                                .withConsistentRead(!useCache)
                                .withPrimaryKeys(projectIds.stream()
                                        .map(projectId -> projectSchema.primaryKey(Map.of("projectId", projectId)))
                                        .toArray(PrimaryKey[]::new)))))
                .map(projectSchema::fromItem)
                .map(this::getProjectWithUpgrade)
                .collect(ImmutableSet.toImmutableSet());
        projects.forEach(project -> projectCache.put(project.getProjectId(), Optional.of(project)));
        return projects;
    }

    @Override
    public void listAllProjects(Consumer<Project> consumer) {
        Optional<String> cursorOpt = Optional.empty();
        do {
            ShardPageResult<ProjectModel> result = singleTable.fetchShardNextPage(
                    projectShardedSchema,
                    cursorOpt,
                    DYNAMO_READ_BATCH_MAX_SIZE);
            cursorOpt = result.getCursorOpt();
            result.getItems().stream()
                    .map(this::getProjectWithUpgrade)
                    .forEach(consumer);
        } while (cursorOpt.isPresent());
    }

    @Override
    public ListResponse listProjects(Optional<String> cursorOpt, int pageSize, boolean populateCache) {
        ShardPageResult<ProjectModel> shardPageResult = singleTable.fetchShardNextPage(
                projectShardedSchema,
                cursorOpt,
                pageSize);
        ImmutableList<Project> projects = shardPageResult.getItems().stream()
                .map(this::getProjectWithUpgrade)
                .collect(ImmutableList.toImmutableList());
        if (populateCache) {
            projectCache.putAll(projects.stream()
                    .collect(Collectors.toMap(Project::getProjectId, Optional::of)));
        }
        return new ListResponse(projects, shardPageResult.getCursorOpt());
    }

    @Override
    public SearchEngine getSearchEngine() {
        return configApp.forceSearchEngine()
                .orElseGet(configApp::defaultSearchEngine);
    }

    @Override
    public SearchEngine getSearchEngineForProject(String projectId) {
        return configApp.forceSearchEngine()
                .orElse(getProject(projectId, true)
                        .flatMap(Project::getSearchEngineOverride)
                        .orElseGet(configApp::defaultSearchEngine));
    }

    @Override
    public Project createProject(String accountId, String projectId, VersionedConfigAdmin versionedConfigAdmin) {
        String subdomain = versionedConfigAdmin.getConfig().getSlug();
        Optional<String> domainOpt = Optional.ofNullable(Strings.emptyToNull(versionedConfigAdmin.getConfig().getDomain()));
        ProjectModel projectModel = new ProjectModel(
                accountId,
                ImmutableSet.of(),
                projectId,
                versionedConfigAdmin.getVersion(),
                versionedConfigAdmin.getConfig().getSchemaVersion(),
                ImmutableSet.of(),
                gson.toJson(versionedConfigAdmin.getConfig()),
                PROJECT_VERSION_LATEST);
        try {
            ImmutableList.Builder<TransactWriteItem> transactionsBuilder = ImmutableList.<TransactWriteItem>builder()
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(slugSchema.tableName())
                            .withItem(slugSchema.toAttrMap(new SlugModel(
                                    subdomain,
                                    projectId,
                                    null)))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", slugSchema.partitionKeyName()))))
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(projectSchema.tableName())
                            .withItem(projectSchema.toAttrMap(projectModel))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", projectSchema.partitionKeyName()))));
            domainOpt.ifPresent(domain -> transactionsBuilder
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(slugSchema.tableName())
                            .withItem(slugSchema.toAttrMap(new SlugModel(
                                    domain,
                                    projectId,
                                    null)))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", slugSchema.partitionKeyName())))));
            dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(
                    transactionsBuilder.build()));
        } catch (TransactionCanceledException ex) {
            if (ex.getCancellationReasons().stream().map(CancellationReason::getCode).anyMatch("ConditionalCheckFailed"::equals)) {
                throw new ApiException(Response.Status.CONFLICT, "Project name, slug or domain already taken, please choose another.", ex);
            }
            throw ex;
        }
        ProjectImpl project = new ProjectImpl(projectModel);
        projectCache.put(projectId, Optional.of(project));
        slugCache.put(subdomain, Optional.of(projectId));
        domainOpt.ifPresent(domain -> slugCache.put(domain, Optional.of(projectId)));
        return project;
    }

    @Override
    public void updateConfig(String projectId, Optional<String> previousVersionOpt, VersionedConfigAdmin versionedConfigAdmin, boolean isSuperAdmin) {
        Project project = getProject(projectId, false).get();

        ImmutableMap.Builder<String, String> slugsToChangeBuilder = ImmutableMap.builder();

        Optional<String> domainPreviousOpt = Optional.ofNullable(Strings.emptyToNull(project.getVersionedConfigAdmin().getConfig().getDomain()));
        Optional<String> domainOpt = Optional.ofNullable(Strings.emptyToNull(versionedConfigAdmin.getConfig().getDomain()));
        if (!domainOpt.equals(domainPreviousOpt)) {
            domainOpt.ifPresent(domain -> sanitizer.domain(domain, isSuperAdmin));
            slugsToChangeBuilder.put(domainPreviousOpt.orElse(""), domainOpt.orElse(""));
        }

        String subdomainPrevious = project.getVersionedConfigAdmin().getConfig().getSlug();
        String subdomain = versionedConfigAdmin.getConfig().getSlug();
        if (!subdomain.equals(subdomainPrevious)) {
            sanitizer.subdomain(subdomain, isSuperAdmin);
            slugsToChangeBuilder.put(subdomainPrevious, subdomain);
        }

        ImmutableMap<String, String> slugsToChange = slugsToChangeBuilder.build();

        slugsToChange.forEach((slugFrom, slugTo) -> {
            if (LogUtil.rateLimitAllowLog("projectStore-slugChange")) {
                log.info("Project {} changing slug from '{}' to '{}'", projectId, slugFrom, slugTo);
            }
            if (Strings.isNullOrEmpty(slugTo)) {
                return;
            }
            try {
                slugSchema.table().putItem(new PutItemSpec()
                        .withItem(slugSchema.toItem(new SlugModel(slugTo, projectId, null)))
                        // Allow changing your mind and rollback slug if slug still exists part of migration
                        .withConditionExpression("attribute_not_exists(#partitionKey) OR (attribute_exists(#partitionKey) AND #projectId = :projectId)")
                        .withNameMap(Map.of(
                                "#partitionKey", slugSchema.partitionKeyName(),
                                "#projectId", "projectId"))
                        .withValueMap(Map.of(
                                ":projectId", projectId)));
                slugCache.invalidate(slugTo);
            } catch (ConditionalCheckFailedException ex) {
                throw new ApiException(Response.Status.CONFLICT, "Slug is already taken, please choose another.", ex);
            }
        });
        try {
            HashMap<String, String> nameMap = Maps.newHashMap();
            HashMap<String, Object> valMap = Maps.newHashMap();
            List<String> setUpdates = Lists.newArrayList();
            Optional<String> conditionExpressionOpt = Optional.empty();

            nameMap.put("#configJson", "configJson");
            valMap.put(":configJson", gson.toJson(versionedConfigAdmin.getConfig()));
            setUpdates.add("#configJson = :configJson");

            nameMap.put("#version", "version");
            valMap.put(":version", versionedConfigAdmin.getVersion());
            setUpdates.add("#version = :version");

            nameMap.put("#schemaVersion", "schemaVersion");
            valMap.put(":schemaVersion", versionedConfigAdmin.getConfig().getSchemaVersion());
            setUpdates.add("#schemaVersion = :schemaVersion");

            if (previousVersionOpt.isPresent()) {
                valMap.put(":previousVersion", previousVersionOpt.get());
                conditionExpressionOpt = Optional.of("#version = :previousVersion");
            }

            String updateExpression = "SET " + String.join(", ", setUpdates);
            log.trace("updateConfig with expression: {} {} {}", updateExpression, nameMap, valMap);

            projectSchema.table().updateItem(new UpdateItemSpec()
                    .withPrimaryKey(projectSchema.primaryKey(Map.of(
                            "projectId", projectId)))
                    .withNameMap(nameMap)
                    .withValueMap(valMap)
                    .withUpdateExpression(updateExpression)
                    .withConditionExpression(conditionExpressionOpt.orElse(null)));
        } catch (ConditionalCheckFailedException ex) {
            slugsToChange.forEach((slugFrom, slugTo) -> {
                if (Strings.isNullOrEmpty(slugTo)) {
                    return;
                }
                // Undo creating slug just now
                slugSchema.table()
                        .deleteItem(new DeleteItemSpec()
                                .withConditionExpression("attribute_exists(#partitionKey) AND #projectId = :projectId")
                                .withNameMap(Map.of(
                                        "#partitionKey", slugSchema.partitionKeyName(),
                                        "#projectId", "projectId"))
                                .withValueMap(Map.of(
                                        ":projectId", projectId))
                                .withPrimaryKey(slugSchema.primaryKey(ImmutableMap.of(
                                        "slug", slugTo))));
                slugCache.invalidate(slugTo);
            });
            throw new ApiException(Response.Status.CONFLICT, "Project was modified by someone else while you were editing. Cannot merge changes.", ex);
        }
        slugsToChange.forEach((slugFrom, slugTo) -> {
            if (Strings.isNullOrEmpty(slugFrom)) {
                return;
            }
            try {
                slugSchema.table()
                        .putItem(new PutItemSpec()
                                .withConditionExpression("attribute_exists(#partitionKey) AND #projectId = :projectId")
                                .withNameMap(Map.of(
                                        "#partitionKey", slugSchema.partitionKeyName(),
                                        "#projectId", "projectId"))
                                .withValueMap(Map.of(
                                        ":projectId", projectId))
                                .withItem(slugSchema.toItem(new SlugModel(
                                        slugFrom,
                                        projectId,
                                        Instant.now().plus(config.slugExpireAfterMigration()).getEpochSecond()))));
                slugCache.invalidate(slugFrom);
            } catch (ConditionalCheckFailedException ex) {
                log.warn("Updating slug, but previous slug '{}' already doesn't exist?, switching to '{}'", slugFrom, slugTo, ex);
            }
        });
        projectCache.invalidate(projectId);
    }

    @Override
    public void addWebhookListener(String projectId, WebhookListener listener) {
        updateWebhookListener(projectId, listener, true);
    }

    @Override
    public void removeWebhookListener(String projectId, WebhookListener listener) {
        updateWebhookListener(projectId, listener, false);
    }

    private void updateWebhookListener(String projectId, WebhookListener listener, boolean set) {
        projectSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(projectSchema.primaryKey(Map.of("projectId", projectId)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression((set ? "ADD" : "DELETE") + " #webhookListeners :webhookListener")
                .withNameMap(new NameMap()
                        .with("#webhookListeners", "webhookListeners")
                        .with("#partitionKey", projectSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withStringSet(":webhookListener", packWebhookListener(listener)))
                .withReturnValues(ReturnValue.ALL_NEW));
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
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(slugsBatch -> {
                    slugCache.invalidateAll(slugsBatch);
                    TableWriteItems tableWriteItems = new TableWriteItems(slugSchema.tableName());
                    slugsBatch.stream()
                            .map(slugModel -> slugSchema.primaryKey(Map.of(
                                    "slug", slugModel.getSlug())))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
    }

    @Override
    public InvitationModel createInvitation(String projectId, String invitedEmail, String inviteeName) {
        Project project = getProject(projectId, true).orElseThrow();
        InvitationModel invitation = new InvitationModel(
                genInvitationId(),
                projectId,
                invitedEmail,
                inviteeName,
                projectUtil.getProjectName(project.getVersionedConfigAdmin().getConfig()),
                null,
                Instant.now().plus(config.invitationExpireAfterCreation()).getEpochSecond());
        try {
            invitationSchema.table().putItem(new PutItemSpec()
                    .withItem(invitationSchema.toItem(invitation))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(new NameMap().with("#partitionKey", invitationSchema.partitionKeyName())));
        } catch (ConditionalCheckFailedException ex) {
            throw new ApiException(Response.Status.CONFLICT, "Invitation already exists for this email", ex);
        }
        return invitation;
    }

    @Override
    public Optional<InvitationModel> getInvitation(String invitationId) {
        return Optional.ofNullable(invitationSchema
                        .fromItem(invitationSchema
                                .table().getItem(invitationSchema
                                        .primaryKey(Map.of(
                                                "invitationId", invitationId)))))
                .filter(invitation -> {
                    if (invitation.getTtlInEpochSec() < Instant.now().getEpochSecond()) {
                        log.debug("DynamoDB has an expired invitation with expiry {}", invitation.getTtlInEpochSec());
                        return false;
                    }
                    return true;
                });
    }

    @Override
    public ImmutableList<InvitationModel> getInvitations(String projectId) {
        return StreamSupport.stream(invitationByProjectSchema.index().query(new QuerySpec()
                                .withHashKey(invitationByProjectSchema.partitionKey(Map.of(
                                        "projectId", projectId)))
                                .withRangeKeyCondition(new RangeKeyCondition(invitationByProjectSchema.rangeKeyName())
                                        .beginsWith(invitationByProjectSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(invitationByProjectSchema::fromItem)
                .filter(invitation -> {
                    if (invitation.getTtlInEpochSec() < Instant.now().getEpochSecond()) {
                        log.debug("DynamoDB has an expired invitation with expiry {}", invitation.getTtlInEpochSec());
                        return false;
                    }
                    return true;
                })
                .collect(ImmutableList.toImmutableList());
    }

    @Override
    public String acceptInvitation(String invitationId, String accepteeAccountId) {
        InvitationModel invitation = getInvitation(invitationId)
                .filter(Predicate.not(InvitationModel::isAccepted))
                .orElseThrow(() -> new ApiException(Response.Status.NOT_FOUND, "Invitation expired"));
        dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(ImmutableList.<TransactWriteItem>builder()
                .add(new TransactWriteItem().withUpdate(new Update()
                        .withTableName(projectSchema.tableName())
                        .withKey(ItemUtils.toAttributeValueMap(projectSchema.primaryKey(Map.of(
                                "projectId", invitation.getProjectId()))))
                        .withConditionExpression("attribute_exists(#partitionKey) AND #accountId <> :adminAccountId")
                        .withUpdateExpression("ADD #adminsAccountIds :adminAccountId")
                        .withExpressionAttributeNames(Map.of(
                                "#partitionKey", projectSchema.partitionKeyName(),
                                "#accountId", "accountId",
                                "#adminsAccountIds", "adminsAccountIds"))
                        .withExpressionAttributeValues(Map.of(
                                ":adminAccountId", projectSchema.toAttrValue("adminsAccountIds", ImmutableSet.of(accepteeAccountId))))))
                .add(new TransactWriteItem().withUpdate(new Update()
                        .withTableName(invitationSchema.tableName())
                        .withKey(ItemUtils.toAttributeValueMap(invitationSchema.primaryKey(Map.of(
                                "invitationId", invitationId))))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("SET #isAcceptedByAccountId = :isAcceptedByAccountId, #ttlInEpochSec = :ttlInEpochSec")
                        .withExpressionAttributeNames(Map.of(
                                "#partitionKey", invitationSchema.partitionKeyName(),
                                "#isAcceptedByAccountId", "isAcceptedByAccountId",
                                "#ttlInEpochSec", "ttlInEpochSec"))
                        .withExpressionAttributeValues(Map.of(
                                ":isAcceptedByAccountId", invitationSchema.toAttrValue("isAcceptedByAccountId", accepteeAccountId),
                                ":ttlInEpochSec", invitationSchema.toAttrValue("ttlInEpochSec",
                                        Instant.now().plus(config.invitationExpireAfterAccepted()).getEpochSecond())))))
                .build()));
        projectCache.invalidate(invitation.getProjectId());
        return invitation.getProjectId();
    }

    @Override
    public void revokeInvitation(String projectId, String invitationId) {
        invitationSchema.table().deleteItem(new DeleteItemSpec()
                .withConditionExpression("attribute_exists(#partitionKey) AND #projectId = :projectId")
                .withNameMap(Map.of(
                        "#partitionKey", invitationSchema.partitionKeyName(),
                        "#projectId", "projectId"))
                .withValueMap(Map.of(":projectId", projectId))
                .withPrimaryKey(invitationSchema.primaryKey(Map.of("invitationId", invitationId))));
    }

    @Override
    public Project addAdmin(String projectId, String adminAccountId) {
        Project project = new ProjectImpl(projectSchema.fromItem(projectSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(projectSchema.primaryKey(Map.of("projectId", projectId)))
                        .withConditionExpression("attribute_exists(#partitionKey) AND #accountId <> :adminAccountId")
                        .withUpdateExpression("ADD #adminsAccountIds :adminAccountId")
                        .withNameMap(Map.of(
                                "#partitionKey", projectSchema.partitionKeyName(),
                                "#accountId", "accountId",
                                "#adminsAccountIds", "adminsAccountIds"))
                        .withValueMap(Map.of(
                                ":adminAccountId", projectSchema.toDynamoValue("adminsAccountIds", ImmutableSet.of(adminAccountId))))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem()));
        projectCache.put(projectId, Optional.of(project));
        return project;
    }

    @Override
    public Project removeAdmin(String projectId, String adminAccountId) {
        Project project = new ProjectImpl(projectSchema.fromItem(projectSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(projectSchema.primaryKey(Map.of("projectId", projectId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("DELETE #adminsAccountIds :adminAccountId")
                        .withNameMap(Map.of(
                                "#partitionKey", projectSchema.partitionKeyName(),
                                "#adminsAccountIds", "adminsAccountIds"))
                        .withValueMap(Map.of(
                                ":adminAccountId", projectSchema.toDynamoValue("adminsAccountIds", ImmutableSet.of(adminAccountId))))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem()));
        projectCache.put(projectId, Optional.of(project));
        return project;
    }

    @Override
    public Project changeOwner(String projectId, String newOwnerAccountId) {
        Project project = new ProjectImpl(projectSchema.fromItem(projectSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(projectSchema.primaryKey(Map.of("projectId", projectId)))
                        .withConditionExpression("attribute_exists(#partitionKey) AND #accountId <> :newOwnerAccountId")
                        .withUpdateExpression("SET #accountId = :newOwnerAccountId")
                        .withNameMap(Map.of(
                                "#partitionKey", projectSchema.partitionKeyName(),
                                "#accountId", "accountId"))
                        .withValueMap(Map.of(
                                ":newOwnerAccountId", projectSchema.toDynamoValue("accountId", newOwnerAccountId)))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem()));
        projectCache.put(projectId, Optional.of(project));
        return project;
    }

    private String packWebhookListener(WebhookListener listener) {
        return StringSerdeUtil.mergeStrings(listener.getResourceType().name(), listener.getEventType(), listener.getUrl());
    }

    private Optional<WebhookListener> unpackWebhookListener(String listenerStr) {
        String[] listenerParts = StringSerdeUtil.unMergeString(listenerStr);
        if (listenerParts.length != 3) {
            return Optional.empty();
        }
        return Optional.of(new WebhookListener(
                ResourceType.valueOf(listenerParts[0]),
                listenerParts[1],
                listenerParts[2]));
    }

    private Project getProjectWithUpgrade(ProjectModel projectModel) {
        // Upgrade config schema if necessary
        Optional<String> configUpgradedOpt = configSchemaUpgrader.upgrade(projectModel.getConfigJson());
        if (configUpgradedOpt.isPresent()) {
            projectModel = projectModel.toBuilder()
                    .configJson(configUpgradedOpt.get())
                    .build();
            try {
                projectSchema.table().putItem(new PutItemSpec()
                        .withItem(projectSchema.toItem(projectModel))
                        .withConditionExpression("#version = :version")
                        .withNameMap(Map.of("#version", "version"))
                        .withValueMap(Map.of(":version", projectModel.getVersion())));
            } catch (ConditionalCheckFailedException ex) {
                log.warn("Writing upgraded project failed, will let someone else upgrade it later", ex);
            }
            projectCache.invalidate(projectModel.getProjectId());
        }

        // Upgrade project if necessary
        Optional<Long> projectVersionUpgradedOpt = projectUpgrader.upgrade(projectModel);
        if (projectVersionUpgradedOpt.isPresent()) {
            projectModel = projectModel.toBuilder()
                    .projectVersion(projectVersionUpgradedOpt.get())
                    .build();
            projectSchema.table().updateItem(new UpdateItemSpec()
                    .withPrimaryKey(projectSchema.primaryKey(Map.of(
                            "projectId", projectModel.getProjectId())))
                    .withNameMap(Map.of("#projectVersion", "projectVersion"))
                    .withValueMap(Map.of(":projectVersion", projectModel.getProjectVersion()))
                    .withUpdateExpression("SET #projectVersion = :projectVersion"));
        }

        return new ProjectImpl(projectModel);
    }

    @EqualsAndHashCode(of = {"accountId", "projectId", "version"})
    @ToString(of = {"accountId", "projectId", "version"})
    private class ProjectImpl implements Project {
        private static final double EXPRESSION_WEIGHT_DEFAULT = 1d;
        private final ProjectModel model;
        private final String accountId;
        private final String projectId;
        private final String version;
        private final VersionedConfig versionedConfig;
        private final VersionedConfigAdmin versionedConfigAdmin;
        private final ImmutableMap<String, ImmutableMap<String, Double>> categoryExpressionToWeight;
        private final ImmutableMap<String, Category> categories;
        private final ImmutableMap<String, IdeaStatus> statuses;
        private final Function<String, String> intercomEmailToIdentityFun;
        private final ImmutableMap<String, ImmutableSet<WebhookListener>> webhookEventToListeners;

        private ProjectImpl(ProjectModel projectModel) {
            this.model = projectModel;
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
                                            Expression::getWeight))));
            this.categories = this.versionedConfig.getConfig().getContent().getCategories().stream()
                    .collect(ImmutableMap.toImmutableMap(
                            Category::getCategoryId,
                            c -> c));

            ImmutableMap.Builder<String, IdeaStatus> statusesBuilder = ImmutableMap.builder();
            this.versionedConfig.getConfig().getContent().getCategories().forEach(category ->
                    category.getWorkflow().getStatuses().forEach(status ->
                            statusesBuilder.put(
                                    getStatusLookupKey(
                                            category.getCategoryId(),
                                            status.getStatusId()),
                                    status)));
            this.statuses = statusesBuilder.build();
            this.intercomEmailToIdentityFun = Optional.ofNullable(Strings.emptyToNull(this.versionedConfigAdmin.getConfig().getIntercomIdentityVerificationSecret()))
                    .map(intercomUtil::getEmailToIdentityFun)
                    .orElse((email) -> null);
            this.webhookEventToListeners = projectModel.getWebhookListeners() == null
                    ? ImmutableMap.of()
                    : ImmutableMap.copyOf(projectModel.getWebhookListeners().stream()
                    .map(DynamoProjectStore.this::unpackWebhookListener)
                    .flatMap(Optional::stream)
                    .collect(Collectors.groupingBy(
                            l -> webhookListenerSearchKey(l.getResourceType(), l.getEventType()),
                            Collectors.mapping(l -> l, ImmutableSet.toImmutableSet()))));
        }

        @Override
        public String getName() {
            return projectUtil.getProjectName(versionedConfigAdmin.getConfig());
        }

        @Override
        public String getLink() {
            return "https://" + getHostname();
        }

        @Override
        public ProjectModel getModel() {
            return model;
        }

        @Override
        public String getAccountId() {
            return accountId;
        }

        @Override
        public boolean isAdmin(String accountId) {
            return model.getAccountId().equals(accountId)
                    || model.getAdminsAccountIds().contains(accountId);
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
        public ImmutableCollection<Category> getCategories() {
            return categories.values();
        }

        @Override
        public Optional<Category> getCategory(String categoryId) {
            return Optional.ofNullable(categories.get(categoryId));
        }

        @Override
        public Optional<IdeaStatus> getStatus(String categoryId, String statusId) {
            return Optional.ofNullable(this.statuses.get(getStatusLookupKey(categoryId, statusId)));
        }

        @Override
        public ImmutableSet<String> getHiddenStatusIds() {
            return this.versionedConfig.getConfig().getContent().getCategories().stream()
                    .flatMap(category -> category.getWorkflow().getStatuses().stream())
                    .filter(status -> status.getDisablePublicDisplay() == Boolean.TRUE)
                    .map(IdeaStatus::getStatusId)
                    .collect(ImmutableSet.toImmutableSet());
        }

        @Override
        public boolean isVotingAllowed(VoteValue voteValue, String categoryId, Optional<String> statusIdOpt) {
            Optional<Voting> votingOpt = Optional.ofNullable(getCategory(categoryId)
                    .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find category"))
                    .getSupport()
                    .getVote());
            if (!votingOpt.isPresent()) {
                return false;
            } else if (voteValue == VoteValue.Downvote && votingOpt.get().getEnableDownvotes() != Boolean.TRUE) {
                return false;
            }

            if (statusIdOpt.isPresent()) {
                IdeaStatus status = getStatus(categoryId, statusIdOpt.get())
                        .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find status"));
                if (status.getDisableVoting() == Boolean.TRUE) {
                    return false;
                }
            }

            return true;
        }

        @Override
        public boolean isExpressingAllowed(String categoryId, Optional<String> statusIdOpt) {
            Optional<Expressing> expressOpt = Optional.ofNullable(getCategory(categoryId)
                    .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find category"))
                    .getSupport()
                    .getExpress());
            if (!expressOpt.isPresent()) {
                return false;
            }

            if (statusIdOpt.isPresent()) {
                IdeaStatus status = getStatus(categoryId, statusIdOpt.get())
                        .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find status"));
                if (status.getDisableExpressions() == Boolean.TRUE) {
                    return false;
                }
            }

            return true;
        }

        @Override
        public boolean isFundingAllowed(String categoryId, Optional<String> statusIdOpt) {
            boolean fundAllowed = getCategory(categoryId)
                    .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find category"))
                    .getSupport()
                    .getFund();
            if (!fundAllowed) {
                return false;
            }

            if (statusIdOpt.isPresent()) {
                IdeaStatus status = getStatus(categoryId, statusIdOpt.get())
                        .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find status"));
                if (status.getDisableFunding() == Boolean.TRUE) {
                    return false;
                }
            }

            return true;
        }

        @Override
        public void areTagsAllowedByUser(List<String> tagIds, String categoryId) throws ApiException {
            if (tagIds == null || tagIds.isEmpty()) {
                return;
            }
            Optional<Category> categoryOpt = getCategory(categoryId);
            if (!categoryOpt.isPresent()) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot find this category");
            }
            categoryOpt.stream()
                    .map(Category::getTagging)
                    .flatMap(tagging -> tagging.getTagGroups().stream())
                    .forEach(group -> {
                        if (group.getMaxRequired() == null && group.getMinRequired() == null && group.getUserSettable()) {
                            return;
                        }
                        long tagsInGroupCount = tagIds.stream()
                                .filter(tagId -> group.getTagIds().contains(tagId))
                                .count();
                        if (!group.getUserSettable() && tagsInGroupCount > 0L) {
                            throw new ApiException(Response.Status.BAD_REQUEST, "Tags for " + group.getName() + " are not allowed");
                        }
                        if (group.getMaxRequired() != null && group.getMaxRequired() < tagsInGroupCount) {
                            throw new ApiException(Response.Status.BAD_REQUEST, "Maximum tags for " + group.getName() + " is " + group.getMaxRequired());
                        }
                        if (group.getMinRequired() != null && group.getMinRequired() > tagsInGroupCount) {
                            throw new ApiException(Response.Status.BAD_REQUEST, "Minimum tags for " + group.getName() + " is " + group.getMinRequired());
                        }
                    });

        }

        @Override
        public Function<String, String> getIntercomEmailToIdentityFun() {
            return intercomEmailToIdentityFun;
        }

        @Override
        public ImmutableSet<WebhookListener> getWebhookListenerUrls(ResourceType resourceType, String event) {
            return webhookEventToListeners.getOrDefault(webhookListenerSearchKey(resourceType, event), ImmutableSet.of());
        }

        @Override
        public ImmutableSet<WebhookListener> getAllWebhookListeners() {
            return webhookEventToListeners.values().stream()
                    .flatMap(ImmutableSet::stream)
                    .collect(ImmutableSet.toImmutableSet());
        }

        @Override
        public String getHostnameFromSubdomain() {
            return versionedConfigAdmin.getConfig().getSlug() + "." + configApp.domain();
        }

        @Override
        public Optional<String> getHostnameFromDomain() {
            return Optional.ofNullable(Strings.emptyToNull(versionedConfigAdmin.getConfig().getDomain()));
        }

        private String webhookListenerSearchKey(ResourceType resourceType, String event) {
            return resourceType.name() + event;
        }

        @Override
        public String getHostname() {
            return Project.getHostname(versionedConfigAdmin.getConfig(), configApp);
        }

        @Override
        public Optional<GitHub> getGitHubIntegration() {
            return Optional.ofNullable(versionedConfigAdmin.getConfig().getGithub());
        }

        @Override
        public Optional<GitLab> getGitLabIntegration() {
            return Optional.ofNullable(versionedConfigAdmin.getConfig().getGitlab());
        }

        @Override
        public Optional<SearchEngine> getSearchEngineOverride() {
            return Optional.ofNullable(getVersionedConfigAdmin().getConfig().getForceSearchEngine())
                    .flatMap(forceSearchEngine -> {
                        switch (forceSearchEngine) {
                            case ELASTICSEARCH:
                                return Optional.of(SearchEngine.READWRITE_ELASTICSEARCH);
                            case MYSQL:
                                return Optional.of(SearchEngine.READWRITE_MYSQL);
                            case ELASTICSEARCHWRITEBOTH:
                                return Optional.of(SearchEngine.READ_ELASTICSEARCH_WRITE_BOTH);
                            case MYSQLWRITEBOTH:
                                return Optional.of(SearchEngine.READ_MYSQL_WRITE_BOTH);
                            default:
                                if (LogUtil.rateLimitAllowLog("dynamo-project-store-invalid-searchEngineOverride")) {
                                    log.warn("Invalid value for forceSearchEngine '{}' for project {}",
                                            forceSearchEngine, getProjectId());
                                }
                                return Optional.empty();
                        }
                    });
        }

        private String getStatusLookupKey(String categoryId, String statusId) {
            return categoryId + ":" + statusId;
        }
    }

    /**
     * One time operation to add AccountEmail's GSI 2 keys
     */
    @Extern
    @VisibleForTesting
    public long upgradeAddGsi2ToAProjectSchema() {
        Map<String, AttributeValue> exclusiveStartKey = null;
        long migrated = 0;
        do {
            ScanResult result = dynamo.scan(new ScanRequest()
                    .withLimit(DYNAMO_WRITE_BATCH_MAX_SIZE)
                    .withFilterExpression("#primaryRangeKeyName = :primaryRangeValue AND attribute_not_exists(#gsiRangeKeyName)")
                    .withExpressionAttributeNames(Map.of(
                            "#primaryRangeKeyName", projectSchema.rangeKeyName(),
                            "#gsiRangeKeyName", projectShardedSchema.rangeKeyName()))
                    .withExpressionAttributeValues(Map.of(
                            ":primaryRangeValue", new AttributeValue(projectSchema.rangeKey(Map.of()).getValue().toString())))
                    .withTableName(projectSchema.tableName())
                    .withExclusiveStartKey(exclusiveStartKey));
            exclusiveStartKey = result.getLastEvaluatedKey();
            if (!result.getItems().isEmpty()) {
                migrated += result.getItems().size();
                singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(projectSchema.tableName())
                        .withItemsToPut(result.getItems().stream()
                                .map(projectSchema::fromAttrMap)
                                .map(projectSchema::toItem)
                                .collect(ImmutableList.toImmutableList()))));
            }
        } while (exclusiveStartKey != null && !exclusiveStartKey.isEmpty());
        return migrated;
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
