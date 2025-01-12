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
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;
import com.google.gson.Gson;
import com.google.inject.Module;
import com.google.inject.*;
import com.google.inject.multibindings.Multibinder;
import com.google.inject.name.Named;
import com.google.inject.name.Names;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.AccountSearchSuperAdmin;
import com.smotana.clearflask.api.model.SubscriptionStatus;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.store.AccountStore;
import com.smotana.clearflask.store.IdeaStore;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.SearchEngine;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.elastic.ActionListeners;
import com.smotana.clearflask.store.elastic.ElasticUtil;
import com.smotana.clearflask.store.mysql.CompletionStageUtil;
import com.smotana.clearflask.store.mysql.DefaultMysqlProvider;
import com.smotana.clearflask.store.mysql.MoreSQLDataType;
import com.smotana.clearflask.store.mysql.MysqlUtil;
import com.smotana.clearflask.store.mysql.model.tables.JooqAccount;
import com.smotana.clearflask.store.mysql.model.tables.records.JooqAccountRecord;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import io.dataspray.singletable.*;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.ElasticsearchStatusException;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.delete.DeleteRequest;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.support.WriteRequest;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.GetIndexRequest;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.ZeroTermsQueryOption;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.jooq.DSLContext;
import org.jooq.Query;
import org.jooq.impl.SQLDataType;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_READ_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;
import static com.smotana.clearflask.store.mysql.DefaultMysqlProvider.ID_MAX_LENGTH;
import static com.smotana.clearflask.util.ExplicitNull.orNull;


@Slf4j
@Singleton
public class DynamoElasticAccountStore extends ManagedService implements AccountStore {

    private static final String ACCOUNT_INDEX = "account";

    public interface Config {
        /**
         * Intended for tests. Force immediate index refresh after write request.
         */
        @DefaultValue("false")
        boolean elasticForceRefresh();

        @DefaultValue("true")
        boolean enableConfigCacheRead();

        @DefaultValue("PT1M")
        Duration configCacheExpireAfterWrite();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    @Named("account")
    private ElasticUtil.ConfigSearch configSearch;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private SingleTable singleTable;
    @Inject
    private Gson gson;
    @Inject
    private ElasticUtil elasticUtil;
    @Inject
    private Provider<RestHighLevelClient> elastic;
    @Inject
    private Provider<DSLContext> mysql;
    @Inject
    private MysqlUtil mysqlUtil;
    @Inject
    private UserStore userStore;
    @Inject
    private IdeaStore ideaStore;
    @Inject
    private ProjectStore projectStore;

    private TableSchema<Account> accountSchema;
    private IndexSchema<Account> accountByApiKeySchema;
    private IndexSchema<Account> accountByOauthGuidSchema;
    private TableSchema<AccountEmail> accountIdByEmailSchema;
    private IndexSchema<AccountEmail> accountIdShardedSchema;
    private TableSchema<AccountSession> sessionBySessionIdSchema;
    private IndexSchema<AccountSession> sessionByAccountIdSchema;
    private Cache<String, Optional<Account>> accountCache;

    @Override
    protected ImmutableSet<Class> serviceDependencies() {
        return ImmutableSet.of(DefaultMysqlProvider.class);
    }

    @Override
    protected void serviceStart() throws Exception {
        accountCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();

        accountSchema = singleTable.parseTableSchema(Account.class);
        accountByApiKeySchema = singleTable.parseGlobalSecondaryIndexSchema(1, Account.class);
        accountByOauthGuidSchema = singleTable.parseGlobalSecondaryIndexSchema(2, Account.class);
        accountIdByEmailSchema = singleTable.parseTableSchema(AccountEmail.class);
        accountIdShardedSchema = singleTable.parseGlobalSecondaryIndexSchema(2, AccountEmail.class);
        sessionBySessionIdSchema = singleTable.parseTableSchema(AccountSession.class);
        sessionByAccountIdSchema = singleTable.parseGlobalSecondaryIndexSchema(1, AccountSession.class);

        if (configApp.createIndexesOnStartup()) {
            SearchEngine searchEngine = configApp.defaultSearchEngine();
            if (searchEngine.isWriteElastic()) {
                createIndexElasticSearch().get();
            }
            if (searchEngine.isWriteMysql()) {
                createIndexMysql();
            }
        }
    }

    @Extern
    public ListenableFuture<Void> createIndexElasticSearch() throws IOException {
        boolean exists = elastic.get().indices().exists(new GetIndexRequest(ACCOUNT_INDEX), RequestOptions.DEFAULT);
        if (!exists) {
            log.info("Creating ElasticSearch index {}", ACCOUNT_INDEX);
            try {
                SettableFuture<Void> indexingFuture = SettableFuture.create();
                elastic.get().indices().createAsync(new CreateIndexRequest(ACCOUNT_INDEX).mapping(gson.toJson(ImmutableMap.of(
                                "dynamic", "false",
                                "properties", ImmutableMap.builder()
                                        .put("name", ImmutableMap.of(
                                                "type", "text",
                                                "index_prefixes", ImmutableMap.of()))
                                        .put("email", ImmutableMap.of(
                                                "type", "text",
                                                "index_prefixes", ImmutableMap.of()))
                                        .put("status", ImmutableMap.of(
                                                "type", "keyword"))
                                        .put("planid", ImmutableMap.of(
                                                "type", "keyword"))
                                        .put("created", ImmutableMap.of(
                                                "type", "date",
                                                "format", "epoch_second"))
                                        .put("projectIds", ImmutableMap.of(
                                                "type", "keyword"))
                                        .build())), XContentType.JSON),
                        RequestOptions.DEFAULT,
                        ActionListeners.fromFuture(indexingFuture, elasticUtil::isIndexAlreadyExistsException));
                return indexingFuture;
            } catch (ElasticsearchStatusException ex) {
                if (!"resource_already_exists_exception".equals(ex.getResourceType())) {
                    throw ex;
                }
            }
        }
        return Futures.immediateFuture(null);
    }

