package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.google.common.base.Charsets;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableMap;
import com.google.common.hash.Hashing;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.UsageStore;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.time.Instant;
import java.time.Period;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.LongStream;

@Slf4j
@Singleton
public class DynamoUsageStore implements UsageStore {
    private static final String USAGE_SUMMARY_PARTITION_KEY_PREFIX = "usageSummary";

    public interface Config {
        /**
         * To avoid hotspots, usage is sharded in DynamoDB.
         * IMPORTANT: Before changing this value, set readAllShards to true for one period.
         */
        @DefaultValue("10")
        int shardCount();

        /**
         * Forces accounts using deterministic sharding to be read from all shards anyway.
         * Use when you want to change shardCount, keep true for one period, then set back to false.
         */
        @DefaultValue("false")
        boolean readAllShards();

        @DefaultValue("PT3H")
        Duration cacheExpireAfterAccess();

        @DefaultValue("1.5d")
        double keepTargetUsageForPeriodMultiplier();

        @DefaultValue("3d")
        double keepUsageSummaryForPeriodMultiplier();
    }

    @Inject
    private Config config;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;

    private TableSchema<UsageSummary> usageSummarySchema;
    private TableSchema<TargetUsage> targetUsageSchema;
    private Cache<String, Boolean> targetUsageCache;

    @Inject
    private void setup() {
        targetUsageCache = CacheBuilder.newBuilder()
                .maximumSize(10_000L)
                .expireAfterAccess(config.cacheExpireAfterAccess())
                .build();

        usageSummarySchema = dynamoMapper.parseTableSchema(UsageSummary.class);
        targetUsageSchema = dynamoMapper.parseTableSchema(TargetUsage.class);
    }

    @Override
    public OptionalLong recordUsage(String accountId, Period period, long periodNum, String targetId, Instant ts, boolean useSharding) {
        if (this.targetUsageCache.getIfPresent(getCacheKey(targetId, periodNum)) != null) {
            return OptionalLong.empty();
        }
        if (targetUsageSchema.table().getItem(targetUsageSchema
                .primaryKey(Map.of(
                        "accountId", accountId,
                        "targetId", targetId,
                        "periodNum", periodNum))) != null) {
            return OptionalLong.empty();
        }
        long targetUsageTtlInEpochSec = (long) (Instant.now().plus(period).getEpochSecond() * config.keepTargetUsageForPeriodMultiplier());
        try {
            targetUsageSchema.table().putItem(new PutItemSpec()
                    .withItem(targetUsageSchema.toItem(new TargetUsage(
                            accountId,
                            targetId,
                            periodNum,
                            targetUsageTtlInEpochSec)))
                    .withConditionExpression("attribute_not_exists(#partitionKey)")
                    .withNameMap(new NameMap().with("#partitionKey", usageSummarySchema.partitionKeyName())));
        } catch (ConditionalCheckFailedException ex) {
            return OptionalLong.empty();
        }

        int partition = useSharding
                ? ThreadLocalRandom.current().nextInt(0, config.shardCount())
                : consistentHash(accountId, config.shardCount());
        long usageSummaryTtlInEpochSec = (long) (Instant.now().plus(period).getEpochSecond() * config.keepTargetUsageForPeriodMultiplier());
        UsageSummary usageSummaryPartition = usageSummarySchema.fromItem(usageSummarySchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(usageSummarySchema.primaryKey(Map.of(
                        "prefix", USAGE_SUMMARY_PARTITION_KEY_PREFIX,
                        "periodNum", periodNum,
                        "partition", partition,
                        "accountId", accountId)))
                .withUpdateExpression("SET #ttl = :ttl ADD #count = #count + :one")
                .withNameMap(new NameMap()
                        .with("#ttl", "ttlInEpochSec")
                        .with("#count", "count"))
                .withValueMap(new ValueMap()
                        .with(":one", 1L)
                        .with(":ttl", usageSummaryTtlInEpochSec))
                .withReturnValues(ReturnValue.ALL_NEW))
                .getItem());

        return OptionalLong.of(usageSummaryPartition.getCount());
    }

    @Override
    public long fetchUsageForAccount(String accountId, long periodNum, boolean useSharding) {
        if (!useSharding && !config.readAllShards()) {
            // Just read the on partition and that's it
            Optional<UsageSummary> usageSummaryOpt = Optional.ofNullable(usageSummarySchema.fromItem(usageSummarySchema.table().getItem(usageSummarySchema
                    .primaryKey(Map.of(
                            "prefix", USAGE_SUMMARY_PARTITION_KEY_PREFIX,
                            "periodNum", periodNum,
                            "partition", consistentHash(accountId, config.shardCount()),
                            "accountId", accountId)))));
            return usageSummaryOpt.map(UsageSummary::getCount).orElse(0L);
        } else {
            // Read all partitions and summarize them all
            return dynamoDoc.batchGetItem(new TableKeysAndAttributes(usageSummarySchema.tableName()).withPrimaryKeys(LongStream.range(0, config.shardCount()).boxed()
                    .map(partitionId -> usageSummarySchema.primaryKey(Map.of(
                            "prefix", USAGE_SUMMARY_PARTITION_KEY_PREFIX,
                            "periodNum", periodNum,
                            "partition", partitionId,
                            "accountId", accountId)))
                    .toArray(PrimaryKey[]::new)))
                    .getTableItems()
                    .values()
                    .stream()
                    .flatMap(Collection::stream)
                    .map(usageSummarySchema::fromItem)
                    .filter(Objects::nonNull)
                    .mapToLong(UsageSummary::getCount)
                    .sum();
        }
    }

    @Override
    public ImmutableMap<String, ImmutableMap<Date, Long>> fetchUsage(Period range) {
        TODO
    }

    private String getCacheKey(String targetId, long periodNum) {
        return targetId + "-" + periodNum;
    }

    private int consistentHash(String accountId, int shardCount) {
        return Hashing.consistentHash(Hashing.murmur3_32().hashString(accountId, Charsets.UTF_8), shardCount);
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(UsageStore.class).to(DynamoUsageStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
