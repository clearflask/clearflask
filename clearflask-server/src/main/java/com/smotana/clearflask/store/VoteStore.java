package com.smotana.clearflask.store;


import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.util.Optional;

public interface VoteStore {

    /**
     * Returns previous vote.
     */
    Vote vote(String projectId, String userId, String targetId, Vote vote);

    ImmutableMap<String, VoteModel> voteSearch(String projectId, String userId, ImmutableSet<String> targetIds);

    /**
     * Ordered by targetId desc.
     */
    ListResponse<VoteModel> voteList(String projectId, String userId, Optional<String> cursorOpt);


    /**
     * Returns all previous expressions.
     */
    ImmutableSet<String> express(String projectId, String userId, String targetId, Optional<String> expression);

    /**
     * Returns all previous expressions.
     */
    ImmutableSet<String> expressMultiAdd(String projectId, String userId, String targetId, ImmutableSet<String> addExpressions);

    /**
     * Returns all previous expressions.
     */
    ImmutableSet<String> expressMultiRemove(String projectId, String userId, String targetId, ImmutableSet<String> removeExpressions);

    ImmutableMap<String, ExpressModel> expressSearch(String projectId, String userId, ImmutableSet<String> targetIds);

    /**
     * Ordered by targetId desc.
     */
    ListResponse<ExpressModel> expressList(String projectId, String userId, Optional<String> cursorOpt);


    default String genTransactionId() {
        return IdUtil.randomAscId();
    }

    Transaction fund(String projectId, String userId, String targetId, long fundAmount, String transactionType, String summary);

    ImmutableMap<String, FundModel> fundSearch(String projectId, String userId, ImmutableSet<String> targetIds);

    /**
     * Ordered by targetId desc.
     */
    ListResponse<FundModel> fundList(String projectId, String userId, Optional<String> cursorOpt);

    /**
     * Ordered by created desc.
     */
    ListResponse<Transaction> transactionList(String projectId, String userId, Optional<String> cursorOpt);


    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class ListResponse<T> {
        private final ImmutableList<T> items;
        private final Optional<String> cursorOpt;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(partitionKeys = {"userId", "projectId"}, rangePrefix = "vote", rangeKeys = "targetId")
    class VoteModel {
        @NonNull
        private final String userId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String targetId;

        @NonNull
        private final int vote; // Vote enum
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(partitionKeys = {"userId", "projectId"}, rangePrefix = "express", rangeKeys = "targetId")
    class ExpressModel {
        @NonNull
        private final String userId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String targetId;

        @NonNull
        private final ImmutableSet<String> expressions;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(partitionKeys = {"userId", "projectId"}, rangePrefix = "fund", rangeKeys = {"targetId"})
    class FundModel {
        @NonNull
        private final String userId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String targetId;

        @NonNull
        private final long fundAmount;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(partitionKeys = {"userId", "projectId"}, rangePrefix = "transaction", rangeKeys = "transactionId")
    class Transaction {
        @NonNull
        private final String userId;

        @NonNull
        private final String projectId;

        @NonNull
        private final String transactionId;

        @NonNull
        private final Instant created;

        @NonNull
        private final long amount;

        @NonNull
        private final String transactionType;

        /**
         * Optional resource ID involved in this transaction. Resource type depends on the transactionType. Ex, for Vote
         * type, this resource id is of the voted Idea. For Adjustment type, resource id is user id of the admin that
         * initiated the adjustment.
         */
        private final String targetId;

        private final String summary;

        @NonNull
        private final long ttlInEpochSec;
    }

    enum Vote {
        Upvote(1),
        Downvote(-1),
        None(0);

        private int value;

        Vote(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }

        public VoteOption toVoteOption() {
            switch (this) {
                case Upvote:
                    return VoteOption.UPVOTE;
                case Downvote:
                    return VoteOption.DOWNVOTE;
                case None:
                    return VoteOption.NONE;
                default:
                    throw new RuntimeException("Unknown Vote: " + this);
            }
        }

        public static Vote fromVoteOption(VoteOption voteOption) {
            switch (voteOption) {
                case UPVOTE:
                    return Vote.Upvote;
                case DOWNVOTE:
                    return Vote.Downvote;
                case NONE:
                    return Vote.None;
                default:
                    throw new RuntimeException("Unknown VoteOption: " + voteOption);
            }
        }

        public static Vote fromValue(int value) {
            switch (value) {
                case 1:
                    return Vote.Upvote;
                case -1:
                    return Vote.Downvote;
                case 0:
                    return Vote.None;
                default:
                    throw new RuntimeException("Unknown value: " + value);
            }
        }
    }
}
