package com.smotana.clearflask.store;

import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Lists;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.name.Names;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.store.VoteStore.ExpressModel;
import com.smotana.clearflask.store.VoteStore.FundModel;
import com.smotana.clearflask.store.VoteStore.ListResponse;
import com.smotana.clearflask.store.VoteStore.TransactionAndFundPrevious;
import com.smotana.clearflask.store.VoteStore.TransactionModel;
import com.smotana.clearflask.store.VoteStore.VoteModel;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapperImpl;
import com.smotana.clearflask.store.impl.DynamoVoteStore;
import com.smotana.clearflask.testutil.AbstractTest;
import com.smotana.clearflask.util.DefaultServerSecret;
import com.smotana.clearflask.util.IdUtil;
import com.smotana.clearflask.util.ServerSecretTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.List;
import java.util.ListIterator;
import java.util.Optional;
import java.util.UUID;

import static com.smotana.clearflask.store.VoteStore.VoteValue.*;
import static org.junit.Assert.*;

@Slf4j
public class VoteStoreTest extends AbstractTest {

    @Inject
    private VoteStore store;

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                DynamoVoteStore.module(),
                InMemoryDynamoDbProvider.module(),
                DynamoMapperImpl.module(),
                DefaultServerSecret.module(Names.named("cursor"))
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(DefaultServerSecret.Config.class, Names.named("cursor"), om -> {
                    om.override(om.id().sharedKey()).withValue(ServerSecretTest.getRandomSharedKey());
                }));
                install(ConfigSystem.overrideModule(DynamoVoteStore.Config.class, om -> {
                    om.override(om.id().listFetchMax()).withValue(1);
                }));
            }
        }));
    }

    @Test(timeout = 5_000L)
    public void testVote() throws Exception {
        String projectId = IdUtil.randomId();
        String userId = IdUtil.randomId();
        String ideaId1 = IdUtil.randomAscId();
        String ideaId2 = IdUtil.randomAscId();
        String ideaId3 = IdUtil.randomAscId();

        assertEquals(None, store.vote(projectId, userId, ideaId1, Upvote));
        assertEquals(Upvote, store.vote(projectId, userId, ideaId1, Downvote));
        assertEquals(None, store.vote(projectId, userId, ideaId2, Downvote));
        assertEquals(None, store.vote(projectId, userId, ideaId3, Upvote));
        assertEquals(Upvote, store.vote(projectId, userId, ideaId3, None));

        ListResponse<VoteModel> result = store.voteList(projectId, userId, Optional.empty());
        assertEquals(ImmutableList.of(ideaId2), result.getItems().stream().map(VoteModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertTrue(result.getCursorOpt().isPresent());
        result = store.voteList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(ideaId1), result.getItems().stream().map(VoteModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertTrue(result.getCursorOpt().isPresent());
        result = store.voteList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(), result.getItems().stream().map(VoteModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertFalse(result.getCursorOpt().isPresent());

        assertEquals(ImmutableSet.of(), store.voteSearch(projectId, userId, ImmutableSet.of("non-existent-id")).keySet());
        assertEquals(ImmutableSet.of(), store.voteSearch(projectId, userId, ImmutableSet.of(ideaId3)).keySet());
        assertEquals(ImmutableSet.of(ideaId1), store.voteSearch(projectId, userId, ImmutableSet.of(ideaId1)).keySet());
        assertEquals(ImmutableSet.of(ideaId2), store.voteSearch(projectId, userId, ImmutableSet.of(ideaId2, "non-existent-id")).keySet());
        assertEquals(ImmutableSet.of(ideaId1, ideaId2), store.voteSearch(projectId, userId, ImmutableSet.of(ideaId1, ideaId2)).keySet());
    }

    @Test(timeout = 5_000L)
    public void testExpress() throws Exception {
        String projectId = IdUtil.randomId();
        String userId = IdUtil.randomId();
        String ideaId1 = IdUtil.randomAscId();
        String ideaId2 = IdUtil.randomAscId();
        String ideaId3 = IdUtil.randomAscId();

        assertEquals(ImmutableSet.of(), store.express(projectId, userId, ideaId1, Optional.of("🎈")));
        assertEquals(ImmutableSet.of("🎈"), store.express(projectId, userId, ideaId1, Optional.empty()));
        assertEquals(ImmutableSet.of(), store.express(projectId, userId, ideaId1, Optional.of("❤️")));
        assertEquals(ImmutableSet.of("❤️"), store.expressMultiAdd(projectId, userId, ideaId1, ImmutableSet.of("💚", "💜", "🀄︎", "🇲🇳")));
        assertEquals(ImmutableSet.of("❤️", "💚", "💜", "🀄︎", "🇲🇳"), store.expressMultiAdd(projectId, userId, ideaId1, ImmutableSet.of("🇲🇳")));
        assertEquals(ImmutableSet.of("❤️", "💚", "💜", "🀄︎", "🇲🇳"), store.expressMultiRemove(projectId, userId, ideaId1, ImmutableSet.of("💚", "💜")));
        assertEquals(ImmutableSet.of("❤️", "🀄︎", "🇲🇳"), store.expressMultiRemove(projectId, userId, ideaId1, ImmutableSet.of("💚")));
        assertEquals(ImmutableSet.of("❤️", "🇲🇳", "🀄︎"), store.express(projectId, userId, ideaId1, Optional.of("🚾")));
        assertEquals(ImmutableSet.of("🚾"), store.expressMultiRemove(projectId, userId, ideaId1, ImmutableSet.of("❤️")));
        assertEquals(ImmutableSet.of(), store.express(projectId, userId, ideaId2, Optional.of("❔")));
        assertEquals(ImmutableSet.of(), store.expressMultiRemove(projectId, userId, ideaId3, ImmutableSet.of("💜")));
        assertEquals(ImmutableSet.of(), store.expressMultiAdd(projectId, userId, ideaId3, ImmutableSet.of("💜")));
        assertEquals(ImmutableSet.of("💜"), store.express(projectId, userId, ideaId3, Optional.empty()));

        ListResponse<ExpressModel> result = store.expressList(projectId, userId, Optional.empty());
        assertEquals(ImmutableList.of(ideaId2), result.getItems().stream().map(ExpressModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertTrue(result.getCursorOpt().isPresent());
        result = store.expressList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(ideaId1), result.getItems().stream().map(ExpressModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertTrue(result.getCursorOpt().isPresent());
        result = store.expressList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(), result.getItems().stream().map(ExpressModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertFalse(result.getCursorOpt().isPresent());

        assertEquals(ImmutableSet.of(), store.expressSearch(projectId, userId, ImmutableSet.of("non-existent-id")).keySet());
        assertEquals(ImmutableSet.of(), store.expressSearch(projectId, userId, ImmutableSet.of(ideaId3)).keySet());
        assertEquals(ImmutableSet.of(ideaId1), store.expressSearch(projectId, userId, ImmutableSet.of(ideaId1)).keySet());
        assertEquals(ImmutableSet.of(ideaId2), store.expressSearch(projectId, userId, ImmutableSet.of(ideaId2, "non-existent-id")).keySet());
        assertEquals(ImmutableSet.of(ideaId1, ideaId2), store.expressSearch(projectId, userId, ImmutableSet.of(ideaId1, ideaId2)).keySet());
    }

    @Test(timeout = 5_00000L)
    public void testFund() throws Exception {
        String projectId = IdUtil.randomId();
        String userId = IdUtil.randomId();
        String ideaId1 = IdUtil.randomAscId();
        String ideaId2 = IdUtil.randomAscId();
        String ideaId3 = IdUtil.randomAscId();

        assertEquals(4L, store.fund(projectId, userId, ideaId1, 4L, "transaction-type1", "summary1").getTransaction().getAmount());
        assertEquals(-2L, store.fund(projectId, userId, ideaId1, -2L, "transaction-type2", "summary2").getTransaction().getAmount());
        try {
            store.fund(projectId, userId, ideaId1, -3L, "transaction-type-fail", "summary-fail");
            fail();
        } catch (ConditionalCheckFailedException ex) {
            // Expected
        }
        assertEquals(3L, store.fund(projectId, userId, ideaId2, 3L, "transaction-type3", "summary3").getTransaction().getAmount());

        ListResponse<FundModel> result = store.fundList(projectId, userId, Optional.empty());
        assertEquals(ImmutableList.of(ideaId2), result.getItems().stream().map(FundModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertTrue(result.getCursorOpt().isPresent());
        result = store.fundList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(ideaId1), result.getItems().stream().map(FundModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertTrue(result.getCursorOpt().isPresent());
        result = store.fundList(projectId, userId, result.getCursorOpt());
        assertEquals(ImmutableList.of(), result.getItems().stream().map(FundModel::getTargetId).collect(ImmutableList.toImmutableList()));
        assertFalse(result.getCursorOpt().isPresent());

        assertEquals(5L, store.fund(projectId, userId, ideaId3, 5L, "transaction-type4", "summary4").getTransaction().getAmount());
        assertEquals(-5L, store.fund(projectId, userId, ideaId3, -5L, "transaction-type5", "summary5").getTransaction().getAmount());

        assertEquals(ImmutableSet.of(), store.fundSearch(projectId, userId, ImmutableSet.of("non-existent-id")).keySet());
        assertEquals(ImmutableSet.of(), store.fundSearch(projectId, userId, ImmutableSet.of(ideaId3)).keySet());
        assertEquals(ImmutableSet.of(ideaId1), store.fundSearch(projectId, userId, ImmutableSet.of(ideaId1)).keySet());
        assertEquals(ImmutableSet.of(ideaId2), store.fundSearch(projectId, userId, ImmutableSet.of(ideaId2, "non-existent-id")).keySet());
        assertEquals(ImmutableSet.of(ideaId1, ideaId2), store.fundSearch(projectId, userId, ImmutableSet.of(ideaId1, ideaId2)).keySet());
    }

    @Test(timeout = 5_000L)
    public void testTransaction() throws Exception {
        String projectId = IdUtil.randomId();
        String userId = IdUtil.randomId();
        String ideaId1 = IdUtil.randomAscId();
        String ideaId2 = IdUtil.randomAscId();
        String ideaId3 = IdUtil.randomAscId();

        List<TransactionModel> expectedTransactions = Lists.newArrayList();

        assertMakeTransaction(expectedTransactions, projectId, userId, ideaId1, 4L);
        assertMakeTransaction(expectedTransactions, projectId, userId, ideaId1, 16L);
        assertMakeTransaction(expectedTransactions, projectId, userId, ideaId1, 3L);
        assertMakeTransaction(expectedTransactions, projectId, userId, ideaId2, 8L);
        assertMakeTransaction(expectedTransactions, projectId, userId, ideaId2, 8L);
        assertMakeTransaction(expectedTransactions, projectId, userId, ideaId1, 0L);
        assertMakeTransaction(expectedTransactions, projectId, userId, ideaId3, 5L);
        assertMakeTransaction(expectedTransactions, projectId, userId, ideaId3, 0L);
    }

    private void assertMakeTransaction(List<TransactionModel> expectedTransactions, String projectId, String userId, String ideaId, long fundAmount) {
        String transactionType = UUID.randomUUID().toString();
        String summary = UUID.randomUUID().toString();
        TransactionAndFundPrevious fundResult = store.fund(projectId, userId, ideaId, fundAmount, transactionType, summary);
        assertEquals(new TransactionModel(
                        userId,
                        projectId,
                        fundResult.getTransaction().getTransactionId(),
                        fundResult.getTransaction().getCreated(),
                        fundResult.getTransaction().getAmount(),
                        fundResult.getTransaction().getBalance(),
                        transactionType,
                        ideaId,
                        summary,
                        fundResult.getTransaction().getTtlInEpochSec()),
                fundResult.getTransaction());
        expectedTransactions.add(fundResult.getTransaction());

        ListIterator<TransactionModel> expectedTransactionIterator = expectedTransactions.listIterator(expectedTransactions.size());
        long pages = 0;
        Optional<String> cursor = Optional.empty();
        do {
            ListResponse<TransactionModel> listResult = store.transactionList(projectId, userId, cursor);
            pages++;
            cursor = listResult.getCursorOpt();
            listResult.getItems().forEach(actualTransaction -> {
                assertTrue(expectedTransactionIterator.hasPrevious());
                assertEquals(expectedTransactionIterator.previous(), actualTransaction);
            });
        } while (cursor.isPresent());
        assertFalse(expectedTransactionIterator.hasPrevious());
        assertEquals(expectedTransactions.size() + 1, pages);
    }
}
