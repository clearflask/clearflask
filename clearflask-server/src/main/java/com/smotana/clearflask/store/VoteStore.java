package com.smotana.clearflask.store;


import com.google.common.base.Enums;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.smotana.clearflask.api.model.Transaction;
import com.smotana.clearflask.api.model.TransactionType;
import com.smotana.clearflask.api.model.VoteOption;
import com.smotana.clearflask.store.dynamo.mapper.DynamoTable;
import com.smotana.clearflask.util.IdUtil;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NonNull;
import lombok.Value;

import java.time.Instant;
import java.util.Optional;

import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Gsi;
import static com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableType.Primary;

public interface VoteStore {

    /**
     * Returns previous vote.
     */
    VoteValue vote(String projectId, String userId, String targetId, VoteValue vote);

    ImmutableMap<String, VoteModel> voteSearch(String projectId, String userId, ImmutableSet<String> targetIds);

    /**
     * Ordered by targetId desc.
     */
    ListResponse<VoteModel> voteListByUser(String projectId, String userId, Optional<String> cursorOpt);

    ListResponse<VoteModel> voteListByTarget(String projectId, String targetId, Optional<String> cursorOpt);


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
    ListResponse<ExpressModel> expressListByUser(String projectId, String userId, Optional<String> cursorOpt);

    ListResponse<ExpressModel> expressListByTarget(String projectId, String targetId, Optional<String> cursorOpt);


    default String genTransactionId() {
        return IdUtil.randomAscId();
    }

    TransactionModel balanceAdjustTransaction(String projectId, String userId, long balanceDiff, String summary);

    TransactionAndFundPrevious fund(String projectId, String userId, String targetId, long fundDiff, String transactionType, String summary);

    ImmutableMap<String, FundModel> fundSearch(String projectId, String userId, ImmutableSet<String> targetIds);

    /**
     * Ordered by targetId desc.
     */
    ListResponse<FundModel> fundListByUser(String projectId, String userId, Optional<String> cursorOpt);

    ListResponse<FundModel> fundListByTarget(String projectId, String targetId, Optional<String> cursorOpt);

    /**
     * Ordered by created desc.
     */
    ListResponse<TransactionModel> transactionList(String projectId, String userId, Optional<String> cursorOpt);


    void deleteAllForProject(String projectId);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class TransactionAndFundPrevious {
        TransactionModel transaction;
        long fundAmountPrevious;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class ListResponse<T> {
        ImmutableList<T> items;
        Optional<String> cursorOpt;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "vote", rangeKeys = "targetId")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = {"targetId", "projectId"}, rangePrefix = "voteByTarget", rangeKeys = "userId")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "voteByProjectId")
    class VoteModel {
        @NonNull
        String userId;

        @NonNull
        String projectId;

        @NonNull
        String targetId;

        @NonNull
        int vote; // Vote enum
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "express", rangeKeys = "targetId")
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = {"targetId", "projectId"}, rangePrefix = "expressByTarget", rangeKeys = "userId")
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "expressByProjectId")
    class ExpressModel {
        @NonNull
        String userId;

        @NonNull
        String projectId;

        @NonNull
        String targetId;

        @NonNull
        ImmutableSet<String> expressions;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "fund", rangeKeys = {"targetId"})
    @DynamoTable(type = Gsi, indexNumber = 1, partitionKeys = {"targetId", "projectId"}, rangePrefix = "fundByTarget", rangeKeys = {"userId"})
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "fundByProjectId")
    class FundModel {
        @NonNull
        String userId;

        @NonNull
        String projectId;

        @NonNull
        String targetId;

        @NonNull
        long fundAmount;
    }

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    @DynamoTable(type = Primary, partitionKeys = {"userId", "projectId"}, rangePrefix = "transaction", rangeKeys = {"transactionId"})
    @DynamoTable(type = Gsi, indexNumber = 2, partitionKeys = {"projectId"}, rangePrefix = "transactionByProjectId", rangeKeys = {"created"})
    class TransactionModel {
        @NonNull
        String userId;

        @NonNull
        String projectId;

        @NonNull
        String transactionId;

        @NonNull
        Instant created;

        @NonNull
        long amount;

        @NonNull
        String transactionType;

        /**
         * Optional resource ID involved in this transaction. Resource type depends on the transactionType. Ex, for Vote
         * type, this resource id is of the voted Idea. For Adjustment type, resource id is user id of the admin that
         * initiated the adjustment.
         */
        String targetId;

        String summary;

        @NonNull
        long ttlInEpochSec;

        public Transaction toTransaction() {
            return new Transaction(
                    getUserId(),
                    getTransactionId(),
                    getCreated(),
                    getAmount(),
                    Enums.getIfPresent(TransactionType.class, getTransactionType())
                            .or(TransactionType.ADJUSTMENT),
                    getTargetId(),
                    getSummary());
        }
    }

    enum VoteValue {
        Upvote(1),
        Downvote(-1),
        None(0);

        private int value;

        VoteValue(int value) {
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

        public static VoteValue fromVoteOption(VoteOption voteOption) {
            switch (voteOption) {
                case UPVOTE:
                    return VoteValue.Upvote;
                case DOWNVOTE:
                    return VoteValue.Downvote;
                case NONE:
                    return VoteValue.None;
                default:
                    throw new RuntimeException("Unknown VoteOption: " + voteOption);
            }
        }

        public static VoteValue fromValue(int value) {
            switch (value) {
                case 1:
                    return VoteValue.Upvote;
                case -1:
                    return VoteValue.Downvote;
                case 0:
                    return VoteValue.None;
                default:
                    throw new RuntimeException("Unknown value: " + value);
            }
        }
    }
}
