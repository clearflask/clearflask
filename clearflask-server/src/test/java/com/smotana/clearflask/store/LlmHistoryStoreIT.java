// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.store;

import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.smotana.clearflask.store.LlmHistoryStore.ConvoModel;
import com.smotana.clearflask.store.LlmHistoryStore.MessageModel;
import com.smotana.clearflask.store.dynamo.InMemoryDynamoDbProvider;
import com.smotana.clearflask.store.dynamo.SingleTableProvider;
import com.smotana.clearflask.store.impl.DynamoLlmHistoryStore;
import com.smotana.clearflask.testutil.AbstractIT;
import lombok.extern.slf4j.Slf4j;
import org.junit.Test;

import java.util.Set;

import static com.smotana.clearflask.api.model.ConvoMessage.AuthorTypeEnum.AI;
import static com.smotana.clearflask.api.model.ConvoMessage.AuthorTypeEnum.USER;
import static org.junit.Assert.assertEquals;

@Slf4j
public class LlmHistoryStoreIT extends AbstractIT {

    @Inject
    private LlmHistoryStore store;

    @Override
    protected void configure() {
        super.configure();

        install(DynamoLlmHistoryStore.module());
        install(InMemoryDynamoDbProvider.module());
        install(SingleTableProvider.module());
    }

    @Test(timeout = 30_000L)
    public void testConvos() throws Exception {
        ConvoModel convoModel1 = store.createConvo("p1", "u1", "t1");
        ConvoModel convoModel2 = store.createConvo("p1", "u1", "t2");
        ConvoModel convoModel3 = store.createConvo("p1", "u2", "t3");
        ConvoModel convoModel4 = store.createConvo("p2", "u1", "t4");

        assertEquals(Set.of(convoModel1.getConvoId(), convoModel2.getConvoId()), store.listConvos("p1", "u1").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convoModel3.getConvoId()), store.listConvos("p1", "u2").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convoModel4.getConvoId()), store.listConvos("p2", "u1").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.listConvos("p2", "u2").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.listConvos("p3", "u2").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.listConvos("p3", "u3").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));

        store.deleteConvo("p1", "u1", convoModel1.getConvoId()); // hit
        store.deleteConvo("p2", "u1", convoModel2.getConvoId()); // wrong project
        store.deleteConvo("p1", "u2", convoModel2.getConvoId()); // wrong user
        store.deleteConvo("p1", "u1", convoModel3.getConvoId()); // wrong convo
        assertEquals(Set.of(convoModel2.getConvoId()), store.listConvos("p1", "u1").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convoModel3.getConvoId()), store.listConvos("p1", "u2").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convoModel4.getConvoId()), store.listConvos("p2", "u1").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));

        store.deleteForProject("p1");
        assertEquals(Set.of(), store.listConvos("p1", "u1").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.listConvos("p1", "u2").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(convoModel4.getConvoId()), store.listConvos("p2", "u1").stream().map(ConvoModel::getConvoId).collect(ImmutableSet.toImmutableSet()));
    }

    @Test(timeout = 30_000L)
    public void testMessages() throws Exception {
        ConvoModel convoModel1 = store.createConvo("p1", "u1", "t1");
        ConvoModel convoModel2 = store.createConvo("p1", "u1", "t2");
        ConvoModel convoModel3 = store.createConvo("p1", "u2", "t3");
        ConvoModel convoModel4 = store.createConvo("p2", "u1", "t4");

        MessageModel messageModel1 = store.putMessage(convoModel1.getConvoId(), USER, "c1");
        LlmHistoryStore.MessageModel messageModel2 = store.putMessage(convoModel1.getConvoId(), AI, "c2");
        MessageModel messageModel3 = store.putMessage(convoModel2.getConvoId(), AI, "c3");
        LlmHistoryStore.MessageModel messageModel4 = store.putMessage(convoModel3.getConvoId(), AI, "c4");
        LlmHistoryStore.MessageModel messageModel5 = store.putMessage(convoModel4.getConvoId(), AI, "c5");
        MessageModel messageModel6 = store.putMessage("non-existent", AI, "c6");

        assertEquals(Set.of(messageModel1.getMessageId(), messageModel2.getMessageId()), store.getMessages(convoModel1.getConvoId()).stream().map(MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(messageModel3.getMessageId()), store.getMessages(convoModel2.getConvoId()).stream().map(MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(messageModel4.getMessageId()), store.getMessages(convoModel3.getConvoId()).stream().map(LlmHistoryStore.MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(messageModel5.getMessageId()), store.getMessages(convoModel4.getConvoId()).stream().map(MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages("non-existent-2").stream().map(LlmHistoryStore.MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));

        store.deleteForProject("p1");
        assertEquals(Set.of(), store.getMessages(convoModel1.getConvoId()).stream().map(LlmHistoryStore.MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages(convoModel2.getConvoId()).stream().map(MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages(convoModel3.getConvoId()).stream().map(LlmHistoryStore.MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(messageModel5.getMessageId()), store.getMessages(convoModel4.getConvoId()).stream().map(MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
        assertEquals(Set.of(), store.getMessages("non-existent-2").stream().map(LlmHistoryStore.MessageModel::getMessageId).collect(ImmutableSet.toImmutableSet()));
    }
}
