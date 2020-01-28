package com.smotana.clearflask.store;


import com.google.common.collect.ImmutableList;
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

    default String genTransactionId() {
        return IdUtil.randomAscId();
    }

    void ideaVote(String projectId, String userId, String ideaId, Vote vote);

    void ideaExpress(String projectId, String userId, String ideaId, Optional<String> expression);

    void ideaExpressMulti(String projectId, String userId, String ideaId, ImmutableSet<String> addExpressions, ImmutableSet<String> removeExpressions);

    Transaction ideaFund(String projectId, String userId, String ideaId, long amount, String transactionType, String summary);

    TransactionListResponse ideaFundTransactionList(String projectId, String userId, Optional<String> cursorOpt);

    void commentVote(String projectId, String userId, String commentId, Vote vote);

    @Value
    @Builder(toBuilder = true)
    @AllArgsConstructor
    class TransactionListResponse {
        private final ImmutableList<Transaction> transactions;
        private final Optional<String> cursorOpt;
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
        private final long balance;

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
        UPVOTE(1),
        DOWNVOTE(-1),
        NONE(0);

        private int value;

        Vote(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }

        public VoteOption toVoteOption() {
            switch (this) {
                case UPVOTE:
                    return VoteOption.UPVOTE;
                case DOWNVOTE:
                    return VoteOption.DOWNVOTE;
                case NONE:
                    return VoteOption.NONE;
                default:
                    throw new RuntimeException("Unknown Vote: " + this);
            }
        }

        public static Vote fromVoteOption(VoteOption voteOption) {
            switch (voteOption) {
                case UPVOTE:
                    return Vote.UPVOTE;
                case DOWNVOTE:
                    return Vote.DOWNVOTE;
                case NONE:
                    return Vote.NONE;
                default:
                    throw new RuntimeException("Unknown VoteOption: " + voteOption);
            }
        }

        public static Vote fromValue(int value) {
            switch (value) {
                case 1:
                    return Vote.UPVOTE;
                case -1:
                    return Vote.DOWNVOTE;
                case 0:
                    return Vote.NONE;
                default:
                    throw new RuntimeException("Unknown value: " + value);
            }
        }
    }
}