    @Extern
    public void createIndexMysql() throws IOException {
        log.info("Creating Mysql table {}", ACCOUNT_INDEX);
        mysql.get().createTableIfNotExists(ACCOUNT_INDEX)
                .column("accountId", SQLDataType.VARCHAR(ID_MAX_LENGTH).notNull())
                .column("name", SQLDataType.VARCHAR(Math.max(255, (int) Sanitizer.NAME_MAX_LENGTH)).notNull())
                .column("email", SQLDataType.VARCHAR(255).notNull())
                .column("status", SQLDataType.VARCHAR(255).notNull())
                .column("planid", SQLDataType.VARCHAR(255).notNull())
                .column("created", MoreSQLDataType.DATETIME(6).notNull())
                .primaryKey("accountId")
                .execute();
    }

    @Override
    public AccountAndIndexingFuture createAccount(Account account) {
        try {
            accountIdByEmailSchema.table().putItem(new PutItemSpec()
                    .withItem(accountIdByEmailSchema.toItem(new AccountEmail(
                            account.getEmail(),
                            account.getAccountId())))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(new NameMap().with("#partitionKey", accountIdByEmailSchema.partitionKeyName())));
        } catch (ConditionalCheckFailedException ex) {
            throw new ApiException(Response.Status.CONFLICT, "Email already in use, please choose another.", ex);
        }
        accountSchema.table().putItem(new PutItemSpec()
                .withItem(accountSchema.toItem(account))
                .withConditionExpression("attribute_not_exists(#partitionKey)")
                .withNameMap(new NameMap().with("#partitionKey", accountSchema.partitionKeyName())));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        indexAccount(indexingFuture, account);

        return new AccountAndIndexingFuture(account, indexingFuture);
    }

    @Extern
    @Override
    public Optional<Account> getAccount(String accountId, boolean useCache) {
        if (config.enableConfigCacheRead() && useCache) {
            final Optional<Account> accountCachedOpt = accountCache.getIfPresent(accountId);
            //noinspection OptionalAssignedToNull
            if (accountCachedOpt != null) {
                return accountCachedOpt;
            }
        }
        Optional<Account> accountOpt = Optional.ofNullable(accountSchema
                .fromItem(accountSchema
                        .table().getItem(new GetItemSpec()
                                .withPrimaryKey(accountSchema
                                        .primaryKey(Map.of(
                                                "accountId", accountId)))
                                .withConsistentRead(!useCache))));
        accountCache.put(accountId, accountOpt);
        return accountOpt;
    }

