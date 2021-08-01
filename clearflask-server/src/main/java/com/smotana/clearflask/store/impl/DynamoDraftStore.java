// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.KeyAttribute;
import com.amazonaws.services.dynamodbv2.document.Page;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.QueryOutcome;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.name.Named;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.IdeaCreateAdmin;
import com.smotana.clearflask.api.model.IdeaDraftSearch;
import com.smotana.clearflask.store.DraftStore;
import com.smotana.clearflask.store.dynamo.DynamoUtil;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.ServerSecret;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

@Slf4j
@Singleton
public class DynamoDraftStore implements DraftStore {

    public interface Config {
        @DefaultValue("P90D")
        Duration draftExpiry();
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
    @Named("cursor")
    private ServerSecret serverSecretCursor;

    private TableSchema<DraftModel> draftSchema;
    private IndexSchema<DraftModel> draftByProjectIdSchema;

    @Inject
    private void setup() {
        draftSchema = dynamoMapper.parseTableSchema(DraftModel.class);
        draftByProjectIdSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(2, DraftModel.class);
    }

    @Override
    public DraftModel setDraft(String projectId, String userId, Optional<String> draftIdOpt, IdeaCreateAdmin ideaCreateAdmin) {
        DraftModel draftModel = new DraftModel(
                projectId,
                draftIdOpt.orElseGet(this::genDraftId),
                userId,
                Instant.now().plus(config.draftExpiry()).getEpochSecond(),
                Instant.now(),
                ideaCreateAdmin.getAuthorUserId(),
                ideaCreateAdmin.getCategoryId(),
                ideaCreateAdmin.getTitle(),
                ideaCreateAdmin.getDescription(),
                ImmutableSet.copyOf(ideaCreateAdmin.getTagIds()),
                ideaCreateAdmin.getResponse(),
                ideaCreateAdmin.getStatusId(),
                ideaCreateAdmin.getFundGoal(),
                ideaCreateAdmin.getNotifySubscribers(),
                ImmutableSet.copyOf(ideaCreateAdmin.getLinkedFromPostIds()));
        setDraft(draftModel, Optional.empty());
        return draftModel;
    }

    @Override
    public void setDraft(DraftModel draft, Optional<Boolean> assertAttributeExistsOpt) {
        PutItemSpec putItemSpec = new PutItemSpec()
                .withItem(draftSchema.toItem(draft));
        assertAttributeExistsOpt.ifPresent(assertAttributeExists -> putItemSpec
                .withConditionExpression((assertAttributeExists ? "attribute_exists" : "attribute_not_exists") + "(#partitionKey)")
                .withNameMap(Map.of("#partitionKey", draftSchema.partitionKeyName())));
        try {
            draftSchema.table().putItem(putItemSpec);
        } catch (
                ConditionalCheckFailedException ex) {
            if (!assertAttributeExistsOpt.isPresent()) {
                throw ex;
            }
            throw new ApiException(Response.Status.CONFLICT,
                    assertAttributeExistsOpt.get() ? "Cannot overwrite existing draft."
                            : "Draft does not exist.", ex);
        }
    }

    @Override
    public Optional<DraftModel> getDraft(String projectId, String userId, String draftId) {
        return Optional.ofNullable(draftSchema.fromItem(draftSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(draftSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "userId", userId,
                        "draftId", draftId))))));
    }

    @Override
    public SearchResponse searchDrafts(String projectId, String userId, IdeaDraftSearch draftSearch, Optional<String> cursorOpt) {
        Optional<Set<String>> filterCategoryIdsOpt = (draftSearch.getFilterCategoryIds() == null || draftSearch.getFilterCategoryIds().isEmpty())
                ? Optional.empty() : Optional.of(ImmutableSet.copyOf(draftSearch.getFilterCategoryIds()));
        Page<Item, QueryOutcome> page = draftSchema.table().query(new QuerySpec()
                .withHashKey(draftSchema.partitionKey(Map.of(
                        "userId", userId,
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(draftSchema.rangeKeyName())
                        .beginsWith(draftSchema.rangeValuePartial(Map.of())))
                .withScanIndexForward(false) // last created first
                .withExclusiveStartKey(cursorOpt
                        .map(serverSecretCursor::decryptString)
                        .map(lastEvaluatedKey -> new PrimaryKey(
                                draftSchema.partitionKey(Map.of(
                                        "userId", userId,
                                        "projectId", projectId)),
                                new KeyAttribute(draftSchema.rangeKeyName(), lastEvaluatedKey)))
                        .orElse(null)))
                .firstPage();
        ImmutableList<DraftModel> drafts = page
                .getLowLevelResult()
                .getItems()
                .stream()
                .map(item -> draftSchema.fromItem(item))
                .filter(draft -> !filterCategoryIdsOpt.isPresent() || filterCategoryIdsOpt.get().contains(draft.getCategoryId()))
                .collect(ImmutableList.toImmutableList());
        Optional<String> newCursorOpt = Optional.ofNullable(page
                .getLowLevelResult()
                .getQueryResult()
                .getLastEvaluatedKey())
                .map(m -> m.get(draftSchema.rangeKeyName()))
                .map(AttributeValue::getS)
                .map(serverSecretCursor::encryptString);
        return new SearchResponse(drafts, newCursorOpt);
    }

    @Override
    public void deleteDraft(String projectId, String userId, String draftId) {
        draftSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(draftSchema.primaryKey(Map.of(
                        "projectId", projectId,
                        "draftId", draftId,
                        "userId", userId))));
    }

    @Extern
    @Override
    public void deleteAllForProject(String projectId) {
        // Delete drafts
        Iterables.partition(StreamSupport.stream(draftByProjectIdSchema.index().query(new QuerySpec()
                .withHashKey(draftByProjectIdSchema.partitionKey(Map.of(
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(draftByProjectIdSchema.rangeKeyName())
                        .beginsWith(draftByProjectIdSchema.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(draftByProjectIdSchema::fromItem)
                .filter(draft -> projectId.equals(draft.getProjectId()))
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(draftsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(draftSchema.tableName());
                    draftsBatch.stream()
                            .map(draft -> draftSchema.primaryKey(Map.of(
                                    "draftId", draft.getDraftId(),
                                    "userId", draft.getUserId(),
                                    "projectId", projectId)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(DraftStore.class).to(DynamoDraftStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
