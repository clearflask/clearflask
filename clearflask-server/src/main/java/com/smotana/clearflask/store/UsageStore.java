package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableMap;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.time.Period;
import java.util.Date;
import java.util.OptionalLong;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface UsageStore {

    /**
     * Returns current sum for partition, or empty optional if not incremented.
     */
    OptionalLong recordUsage(String accountId, Period period, long periodNum, String targetId, Instant ts, boolean useSharding);

    long fetchUsageForAccount(String accountId, long periodNum, boolean useSharding);

    ImmutableMap<String, ImmutableMap<Date, Long>> fetchUsage(Period range);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"prefix", "periodNum", "partition"}, rangePrefix = "usageSummary", rangeKeys = "accountId")
    class UsageSummary {
        @NonNull
        private final String prefix;

        /**
         * If usage period is one month, this corresponds to month number
         */
        @NonNull
        private final long periodNum;

        /**
         * To prevent hotspots, spread accross multiple partitions.
         * Control behavior with useSharding:
         * false: Small customers; Partition is deterministically chosen based on accountId
         * true: Big customers; Partition is random every write, read must check all partitions
         */
        @NonNull
        private final long partition;

        @NonNull
        private final String accountId;

        @NonNull
        private final long count;

        @NonNull
        private final Long ttlInEpochSec;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"accountId", "targetId"}, rangePrefix = "targetUsage", rangeKeys = "periodNum")
    class TargetUsage {
        @NonNull
        private final String accountId;

        @NonNull
        private final String targetId;

        @NonNull
        private final long periodNum;

        @NonNull
        private final long ttlInEpochSec;
    }
}