    @Override
    public ImmutableMap<String, Account> getAccounts(Collection<String> accountIds, boolean useCache) {
        if (accountIds.isEmpty()) {
            return ImmutableMap.of();
        }
        ImmutableMap.Builder<String, Account> resultBuilder = ImmutableMap.builder();
        singleTable.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(accountSchema.tableName())
                        .withPrimaryKeys(accountIds.stream()
                                .filter(accountId -> {
                                    if (!useCache) {
                                        return true;
                                    }
                                    Optional<Optional<Account>> accountOptOpt = Optional.ofNullable(accountCache.getIfPresent(accountId));
                                    if (accountOptOpt.isEmpty()) {
                                        return true;
                                    }
                                    if (accountOptOpt.get().isPresent()) {
                                        resultBuilder.put(accountId, accountOptOpt.get().get());
                                    }
                                    return false;
                                })
                                .map(accountId -> accountSchema
                                        .primaryKey(Map.of(
                                                "accountId", accountId)))
                                .toArray(PrimaryKey[]::new))))
                .map(i -> accountSchema.fromItem(i))
                .forEach(account -> {
                    if (useCache) {
                        accountCache.put(account.getAccountId(), Optional.of(account));
                    }
                    resultBuilder.put(account.getAccountId(), account);
                });
        return resultBuilder.build();
    }

    @Override
    public Optional<Account> getAccountByApiKey(String apiKey) {
        ImmutableList<Account> accountsByApiKey = StreamSupport.stream(accountByApiKeySchema.index().query(new QuerySpec()
                                .withHashKey(accountByApiKeySchema.partitionKey(Map.of(
                                        "apiKey", apiKey)))
                                .withRangeKeyCondition(new RangeKeyCondition(accountByApiKeySchema.rangeKeyName())
                                        .beginsWith(accountByApiKeySchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(accountByApiKeySchema::fromItem)
                .collect(ImmutableList.toImmutableList());
        accountsByApiKey.forEach(account -> accountCache.put(account.getAccountId(), Optional.of(account)));
        if (accountsByApiKey.size() > 1) {
            if (LogUtil.rateLimitAllowLog("accountStore-multiple-accounts-same-apikey")) {
                log.error("Multiple accounts found for same apiKey, account emails {}",
                        accountsByApiKey.stream().map(Account::getEmail).collect(Collectors.toList()));
            }
            throw new ApiException(Response.Status.UNAUTHORIZED, "Your API key is misconfigured");
        } else if (accountsByApiKey.size() == 1) {
            return Optional.of(accountsByApiKey.get(0));
        } else {
            return Optional.empty();
        }
    }

    @Override
    public Optional<Account> getAccountByOauthGuid(String oauthGuid) {
        ImmutableList<Account> accounts = StreamSupport.stream(accountByOauthGuidSchema.index().query(new QuerySpec()
                                .withHashKey(accountByOauthGuidSchema.partitionKey(Map.of(
                                        "oauthGuid", oauthGuid)))
                                .withRangeKeyCondition(new RangeKeyCondition(accountByOauthGuidSchema.rangeKeyName())
                                        .beginsWith(accountByOauthGuidSchema.rangeValuePartial(Map.of()))))
                        .pages()
                        .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(accountByOauthGuidSchema::fromItem)
                .collect(ImmutableList.toImmutableList());
        accounts.forEach(account -> accountCache.put(account.getAccountId(), Optional.of(account)));
        if (accounts.size() > 1) {
            if (LogUtil.rateLimitAllowLog("accountStore-multiple-accounts-same-apikey")) {
                log.error("Multiple accounts found for same oauthKey, account emails {}",
                        accounts.stream().map(Account::getEmail).collect(Collectors.toList()));
            }
            throw new ApiException(Response.Status.UNAUTHORIZED, "There is an issue with signing in to your account, please contact support");
        } else if (accounts.size() == 1) {
            return Optional.of(accounts.get(0));
        } else {
            return Optional.empty();
        }
    }

    @Extern
    @Override
    public Optional<Account> getAccountByEmail(String email) {
        return Optional.ofNullable(accountIdByEmailSchema.fromItem(accountIdByEmailSchema.table().getItem(new GetItemSpec()
                        .withPrimaryKey(accountIdByEmailSchema.primaryKey(Map.of(
                                "email", email))))))
                .map(accountEmail -> getAccount(accountEmail.getAccountId(), false)
                        .orElseThrow(() -> new IllegalStateException("AccountEmail entry exists but Account doesn't for email " + email)));
    }

    @Extern
    @Override
    public void repopulateIndex(boolean deleteExistingIndex, boolean repopulateElasticSearch, boolean repopulateMysql) throws Exception {
        log.info("Repopulating index for accounts deleteExistingIndex {} repopulateElasticSearch {} repopulateMysql {}",
                deleteExistingIndex, repopulateElasticSearch, repopulateMysql);
        if (repopulateElasticSearch) {
            boolean indexAlreadyExists = elastic.get().indices().exists(new GetIndexRequest(ACCOUNT_INDEX), RequestOptions.DEFAULT);
            if (indexAlreadyExists && deleteExistingIndex) {
                elastic.get().indices().delete(
                        new DeleteIndexRequest(ACCOUNT_INDEX),
                        RequestOptions.DEFAULT);
            }
            if (!indexAlreadyExists || deleteExistingIndex) {
                createIndexElasticSearch().get();
            }
        }
        if (repopulateMysql && deleteExistingIndex) {
            mysql.get().deleteFrom(JooqAccount.ACCOUNT).execute();
        }

        listAllAccounts(account -> {
            if (repopulateElasticSearch) {
                try {
                    elastic.get().index(accountToEsIndexRequest(account), RequestOptions.DEFAULT);
                } catch (IOException ex) {
                    if (LogUtil.rateLimitAllowLog("dynamoelsaticaccountstore-reindex-failure")) {
                        log.warn("Failed to re-index account {}", account.getAccountId(), ex);
                    }
                }
            }
            if (repopulateMysql) {
                accountToMysqlQuery(account).execute();
            }
        });
    }

    @Override
    public boolean isEmailAvailable(String email) {
        return Optional.ofNullable(accountIdByEmailSchema.fromItem(accountIdByEmailSchema.table().getItem(new GetItemSpec()
                .withPrimaryKey(accountIdByEmailSchema.primaryKey(Map.of(
                        "email", email)))))).isEmpty();
    }

    @Override
    public void listAllAccounts(Consumer<Account> consumer) {
        Optional<String> cursorOpt = Optional.empty();
        do {
            ShardPageResult<AccountEmail> result = singleTable.fetchShardNextPage(
                    accountIdShardedSchema,
                    cursorOpt,
                    DYNAMO_READ_BATCH_MAX_SIZE);
            cursorOpt = result.getCursorOpt();

            getAccounts(result.getItems().stream()
                    .map(AccountEmail::getAccountId)
                    .collect(Collectors.toList()), false)
                    .values()
                    .forEach(consumer);
        } while (cursorOpt.isPresent());
    }

    @Override
    public SearchAccountsResponse listAccounts(Optional<String> cursorOpt, int pageSize, boolean useCache) {
        ShardPageResult<AccountEmail> shardPageResult = singleTable.fetchShardNextPage(
                accountIdShardedSchema,
                cursorOpt,
                pageSize);
        return new SearchAccountsResponse(
                getAccounts(shardPageResult.getItems().stream()
                        .map(AccountEmail::getAccountId)
                        .collect(Collectors.toList()), useCache).values().asList(),
                shardPageResult.getCursorOpt());
    }

    @Override
    public SearchAccountsResponse searchAccounts(AccountSearchSuperAdmin accountSearchSuperAdmin, boolean useAccurateCursor, Optional<String> cursorOpt, Optional<Integer> pageSizeOpt) {

        final Optional<String> searchTextOpt = Optional.ofNullable(Strings.emptyToNull(accountSearchSuperAdmin.getSearchText()));

        final Stream<String> accountIdsStream;
        final Optional<String> cursorOptNext;
        if (configApp.defaultSearchEngine().isReadElastic()) {
            if (accountSearchSuperAdmin.getFilterPlanid() != null && !accountSearchSuperAdmin.getFilterPlanid().isEmpty()) {
                log.error("searchAccounts filtering by planid is not supported in elastic search");
            }
            if (accountSearchSuperAdmin.getFilterStatus() != null && !accountSearchSuperAdmin.getFilterStatus().isEmpty()) {
                log.error("searchAccounts filtering by status is not supported in elastic search");
            }
            QueryBuilder queryBuilder;
            if (searchTextOpt.isPresent()) {
                queryBuilder = QueryBuilders.multiMatchQuery(searchTextOpt.get(),
                                "email", "name")
                        .field("email", 2f)
                        .fuzziness("AUTO")
                        .zeroTermsQuery(ZeroTermsQueryOption.ALL);
            } else {
                queryBuilder = QueryBuilders.matchAllQuery();
            }
            log.trace("Account search query: {}", queryBuilder);
            ElasticUtil.SearchResponseWithCursor searchResponseWithCursor = elasticUtil.searchWithCursor(
                    new SearchRequest(ACCOUNT_INDEX)
                            .source(new SearchSourceBuilder()
                                    .fetchSource(false)
                                    .query(queryBuilder)),
                    cursorOpt, ImmutableList.of(), Optional.empty(), useAccurateCursor, pageSizeOpt, configSearch, ImmutableSet.of());

            SearchHit[] hits = searchResponseWithCursor.getSearchResponse().getHits().getHits();
            if (hits.length == 0) {
                return new SearchAccountsResponse(ImmutableList.of(), Optional.empty());
            }
            accountIdsStream = Arrays.stream(hits).map(SearchHit::getId);
            cursorOptNext = searchResponseWithCursor.getCursorOpt();
        } else {
            int offset = mysqlUtil.offset(cursorOpt);
            int pageSize = mysqlUtil.pageSizeMax(configSearch, pageSizeOpt);
            List<String> accountIds = mysql.get().select(JooqAccount.ACCOUNT.ACCOUNTID)
                    .from(JooqAccount.ACCOUNT)
                    .where(mysqlUtil.and(
                            searchTextOpt.map(searchText ->
                                    JooqAccount.ACCOUNT.EMAIL.likeIgnoreCase("%" + searchTextOpt.get() + "%")
                                            .or(JooqAccount.ACCOUNT.NAME.likeIgnoreCase("%" + searchTextOpt.get() + "%"))
                                            .or(JooqAccount.ACCOUNT.PLANID.likeIgnoreCase("%" + searchTextOpt.get() + "%"))),
                            Optional.ofNullable(accountSearchSuperAdmin.getFilterPlanid())
                                    .filter(Predicate.not(List::isEmpty))
                                    .map(Boolean.TRUE.equals(accountSearchSuperAdmin.getInvertPlanid())
                                            ? JooqAccount.ACCOUNT.PLANID::notIn
                                            : JooqAccount.ACCOUNT.PLANID::in),
                            Optional.ofNullable(accountSearchSuperAdmin.getFilterStatus())
                                    .filter(Predicate.not(List::isEmpty))
                                    .map(Boolean.TRUE.equals(accountSearchSuperAdmin.getInvertStatus())
                                            ? JooqAccount.ACCOUNT.STATUS::notIn
                                            : JooqAccount.ACCOUNT.STATUS::in)))
                    .offset(offset)
                    .limit(pageSize)
                    .fetch(JooqAccount.ACCOUNT.ACCOUNTID);
            if (accountIds.isEmpty()) {
                return new SearchAccountsResponse(ImmutableList.of(), Optional.empty());
            }
            accountIdsStream = accountIds.stream();
            cursorOptNext = mysqlUtil.nextCursor(configSearch, cursorOpt, pageSizeOpt, accountIds.size());
        }

        ImmutableList<Account> accounts = singleTable.retryUnprocessed(dynamoDoc.batchGetItem(new TableKeysAndAttributes(accountSchema.tableName())
                        .withPrimaryKeys(accountIdsStream
                                .map(accountId -> accountSchema.primaryKey(ImmutableMap.of(
                                        "accountId", accountId)))
                                .toArray(PrimaryKey[]::new))))
                .map(accountSchema::fromItem)
                .collect(ImmutableList.toImmutableList());
        accounts.forEach(account -> accountCache.put(account.getAccountId(), Optional.of(account)));

        return new SearchAccountsResponse(
                accounts,
                cursorOptNext);
    }

    @Override
    public long getUserCountForAccount(String accountId) {
        return getAccount(accountId, false)
                .map(Account::getProjectIds)
                .map(Collection::stream)
                .orElse(Stream.empty())
                .mapToLong(userStore::getUserCountForProject)
                .sum();
    }

    @Override
    public long getTeammateCountForAccount(String accountId) {
        return getAccount(accountId, false)
                .map(Account::getProjectIds)
                .map(projectIds -> projectStore.getProjects(projectIds, false))
                .stream()
                .flatMap(Collection::stream)
                .map(ProjectStore.Project::getModel)
                .map(ProjectStore.ProjectModel::getAdminsAccountIds)
                .flatMap(accountIds -> Stream.concat(accountIds.stream(), Stream.of(accountId)))
                .distinct()
                .count();
    }

    @Override
    public long getPostCountForAccount(String accountId) {
        return getAccount(accountId, false).stream()
                .flatMap(account -> account.getProjectIds().stream())
                .mapToLong(ideaStore::countIdeas)
                .sum();
    }

    @Extern
    private String setPlan(String accountId, String planid) {
        return setPlan(accountId, planid, Optional.empty()).getAccount().toString();
    }

    @Override
    public AccountAndIndexingFuture setPlan(String accountId, String planid, Optional<ImmutableMap<String, String>> addonsOpt) {
        ExpressionBuilder expressionBuilder = accountSchema.expressionBuilder();
        addonsOpt.ifPresent(addons -> expressionBuilder.set("addons", addons));
        Expression expression = expressionBuilder
                .conditionExists()
                .set("planid", planid)
                .build();
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression(expression.conditionExpression().orElse(null))
                        .withUpdateExpression(expression.updateExpression().orElse(null))
                        .withNameMap(expression.nameMap().orElse(null))
                        .withValueMap(expression.valMap().orElse(null))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = configApp.defaultSearchEngine();
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(ACCOUNT_INDEX, accountId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "planid", planid
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexAccount(f, accountId))
                            : ActionListeners.onFailureRetry(() -> indexAccount(accountId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqAccount.ACCOUNT)
                    .set(JooqAccount.ACCOUNT.PLANID, planid)
                    .where(JooqAccount.ACCOUNT.ACCOUNTID.eq(accountId))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new AccountAndIndexingFuture(account, indexingFuture);
    }

    @Override
    public boolean shouldSendTrialEndedNotification(String accountId, String planId) {
        try {
            accountSchema.table().updateItem(new UpdateItemSpec()
                    .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                    .withConditionExpression("attribute_exists(#partitionKey) and #trialEndedNotificationSentForPlanId <> :planId")
                    .withUpdateExpression("SET #trialEndedNotificationSentForPlanId = :planId")
                    .withNameMap(new NameMap()
                            .with("#trialEndedNotificationSentForPlanId", "trialEndedNotificationSentForPlanId")
                            .with("#partitionKey", accountSchema.partitionKeyName()))
                    .withValueMap(new ValueMap()
                            .with(":planId", planId))
                    .withReturnValues(ReturnValue.NONE));
        } catch (ConditionalCheckFailedException ex) {
            return false;
        }
        return true;
    }

    @Override
    public Account updateAddons(String accountId, Map<String, String> addons, boolean overwriteMap) {
        if (addons == null) {
            addons = ImmutableMap.of();
        }
        if (overwriteMap) {
            Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                            .withConditionExpression("attribute_exists(#partitionKey)")
                            .withUpdateExpression("SET #addons = :addons")
                            .withNameMap(new NameMap()
                                    .with("#partitionKey", accountSchema.partitionKeyName())
                                    .with("#addons", "addons"))
                            .withValueMap(new ValueMap().with(":addons", accountSchema.toDynamoValue("addons", addons)))
                            .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem());
            accountCache.put(accountId, Optional.of(account));
            return account;
        } else {
            if (addons.isEmpty()) {
                return getAccount(accountId, true).get();
            }

            ExpressionBuilder expressionBuilder = accountSchema.expressionBuilder();
            addons.forEach((key, val) -> {
                if (!Strings.isNullOrEmpty(val)) {
                    expressionBuilder.set(ImmutableList.of("addons", key), val);
                } else {
                    expressionBuilder.remove(ImmutableList.of("addons", key));
                }
            });
            Expression expression = expressionBuilder.build();
            log.trace("update addons expression {}", expression);
            Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                            .withConditionExpression("attribute_exists(#partitionKey)")
                            .withUpdateExpression(expression.updateExpression().orElse(null))
                            .withConditionExpression(expression.conditionExpression().orElse(null))
                            .withNameMap(expression.nameMap().orElse(null))
                            .withValueMap(expression.valMap().orElse(null))
                            .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem());
            accountCache.put(accountId, Optional.of(account));
            return account;
        }
    }

    @Extern
    @Override
    public AccountAndIndexingFuture addProject(String accountId, String projectId) {
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("ADD #projectIds :projectId")
                        .withNameMap(new NameMap()
                                .with("#projectIds", "projectIds")
                                .with("#partitionKey", accountSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().withStringSet(":projectId", projectId))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = configApp.defaultSearchEngine();
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(ACCOUNT_INDEX, accountId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "projectIds", orNull(account.getProjectIds())
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexAccount(f, accountId))
                            : ActionListeners.onFailureRetry(() -> indexAccount(accountId)));
        }
        if (searchEngine.isWriteMysql() && searchEngine.isReadMysql()) {
            indexingFuture.set(null); // Nothing to update on Mysql
        }

        return new AccountAndIndexingFuture(account, indexingFuture);
    }

    @Extern
    @Override
    public AccountAndIndexingFuture removeProject(String accountId, String projectId) {
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("DELETE #projectIds :projectId")
                        .withNameMap(new NameMap()
                                .with("#projectIds", "projectIds")
                                .with("#partitionKey", accountSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().withStringSet(":projectId", projectId))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = configApp.defaultSearchEngine();
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(ACCOUNT_INDEX, accountId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "projectIds", orNull(account.getProjectIds())
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexAccount(f, accountId))
                            : ActionListeners.onFailureRetry(() -> indexAccount(accountId)));
        }
        if (searchEngine.isWriteMysql() && searchEngine.isReadMysql()) {
            indexingFuture.set(null); // Nothing to update on Mysql
        }

        return new AccountAndIndexingFuture(account, indexingFuture);
    }

    @Override
    public Account addExternalProject(String accountId, String projectId) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("ADD #externalProjectIds :projectId")
                        .withNameMap(new NameMap()
                                .with("#externalProjectIds", "externalProjectIds")
                                .with("#partitionKey", accountSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().withStringSet(":projectId", projectId))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Override
    public Account removeExternalProject(String accountId, String projectId) {
        return accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("DELETE #externalProjectIds :projectId")
                        .withNameMap(new NameMap()
                                .with("#externalProjectIds", "externalProjectIds")
                                .with("#partitionKey", accountSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().withStringSet(":projectId", projectId))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Extern
    @Override
    public Account updateOauthGuid(String accountId, Optional<String> oauthGuidOpt) {
        ExpressionBuilder expressionBuilder = accountSchema.expressionBuilder()
                .conditionExists();
        // This is "yet another" rare case where the attribute to update is also a partition key.
        // Explicitly set it here to update GSI
        if (oauthGuidOpt.isPresent()) {
            expressionBuilder.set("oauthGuid", oauthGuidOpt.get())
                    .set(accountByOauthGuidSchema.partitionKeyName(), accountByOauthGuidSchema.partitionKey(Map.of("oauthGuid", oauthGuidOpt.get())).getValue())
                    .set(accountByOauthGuidSchema.rangeKeyName(), accountByOauthGuidSchema.rangeKey(Map.of()).getValue());
        } else {
            expressionBuilder.remove("oauthGuid")
                    .remove(accountByOauthGuidSchema.partitionKeyName())
                    .remove(accountByOauthGuidSchema.rangeKeyName());
        }
        Expression expression = expressionBuilder.build();
        log.trace("update oauth guid expression {}", expression);
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression(expression.conditionExpression().orElse(null))
                        .withUpdateExpression(expression.updateExpression().orElse(null))
                        .withNameMap(expression.nameMap().orElse(null))
                        .withValueMap(expression.valMap().orElse(null))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));
        return account;
    }

    @Extern
    @Override
    public AccountAndIndexingFuture updateName(String accountId, String name) {
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("SET #name = :name")
                        .withNameMap(new NameMap()
                                .with("#name", "name")
                                .with("#partitionKey", accountSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().withString(":name", name))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = configApp.defaultSearchEngine();
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(ACCOUNT_INDEX, accountId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "name", account.getName()
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexAccount(f, accountId))
                            : ActionListeners.onFailureRetry(() -> indexAccount(accountId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqAccount.ACCOUNT)
                    .set(JooqAccount.ACCOUNT.NAME, account.getName())
                    .where(JooqAccount.ACCOUNT.ACCOUNTID.eq(accountId))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new AccountAndIndexingFuture(account, indexingFuture);
    }

    @Extern
    @Override
    public Account updatePassword(String accountId, String password, Optional<String> sessionToLeaveOpt) {
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("SET #password = :password")
                        .withNameMap(new NameMap()
                                .with("#password", "password")
                                .with("#partitionKey", accountSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().withString(":password", password))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));
        revokeSessions(account.getAccountId(), sessionToLeaveOpt);
        return account;
    }

    @Extern
    @Override
    public AccountAndIndexingFuture updateEmail(String accountId, String emailNew, String sessionIdToLeave) {
        Account accountOld = getAccount(accountId, false).get();
        dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(ImmutableList.<TransactWriteItem>builder()
                .add(new TransactWriteItem().withPut(new Put()
                        .withTableName(accountIdByEmailSchema.tableName())
                        .withItem(accountIdByEmailSchema.toAttrMap(new AccountEmail(
                                emailNew, accountId)))))
                .add(new TransactWriteItem().withDelete(new Delete()
                        .withTableName(accountIdByEmailSchema.tableName())
                        .withKey(ItemUtils.toAttributeValueMap(accountIdByEmailSchema.primaryKey(Map.of(
                                "email", accountOld.getEmail()))))
                        .withConditionExpression("attribute_exists(#partitionKey) AND #accountId = :accountId")
                        .withExpressionAttributeNames(Map.of(
                                "#accountId", "accountId",
                                "#partitionKey", accountSchema.partitionKeyName()))
                        .withExpressionAttributeValues(Map.of(
                                ":accountId", accountIdByEmailSchema.toAttrValue("accountId", accountId)))))
                .add(new TransactWriteItem().withUpdate(new Update()
                        .withTableName(accountSchema.tableName())
                        .withKey(ItemUtils.toAttributeValueMap(accountSchema.primaryKey(Map.of(
                                "accountId", accountId))))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("SET #email = :email")
                        .withExpressionAttributeNames(Map.of(
                                "#email", "email",
                                "#partitionKey", accountSchema.partitionKeyName()))
                        .withExpressionAttributeValues(Map.of(
                                ":email", accountSchema.toAttrValue("email", emailNew)))))
                .build()));
        revokeSessions(accountId, sessionIdToLeave);
        Account account = accountOld.toBuilder().email(emailNew).build();
        accountCache.put(accountId, Optional.of(account));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = configApp.defaultSearchEngine();
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(ACCOUNT_INDEX, accountId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "email", account.getEmail()
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexAccount(f, accountId))
                            : ActionListeners.onFailureRetry(() -> indexAccount(accountId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqAccount.ACCOUNT)
                    .set(JooqAccount.ACCOUNT.EMAIL, account.getEmail())
                    .where(JooqAccount.ACCOUNT.ACCOUNTID.eq(accountId))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new AccountAndIndexingFuture(account, indexingFuture);
    }

    @Extern
    @Override
    public Account updateApiKey(String accountId, String apiKey) {
        Expression expression = accountSchema.expressionBuilder()
                .conditionExists()
                .set("apiKey", apiKey)
                /*
                 * This is a rare case where the attribute to update is also a partition key.
                 * Explicitly set it here to update GSI
                 */
                .set(accountByApiKeySchema.partitionKeyName(), accountByApiKeySchema.partitionKey(Map.of("apiKey", apiKey)).getValue())
                .set(accountByApiKeySchema.rangeKeyName(), accountByApiKeySchema.rangeKey(Map.of()).getValue())
                .build();
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression(expression.conditionExpression().orElse(null))
                        .withUpdateExpression(expression.updateExpression().orElse(null))
                        .withNameMap(expression.nameMap().orElse(null))
                        .withValueMap(expression.valMap().orElse(null))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));
        return account;
    }

    @Override
    public AccountAndIndexingFuture updateStatus(String accountId, SubscriptionStatus status) {
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("SET #status = :status")
                        .withNameMap(new NameMap()
                                .with("#status", "status")
                                .with("#partitionKey", accountSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().with(":status", accountSchema.toDynamoValue("status", status)))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = configApp.defaultSearchEngine();
        if (searchEngine.isWriteElastic()) {
            elastic.get().updateAsync(new UpdateRequest(ACCOUNT_INDEX, accountId)
                            .doc(gson.toJson(ImmutableMap.of(
                                    "status", account.getStatus()
                            )), XContentType.JSON)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexAccount(f, accountId))
                            : ActionListeners.onFailureRetry(() -> indexAccount(accountId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().update(JooqAccount.ACCOUNT)
                    .set(JooqAccount.ACCOUNT.STATUS, account.getStatus().name())
                    .where(JooqAccount.ACCOUNT.ACCOUNTID.eq(accountId))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return new AccountAndIndexingFuture(account, indexingFuture);
    }

    @Override
    public Account updateAttrs(String accountId, Map<String, String> attrs, boolean overwriteMap) {
        if (attrs == null) {
            attrs = ImmutableMap.of();
        }
        if (overwriteMap) {
            Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                            .withConditionExpression("attribute_exists(#partitionKey)")
                            .withUpdateExpression("SET #attrs = :attrs")
                            .withNameMap(new NameMap()
                                    .with("#partitionKey", accountSchema.partitionKeyName())
                                    .with("#attrs", "attrs"))
                            .withValueMap(new ValueMap().with(":attrs", accountSchema.toDynamoValue("attrs", attrs)))
                            .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem());
            accountCache.put(accountId, Optional.of(account));
            return account;
        } else {
            if (attrs.isEmpty()) {
                return getAccount(accountId, true).get();
            }

            ExpressionBuilder expressionBuilder = accountSchema.expressionBuilder();
            attrs.forEach((key, val) -> {
                if (!Strings.isNullOrEmpty(val)) {
                    expressionBuilder.set(ImmutableList.of("attrs", key), val);
                } else {
                    expressionBuilder.remove(ImmutableList.of("attrs", key));
                }
            });
            Expression expression = expressionBuilder.build();
            log.trace("update account attrs expression {}", expression);
            Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                            .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                            .withConditionExpression("attribute_exists(#partitionKey)")
                            .withUpdateExpression(expression.updateExpression().orElse(null))
                            .withConditionExpression(expression.conditionExpression().orElse(null))
                            .withNameMap(expression.nameMap().orElse(null))
                            .withValueMap(expression.valMap().orElse(null))
                            .withReturnValues(ReturnValue.ALL_NEW))
                    .getItem());
            accountCache.put(accountId, Optional.of(account));
            return account;
        }
    }

    @Override
    public Account setWeeklyDigestOptOut(String accountId, ImmutableSet<String> digestOptOutForProjectIds) {
        ExpressionBuilder expressionBuilder = accountSchema.expressionBuilder().conditionExists();
        if (digestOptOutForProjectIds.isEmpty()) {
            expressionBuilder.remove("digestOptOutForProjectIds");
        } else {
            expressionBuilder.set("digestOptOutForProjectIds", digestOptOutForProjectIds);
        }
        Expression expression = expressionBuilder.build();
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression(expression.conditionExpression().orElse(null))
                        .withUpdateExpression(expression.updateExpression().orElse(null))
                        .withNameMap(expression.nameMap().orElse(null))
                        .withValueMap(expression.valMap().orElse(null))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));
        return account;
    }

    @Override
    public Account setTrialReminderSent(String accountId) {
        Expression expression = accountSchema.expressionBuilder()
                .conditionExists()
                .set("trialEndingReminderSent", true)
                .build();
        Account account = accountSchema.fromItem(accountSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId)))
                        .withConditionExpression(expression.conditionExpression().orElse(null))
                        .withUpdateExpression(expression.updateExpression().orElse(null))
                        .withNameMap(expression.nameMap().orElse(null))
                        .withValueMap(expression.valMap().orElse(null))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
        accountCache.put(accountId, Optional.of(account));
        return account;
    }

    @Extern
    @Override
    public ListenableFuture<Void> deleteAccount(String accountId) {
        String email = getAccount(accountId, false).orElseThrow().getEmail();
        accountIdByEmailSchema.table().deleteItem(new DeleteItemSpec()
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withNameMap(Map.of(
                        "#partitionKey", accountIdByEmailSchema.partitionKeyName()))
                .withPrimaryKey(accountIdByEmailSchema.primaryKey(Map.of(
                        "email", email))));
        accountSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(accountSchema.primaryKey(Map.of("accountId", accountId))));
        accountCache.invalidate(accountId);
        revokeSessions(accountId);

        SettableFuture<Void> indexingFuture = SettableFuture.create();
        SearchEngine searchEngine = configApp.defaultSearchEngine();
        if (searchEngine.isWriteElastic()) {
            elastic.get().deleteAsync(new DeleteRequest(ACCOUNT_INDEX, accountId)
                            .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic() ? ActionListeners.onFailureRetry(indexingFuture, f -> indexAccount(f, accountId))
                            : ActionListeners.onFailureRetry(() -> indexAccount(accountId)));
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = mysql.get().delete(JooqAccount.ACCOUNT)
                    .where(JooqAccount.ACCOUNT.ACCOUNTID.eq(accountId))
                    .executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }

        return indexingFuture;
    }

    @Extern
    @Override
    public AccountSession createSession(Account account, long ttlInEpochSec) {
        AccountSession accountSession = new AccountSession(genSessionId(), account.getAccountId(), account.getEmail(), ttlInEpochSec);
        sessionBySessionIdSchema.table().putItem(new PutItemSpec()
                .withItem(sessionBySessionIdSchema.toItem(accountSession)));
        return accountSession;
    }

    @Extern
    @Override
    public Optional<AccountSession> getSession(String sessionId) {
        return getSession(sessionId, false)
                .or(() -> getSession(sessionId, true));
    }

    private Optional<AccountSession> getSession(String sessionId, boolean consistentRead) {
        return Optional.ofNullable(sessionBySessionIdSchema
                        .fromItem(sessionBySessionIdSchema
                                .table().getItem(new GetItemSpec()
                                        .withPrimaryKey(sessionBySessionIdSchema.primaryKey(Map.of("sessionId", sessionId)))
                                        .withConsistentRead(consistentRead))))
                .filter(session -> {
                    if (session.getTtlInEpochSec() < Instant.now().getEpochSecond()) {
                        log.debug("DynamoDB has an expired account session with expiry {}", session.getTtlInEpochSec());
                        return false;
                    }
                    return true;
                });
    }

    @Override
    public AccountSession refreshSession(AccountSession accountSession, long ttlInEpochSec) {
        return sessionBySessionIdSchema.fromItem(sessionBySessionIdSchema.table().updateItem(new UpdateItemSpec()
                        .withPrimaryKey(sessionBySessionIdSchema.primaryKey(accountSession))
                        .withConditionExpression("attribute_exists(#partitionKey)")
                        .withUpdateExpression("SET #ttlInEpochSec = :ttlInEpochSec")
                        .withNameMap(new NameMap()
                                .with("#ttlInEpochSec", "ttlInEpochSec")
                                .with("#partitionKey", sessionBySessionIdSchema.partitionKeyName()))
                        .withValueMap(new ValueMap().withLong(":ttlInEpochSec", ttlInEpochSec))
                        .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());
    }

    @Extern
    @Override
    public void revokeSession(String sessionId) {
        sessionBySessionIdSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(sessionBySessionIdSchema.primaryKey(Map.of(
                        "sessionId", sessionId))));
    }

    @Extern
    @Override
    public void revokeSessions(String accountId) {
        revokeSessions(accountId, Optional.empty());
    }

    @Override
    public void revokeSessions(String accountId, String sessionToLeave) {
        revokeSessions(accountId, Optional.of(sessionToLeave));
    }

    private void revokeSessions(String accountId, Optional<String> sessionToLeaveOpt) {
        Iterables.partition(StreamSupport.stream(sessionByAccountIdSchema.index().query(new QuerySpec()
                                        .withHashKey(sessionByAccountIdSchema.partitionKey(Map.of(
                                                "accountId", accountId)))
                                        .withRangeKeyCondition(new RangeKeyCondition(sessionByAccountIdSchema.rangeKeyName())
                                                .beginsWith(sessionByAccountIdSchema.rangeValuePartial(Map.of()))))
                                .pages()
                                .spliterator(), false)
                        .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                        .map(sessionByAccountIdSchema::fromItem)
                        .map(AccountSession::getSessionId)
                        .filter(sessionId -> !sessionToLeaveOpt.isPresent() || !sessionToLeaveOpt.get().equals(sessionId))
                        .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(sessionIdsBatch -> {
                    TableWriteItems tableWriteItems = new TableWriteItems(sessionBySessionIdSchema.tableName());
                    sessionIdsBatch.stream()
                            .map(sessionId -> sessionBySessionIdSchema.primaryKey(Map.of(
                                    "sessionId", sessionId)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
    }

    private void indexAccount(String accountId) {
        indexAccount(SettableFuture.create(), accountId);
    }

    private void indexAccount(SettableFuture<Void> indexingFuture, String accountId) {
        Optional<Account> accountOpt = getAccount(accountId, true);
        if (!accountOpt.isPresent()) {
            SearchEngine searchEngine = configApp.defaultSearchEngine();
            if (searchEngine.isWriteElastic()) {
                elastic.get().deleteAsync(new DeleteRequest(ACCOUNT_INDEX, accountId),
                        RequestOptions.DEFAULT, ActionListeners.fromFuture(indexingFuture));
            }
            if (searchEngine.isWriteMysql()) {
                mysql.get().delete(JooqAccount.ACCOUNT)
                        .where(JooqAccount.ACCOUNT.ACCOUNTID.eq(accountId))
                        .executeAsync();
            }
        } else {
            indexAccount(indexingFuture, accountOpt.get());
        }
    }

    private void indexAccount(SettableFuture<Void> indexingFuture, Account account) {
        SearchEngine searchEngine = configApp.defaultSearchEngine();
        if (searchEngine.isWriteElastic()) {
            elastic.get().indexAsync(accountToEsIndexRequest(account),
                    RequestOptions.DEFAULT,
                    searchEngine.isReadElastic()
                            ? ActionListeners.fromFuture(indexingFuture)
                            : ActionListeners.logFailure());
        }
        if (searchEngine.isWriteMysql()) {
            CompletionStage<Integer> completionStage = accountToMysqlQuery(account).executeAsync();
            if (searchEngine.isReadMysql()) {
                CompletionStageUtil.toSettableFuture(indexingFuture, completionStage);
            } else {
                CompletionStageUtil.logFailure(completionStage);
            }
        }
    }

    private Query accountToMysqlQuery(Account account) {
        JooqAccountRecord record = mysql.get().newRecord(JooqAccount.ACCOUNT);
        record.setAccountid(account.getAccountId());
        record.setName(account.getName());
        record.setEmail(account.getEmail());
        record.setStatus(account.getStatus().name());
        record.setPlanid(account.getPlanid());
        record.setCreated(account.getCreated());
        return mysql.get().insertInto(JooqAccount.ACCOUNT, JooqAccount.ACCOUNT.fields())
                .values(record)
                .onDuplicateKeyUpdate()
                .set(record);
    }

    private IndexRequest accountToEsIndexRequest(Account account) {
        return new IndexRequest(ACCOUNT_INDEX)
                .setRefreshPolicy(config.elasticForceRefresh() ? WriteRequest.RefreshPolicy.IMMEDIATE : WriteRequest.RefreshPolicy.WAIT_UNTIL)
                .id(account.getAccountId())
                .source(gson.toJson(ImmutableMap.builder()
                        .put("name", account.getName())
                        .put("email", account.getEmail())
                        .put("status", account.getStatus())
                        .put("planid", account.getPlanid())
                        .put("created", account.getCreated().getEpochSecond())
                        .put("projectIds", orNull(account.getProjectIds()))
                        .build()), XContentType.JSON);
    }

    /**
     * One time operation to add AccountEmail's GSI 2 keys
     */
    @Extern
    @VisibleForTesting
    public long upgradeAddGsi2ToAccountEmailSchema() {
        Map<String, AttributeValue> exclusiveStartKey = null;
        long migrated = 0;
        do {
            ScanResult result = dynamo.scan(new ScanRequest()
                    .withLimit(DYNAMO_WRITE_BATCH_MAX_SIZE)
                    .withFilterExpression("#primaryRangeKeyName = :primaryRangeValue AND attribute_not_exists(#gsiRangeKeyName)")
                    .withExpressionAttributeNames(Map.of(
                            "#primaryRangeKeyName", accountIdByEmailSchema.rangeKeyName(),
                            "#gsiRangeKeyName", accountIdShardedSchema.rangeKeyName()))
                    .withExpressionAttributeValues(Map.of(
                            ":primaryRangeValue", new AttributeValue(accountIdByEmailSchema.rangeKey(Map.of()).getValue().toString())))
                    .withTableName(accountIdByEmailSchema.tableName())
                    .withExclusiveStartKey(exclusiveStartKey));
            exclusiveStartKey = result.getLastEvaluatedKey();
            if (!result.getItems().isEmpty()) {
                migrated += result.getItems().size();
                singleTable.retryUnprocessed(dynamoDoc.batchWriteItem(new TableWriteItems(accountIdByEmailSchema.tableName())
                        .withItemsToPut(result.getItems().stream()
                                .map(accountIdByEmailSchema::fromAttrMap)
                                .map(accountIdByEmailSchema::toItem)
                                .collect(ImmutableList.toImmutableList()))));
            }
        } while (exclusiveStartKey != null && !exclusiveStartKey.isEmpty());
        return migrated;
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(AccountStore.class).to(DynamoElasticAccountStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
                install(ConfigSystem.configModule(ElasticUtil.ConfigSearch.class, Names.named("account")));
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(DynamoElasticAccountStore.class).asEagerSingleton();
            }
        };
    }
}
